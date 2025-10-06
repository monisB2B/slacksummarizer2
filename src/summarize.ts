import { OpenAI } from 'openai';
import * as chrono from 'chrono-node';
import prisma from './store';
import logger from './logger';
import config from './config';
import { extractMentions } from './ingest';
import { WebClient } from '@slack/web-api';
import { slackClient } from './slack';

// Define types for summary data
interface SummaryData {
  summary: string;
  highlights: {
    text: string;
    permalink: string;
    ts: string;
    user_id: string;
  }[];
  tasks: {
    title: string;
    owner_user_id: string | null;
    due_date: string | null;
    confidence: number;
    source_ts: string;
    source_permalink: string;
  }[];
  mentions: Record<
    string,
    {
      count: number;
      contexts: string[];
    }
  >;
}

interface ThreadSummary {
  root_ts: string;
  permalink: string;
  summary: string;
  participant_count: number;
  reply_count: number;
}

// Task extraction regex patterns
const TASK_PATTERNS = [
  /\btodo\b:?\s*(.+?)(?:\.|$)/i,
  /\bplease\b.{0,15}(do|create|update|change|fix|implement|add|remove|check|review)(.+?)(?:\.|$)/i,
  /(?:need|needs) to\s+(do|create|update|change|fix|implement|add|remove|check|review)(.+?)(?:\.|$)/i,
  /\b(do|create|update|change|fix|implement|add|remove|check|review)\b.{0,15}(by|before|after|on)(.+?)(?:\.|$)/i,
  /\[\s?\]\s+(.+?)(?:\.|$)/,
  /\*\s+(.+?)(?:\.|$)/,
  /\d+\.\s+(.+?)(?:\.|$)/,
];

// OpenAI API client
let openai: OpenAI | null = null;
if (config.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
  });
}

/**
 * Extract tasks from a message using regex patterns
 */
export function extractTasksHeuristic(
  message: {
    text: string;
    ts: string;
    permalink: string;
    user_id: string;
  }
): SummaryData['tasks'] {
  const tasks: SummaryData['tasks'] = [];
  
  // Apply each pattern
  for (const pattern of TASK_PATTERNS) {
    const matches = message.text.match(pattern);
    if (matches && matches.length > 1) {
      // Extract task title from the match
      const title = matches.slice(1).join(' ').trim();
      if (title.length < 5) continue; // Skip very short tasks
      
      // Look for potential owners
      const mentions = extractMentions(message.text);
      const owner = mentions.length === 1 ? mentions[0] : null;
      
      // Look for dates
      const parsedDate = chrono.parse(message.text);
      const dueDate = parsedDate.length > 0 ? parsedDate[0].start.date().toISOString() : null;
      
      tasks.push({
        title,
        owner_user_id: owner,
        due_date: dueDate,
        confidence: 0.6, // Medium confidence for heuristic extraction
        source_ts: message.ts,
        source_permalink: message.permalink,
      });
    }
  }
  
  return tasks;
}

/**
 * Generate a summary using OpenAI's API
 */
async function generateAISummary(
  messages: Array<{
    text: string;
    ts: string;
    thread_ts?: string;
    permalink: string;
    user_id: string;
    reactions?: Record<string, string[]>;
  }>,
  channelName: string
): Promise<SummaryData> {
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }
  
  // Format messages for the API
  const formattedMessages = messages.map(msg => {
    const reactions = msg.reactions ? Object.keys(msg.reactions).join(' ') : '';
    const isThreadParent = messages.some(m => m.thread_ts === msg.ts && m.ts !== msg.ts);
    const threadMark = isThreadParent ? '[THREAD_START] ' : '';
    return `${threadMark}[${new Date(parseFloat(msg.ts) * 1000).toISOString()}] <@${
      msg.user_id
    }>: ${msg.text} ${reactions ? `[reactions: ${reactions}]` : ''}`;
  }).join('\n\n');
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using gpt-4o-mini as specified
      messages: [
        {
          role: 'system',
          content: `You are an AI assistant that summarizes Slack conversations. You'll receive messages from the "${channelName}" channel and need to create a concise summary. 
          
Your task is to analyze the conversation and generate:
1. A concise channel recap (5-10 bullet points)
2. Highlight the top 3-5 most important messages based on context and reactions
3. Identify thread conversations and summarize them in one line each
4. Extract any action items or tasks, noting who is responsible and any due dates
5. Create a mention matrix showing who was mentioned and in what context

Format your response as a JSON object with these keys:
{
  "summary": "5-10 bullet points recapping key discussions",
  "highlights": [{"text": "message content", "permalink": "url", "ts": "timestamp", "user_id": "user_id"}],
  "tasks": [{"title": "task description", "owner_user_id": "user_id or null", "due_date": "ISO date or null", "confidence": 0.0-1.0, "source_ts": "timestamp", "source_permalink": "url"}],
  "mentions": {"USER_ID": {"count": number, "contexts": ["brief context"]}}
}

Return valid JSON only, no explanations.`,
        },
        {
          role: 'user',
          content: formattedMessages.length > 0 ? formattedMessages : 'No messages in this period.',
        },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    });
    
    const summaryData = JSON.parse(response.choices[0].message.content || '{}');
    
    // Ensure the response has the expected structure
    return {
      summary: summaryData.summary || 'No summary available.',
      highlights: Array.isArray(summaryData.highlights) ? summaryData.highlights : [],
      tasks: Array.isArray(summaryData.tasks) ? summaryData.tasks : [],
      mentions: summaryData.mentions || {},
    };
  } catch (error) {
    logger.error({ error }, 'Error generating AI summary');
    throw error;
  }
}

/**
 * Generate a summary using heuristic methods (fallback when OpenAI API is not available)
 */
function generateHeuristicSummary(
  messages: Array<{
    text: string;
    ts: string;
    thread_ts?: string;
    permalink: string;
    user_id: string;
    reactions?: Record<string, string[]>;
  }>,
  channelName: string
): SummaryData {
  // Extract key messages based on reactions, thread starts, and mentions
  const highlights = messages
    .filter(msg => {
      // Messages with reactions
      if (msg.reactions && Object.keys(msg.reactions).length > 0) return true;
      
      // Thread parent messages
      if (messages.some(m => m.thread_ts === msg.ts && m.ts !== msg.ts)) return true;
      
      // Messages with questions
      if (msg.text.includes('?')) return true;
      
      return false;
    })
    .map(msg => ({
      text: msg.text,
      permalink: msg.permalink,
      ts: msg.ts,
      user_id: msg.user_id,
    }))
    .slice(0, 5); // Limit to top 5
  
  // Extract threads
  const threadMap = new Map<string, { messages: typeof messages; root_ts: string }>();
  
  messages.forEach(msg => {
    if (msg.thread_ts && msg.ts !== msg.thread_ts) {
      if (!threadMap.has(msg.thread_ts)) {
        threadMap.set(msg.thread_ts, { messages: [], root_ts: msg.thread_ts });
      }
      threadMap.get(msg.thread_ts)!.messages.push(msg);
    }
  });
  
  // Extract mentions
  const mentionsMap: Record<string, { count: number; contexts: string[] }> = {};
  
  messages.forEach(msg => {
    const mentions = extractMentions(msg.text);
    mentions.forEach(userId => {
      if (!mentionsMap[userId]) {
        mentionsMap[userId] = { count: 0, contexts: [] };
      }
      mentionsMap[userId].count += 1;
      if (mentionsMap[userId].contexts.length < 3) {
        // Just store the first 30 chars of context to avoid large summaries
        mentionsMap[userId].contexts.push(msg.text.slice(0, 30) + '...');
      }
    });
  });
  
  // Extract tasks
  let tasks: SummaryData['tasks'] = [];
  
  messages.forEach(msg => {
    const extractedTasks = extractTasksHeuristic(msg);
    tasks = [...tasks, ...extractedTasks];
  });
  
  // Generate a simple summary text
  let summaryText = `Channel: ${channelName}\n`;
  summaryText += `Period: ${new Date(
    parseFloat(messages[0]?.ts || '0') * 1000
  ).toLocaleString()} to ${new Date(
    parseFloat(messages[messages.length - 1]?.ts || '0') * 1000
  ).toLocaleString()}\n\n`;
  
  summaryText += `Total messages: ${messages.length}\n`;
  summaryText += `Active threads: ${threadMap.size}\n`;
  summaryText += `Unique participants: ${new Set(messages.map(m => m.user_id)).size}\n`;
  
  if (highlights.length > 0) {
    summaryText += '\nKey messages:\n';
    highlights.forEach((h, i) => {
      summaryText += `${i + 1}. "${h.text.slice(0, 50)}..."\n`;
    });
  }
  
  return {
    summary: summaryText,
    highlights,
    tasks,
    mentions: mentionsMap,
  };
}

/**
 * Generate a summary for a conversation in a specific time window
 */
export async function generateSummaryForTimeWindow(
  conversationId: number,
  startTime: Date,
  endTime: Date
) {
  try {
    // Get conversation details
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    
    if (!conversation) {
      logger.error({ conversationId }, 'Conversation not found');
      throw new Error(`Conversation ${conversationId} not found`);
    }
    
    // Get messages in the time window
    const messages = await prisma.message.findMany({
      where: {
        channel_id: conversationId,
        createdAt: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: {
        ts: 'asc',
      },
    });
    
    if (messages.length === 0) {
      logger.info(
        { conversationId, startTime, endTime },
        'No messages in time window, skipping summary'
      );
      return null;
    }
    
    logger.info(
      { conversationId, messageCount: messages.length },
      'Generating summary'
    );
    
    // Generate the summary
    let summaryData: SummaryData;
    
    try {
      if (openai) {
        // Use OpenAI if available
        summaryData = await generateAISummary(messages.map(m => ({
          text: m.text,
          ts: m.ts,
          thread_ts: m.thread_ts || undefined,
          permalink: m.permalink,
          user_id: m.user_id,
          reactions: m.reactions as unknown as Record<string, string[]> | undefined
        })), conversation.name);
      } else {
        // Fall back to heuristic methods
        summaryData = generateHeuristicSummary(messages.map(m => ({
          text: m.text,
          ts: m.ts,
          thread_ts: m.thread_ts || undefined,
          permalink: m.permalink,
          user_id: m.user_id,
          reactions: m.reactions as unknown as Record<string, string[]> | undefined
        })), conversation.name);
      }
    } catch (error) {
      logger.error({ error }, 'Error generating summary, falling back to heuristic');
      summaryData = generateHeuristicSummary(messages.map(m => ({
        text: m.text,
        ts: m.ts,
        thread_ts: m.thread_ts || undefined,
        permalink: m.permalink,
        user_id: m.user_id,
        reactions: m.reactions as unknown as Record<string, string[]> | undefined
      })), conversation.name);
    }
    
    // Store the summary
    const summary = await prisma.summary.create({
      data: {
        channel_id: conversationId,
        period_start: startTime,
        period_end: endTime,
        summary: summaryData.summary,
        highlights: summaryData.highlights,
        tasks: summaryData.tasks,
        mentions: summaryData.mentions,
      },
    });
    
    logger.info(
      { summaryId: summary.id, conversationId },
      'Summary generated and stored'
    );
    
    return summary;
  } catch (error) {
    logger.error(
      { error, conversationId, startTime, endTime },
      'Failed to generate summary'
    );
    throw error;
  }
}

/**
 * Post a summary to a Slack channel using Block Kit
 */
export async function postSummaryToSlack(summaryId: number) {
  try {
    if (!config.DIGEST_CHANNEL) {
      logger.warn('DIGEST_CHANNEL not configured, skipping posting summary');
      return null;
    }
    
    const summary = await prisma.summary.findUnique({
      where: { id: summaryId },
      include: {
        channel: true,
      },
    });
    
    if (!summary) {
      throw new Error(`Summary ${summaryId} not found`);
    }
    
    // Build the Block Kit message
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `Daily Summary: #${summary.channel.name}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Period:* ${summary.period_start.toLocaleString()} - ${summary.period_end.toLocaleString()}`,
        },
      },
      {
        type: 'divider',
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Summary*',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: summary.summary.substring(0, 3000), // Slack has a text limit
        },
      },
    ];
    
    // Add highlights
    if (summary.highlights && (summary.highlights as any).length > 0) {
      blocks.push({
        type: 'divider',
      });
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Key Messages*',
        },
      });
      
      const highlights = summary.highlights as any as SummaryData['highlights'];
      
      highlights.forEach((highlight, index) => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${index + 1}. <${highlight.permalink}|${highlight.text.substring(0, 100)}${
              highlight.text.length > 100 ? '...' : ''
            }>`,
          },
        });
      });
    }
    
    // Add tasks
    if (summary.tasks && (summary.tasks as any).length > 0) {
      blocks.push({
        type: 'divider',
      });
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Action Items*',
        },
      });
      
      const tasks = summary.tasks as any as SummaryData['tasks'];
      
      tasks.forEach((task, index) => {
        let taskText = `${index + 1}. <${task.source_permalink}|${task.title}>`;
        
        if (task.owner_user_id) {
          taskText += ` (Owner: <@${task.owner_user_id}>)`;
        }
        
        if (task.due_date) {
          const dueDate = new Date(task.due_date);
          taskText += ` (Due: ${dueDate.toLocaleDateString()})`;
        }
        
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: taskText,
          },
        });
      });
    }
    
    // Add mentions
    const mentions = summary.mentions as any as SummaryData['mentions'];
    if (mentions && Object.keys(mentions).length > 0) {
      blocks.push({
        type: 'divider',
      });
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Mention Stats*',
        },
      });
      
      let mentionsText = '';
      Object.entries(mentions)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10) // Limit to top 10
        .forEach(([userId, info]) => {
          mentionsText += `<@${userId}>: ${info.count} mentions\n`;
        });
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: mentionsText,
        },
      });
    }
    
    // Send the message to Slack
    const result = await slackClient.chat.postMessage({
      channel: config.DIGEST_CHANNEL,
      blocks,
      text: `Daily Summary for #${summary.channel.name}`,
    });
    
    logger.info(
      { summaryId, channel: config.DIGEST_CHANNEL, ts: result.ts },
      'Posted summary to Slack'
    );
    
    return result;
  } catch (error) {
    logger.error({ error, summaryId }, 'Failed to post summary to Slack');
    throw error;
  }
}

export default {
  generateSummaryForTimeWindow,
  postSummaryToSlack,
  extractTasksHeuristic,
};