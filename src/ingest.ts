import { WebClient, ErrorCode } from '@slack/web-api';
import prisma from './store';
import logger from './logger';
import config from './config';
import { slackClient } from './slack';

// Types for Slack conversations
interface ConversationListResponse {
  channels: Array<{
    id: string;
    name: string;
    is_channel: boolean;
    is_group: boolean;
    is_im: boolean;
    is_mpim: boolean;
    is_private: boolean;
  }>;
  response_metadata?: {
    next_cursor?: string;
  };
}

interface ConversationHistoryResponse {
  messages: Array<{
    type: string;
    user: string;
    text: string;
    ts: string;
    thread_ts?: string;
    reply_count?: number;
    replies?: Array<{ user: string; ts: string }>;
    reactions?: Array<{
      name: string;
      count: number;
      users: string[];
    }>;
  }>;
  has_more: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
}

interface RepliesResponse {
  messages: Array<{
    type: string;
    user: string;
    text: string;
    ts: string;
    thread_ts?: string;
    parent_user_id?: string;
    reactions?: Array<{
      name: string;
      count: number;
      users: string[];
    }>;
  }>;
  has_more: boolean;
  response_metadata?: {
    next_cursor?: string;
  };
}

interface UserCacheItem {
  id: string;
  name: string;
  real_name: string | null;
  email: string | null;
  avatar: string | null;
  is_bot: boolean;
  timestamp: number;
}

// A cache for users to minimize API requests
const userCache: Record<string, UserCacheItem> = {};
const USER_CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds

// Exponential backoff for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const makeSlackRequest = async <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = config.MAX_RETRIES,
  initialDelay: number = config.RATE_LIMIT_DELAY
): Promise<T> => {
  let retries = 0;
  let delay = initialDelay;

  while (true) {
    try {
      return await requestFn();
    } catch (error: any) {
      if (error.code === ErrorCode.RateLimitedError && retries < maxRetries) {
        const retryAfter = error.retryAfter || 1;
        logger.warn(
          { retryAfter, attempt: retries + 1, maxRetries },
          'Rate limited by Slack API, retrying'
        );
        
        // Sleep for the retry-after duration or use exponential backoff
        await sleep(retryAfter * 1000 || delay);
        
        retries++;
        delay *= 2; // Exponential backoff
      } else {
        logger.error({ error }, 'Error making Slack request');
        throw error;
      }
    }
  }
};

/**
 * Lists all conversations (channels, private groups, DMs, MPDMs) that the bot can access
 */
export async function listAllConversations(
  types: Array<'public_channel' | 'private_channel' | 'mpim' | 'im'> = [
    'public_channel',
    'private_channel',
    'mpim',
    'im',
  ]
) {
  const conversations: ConversationListResponse['channels'] = [];
  let cursor: string | undefined;
  
  do {
    const response = await makeSlackRequest<ConversationListResponse>(() => 
      slackClient.conversations.list({
        types: types.join(','),
        cursor: cursor || undefined,
        limit: 200,
      }) as Promise<ConversationListResponse>
    );
    
    conversations.push(...response.channels);
    cursor = response.response_metadata?.next_cursor;
  } while (cursor);
  
  logger.info(`Found ${conversations.length} conversations`);
  return conversations;
}

/**
 * Ensures a conversation exists in the database, creates it if not
 */
export async function ensureConversation(conversationInfo: {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
}) {
  const { id, name } = conversationInfo;
  
  // Determine conversation type
  let type: 'channel' | 'group' | 'im' | 'mpim';
  if (conversationInfo.is_channel) {
    type = 'channel';
  } else if (conversationInfo.is_group) {
    type = 'group';
  } else if (conversationInfo.is_im) {
    type = 'im';
  } else if (conversationInfo.is_mpim) {
    type = 'mpim';
  } else {
    throw new Error(`Unknown conversation type for ${id}`);
  }
  
  // Upsert the conversation
  const conversation = await prisma.conversation.upsert({
    where: { slack_id: id },
    update: {
      name,
      type,
      updatedAt: new Date(),
    },
    create: {
      slack_id: id,
      name,
      type,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  
  logger.debug({ conversation }, `Ensured conversation ${id}`);
  return conversation;
}

/**
 * Gets a permalink for a message
 */
export async function getPermalink(channel: string, message_ts: string) {
  try {
    const response = await makeSlackRequest(() => 
      slackClient.chat.getPermalink({
        channel,
        message_ts,
      })
    );
    
    return response.permalink as string;
  } catch (error) {
    logger.error({ error, channel, message_ts }, 'Failed to get permalink');
    return '';
  }
}

/**
 * Extract mentions from message text
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /<@([A-Z0-9]+)>/g;
  const mentions: string[] = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Get user information from Slack API
 */
export async function getUserInfo(userId: string) {
  // Check cache first
  const now = Date.now();
  if (userCache[userId] && now - userCache[userId].timestamp < USER_CACHE_TTL) {
    return userCache[userId];
  }
  
  try {
    const response = await makeSlackRequest(() => 
      slackClient.users.info({ user: userId })
    );
    
    if (!response.user) {
      throw new Error(`User ${userId} not found`);
    }
    
    const user = response.user as any;
    
    // Store in database
    await prisma.user.upsert({
      where: { slack_id: userId },
      update: {
        name: user.name,
        real_name: user.real_name || null,
        email: user.profile?.email || null,
        avatar: user.profile?.image_72 || null,
        is_bot: !!user.is_bot,
        last_updated: new Date(),
      },
      create: {
        slack_id: userId,
        name: user.name,
        real_name: user.real_name || null,
        email: user.profile?.email || null,
        avatar: user.profile?.image_72 || null,
        is_bot: !!user.is_bot,
        last_updated: new Date(),
      },
    });
    
    // Update cache
    userCache[userId] = {
      id: userId,
      name: user.name,
      real_name: user.real_name || null,
      email: user.profile?.email || null,
      avatar: user.profile?.image_72 || null,
      is_bot: !!user.is_bot,
      timestamp: now,
    };
    
    return userCache[userId];
  } catch (error) {
    logger.error({ error, userId }, 'Failed to get user info');
    return null;
  }
}

/**
 * Fetch messages from a conversation, handling pagination
 */
export async function fetchMessages(
  conversationId: string,
  oldest?: string,
  limit: number = 1000
) {
  const allMessages: ConversationHistoryResponse['messages'] = [];
  let cursor: string | undefined;
  let hasMore = true;
  
  try {
    // Fetch the main conversation messages
    while (hasMore && allMessages.length < limit) {
      const response = await makeSlackRequest<ConversationHistoryResponse>(() => 
        slackClient.conversations.history({
          channel: conversationId,
          oldest,
          cursor: cursor || undefined,
          limit: Math.min(100, limit - allMessages.length),
        }) as Promise<ConversationHistoryResponse>
      );
      
      allMessages.push(...response.messages);
      hasMore = response.has_more;
      cursor = response.response_metadata?.next_cursor;
    }
    
    // Process messages that are part of threads
    for (const message of allMessages.filter(m => m.thread_ts && !m.reply_count)) {
      try {
        await fetchThreadReplies(conversationId, message.ts);
      } catch (error) {
        logger.error(
          { error, conversationId, threadTs: message.ts },
          'Failed to fetch thread replies'
        );
      }
    }
    
    return allMessages;
  } catch (error) {
    logger.error({ error, conversationId }, 'Failed to fetch messages');
    throw error;
  }
}

/**
 * Fetch replies for a thread
 */
export async function fetchThreadReplies(conversationId: string, threadTs: string) {
  const replies: RepliesResponse['messages'] = [];
  let cursor: string | undefined;
  let hasMore = true;
  
  try {
    while (hasMore) {
      const response = await makeSlackRequest<RepliesResponse>(() => 
        slackClient.conversations.replies({
          channel: conversationId,
          ts: threadTs,
          cursor: cursor || undefined,
          limit: 100,
        }) as Promise<RepliesResponse>
      );
      
      // Skip the first message as it's the thread parent, already stored
      if (replies.length === 0 && response.messages.length > 0) {
        replies.push(...response.messages.slice(1));
      } else {
        replies.push(...response.messages);
      }
      
      hasMore = response.has_more;
      cursor = response.response_metadata?.next_cursor;
    }
    
    return replies;
  } catch (error) {
    logger.error(
      { error, conversationId, threadTs },
      'Failed to fetch thread replies'
    );
    throw error;
  }
}

/**
 * Process and store a message in the database
 */
export async function processMessage(
  message: ConversationHistoryResponse['messages'][0],
  channelId: string,
  conversationDbId: number
) {
  try {
    // Skip messages without a user (system messages)
    if (!message.user || message.type !== 'message') {
      return null;
    }
    
    // Get permalink for the message
    const permalink = await getPermalink(channelId, message.ts);
    
    // Extract mentions
    const mentions = extractMentions(message.text);
    
    // Get user info for mentions (in parallel)
    await Promise.all(mentions.map(userId => getUserInfo(userId)));
    
    // Format reactions if any
    const reactions = message.reactions
      ? message.reactions.reduce((acc, r) => {
          acc[r.name] = r.users;
          return acc;
        }, {} as Record<string, string[]>)
      : undefined;
    
    // Store message in database
    const storedMessage = await prisma.message.upsert({
      where: {
        channel_id_ts: {
          channel_id: conversationDbId,
          ts: message.ts,
        },
      },
      update: {
        text: message.text,
        thread_ts: message.thread_ts,
        permalink,
        reactions,
        mentions,
      },
      create: {
        channel_id: conversationDbId,
        ts: message.ts,
        user_id: message.user,
        text: message.text,
        thread_ts: message.thread_ts,
        permalink,
        reactions,
        mentions,
        createdAt: new Date(),
      },
    });
    
    return storedMessage;
  } catch (error) {
    logger.error(
      { error, messageTs: message.ts, channelId },
      'Failed to process message'
    );
    return null;
  }
}

/**
 * Queue a message from an event for ingestion
 */
export async function queueMessageForIngestion(event: any, client: WebClient) {
  try {
    // Skip non-message events
    if (event.type !== 'message') {
      return;
    }
    
    // Get conversation from database or create it
    const conversationInfo = await makeSlackRequest(() => 
      client.conversations.info({ channel: event.channel })
    );
    
    if (!conversationInfo.channel) {
      logger.error({ event }, 'Failed to get conversation info');
      return;
    }
    
    const conversation = await ensureConversation(conversationInfo.channel as any);
    
    // Process the message
    await processMessage(event as any, event.channel, conversation.id);
    
    // If this is a thread message, update the parent
    if (event.thread_ts && event.thread_ts !== event.ts) {
      const threadInfo = await makeSlackRequest(() => 
        client.conversations.replies({
          channel: event.channel,
          ts: event.thread_ts,
          limit: 1,
        })
      );
      
      if (threadInfo.messages?.length) {
        await processMessage(threadInfo.messages[0] as any, event.channel, conversation.id);
      }
    }
    
    // Update the last processed timestamp for the conversation
    const messageDate = new Date(parseFloat(event.ts) * 1000);
    const lastProcessedDate = conversation.last_ts_processed
      ? new Date(parseFloat(conversation.last_ts_processed) * 1000)
      : null;
    
    if (!lastProcessedDate || messageDate > lastProcessedDate) {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { last_ts_processed: event.ts },
      });
    }
  } catch (error) {
    logger.error({ error, event }, 'Failed to queue message for ingestion');
  }
}

/**
 * Main ingestion function to be called by scheduled jobs
 */
export async function ingestAllConversations(since?: string) {
  try {
    logger.info({ since }, 'Starting ingestion for all conversations');
    
    // List all conversations
    const conversations = await listAllConversations();
    
    // Process each conversation
    for (const conversation of conversations) {
      try {
        // Check if we have access to this conversation
        const conversationInfo = await makeSlackRequest(() => 
          slackClient.conversations.info({ channel: conversation.id })
        );
        
        if (!conversationInfo.channel) {
          logger.warn(
            { conversationId: conversation.id },
            'Cannot access conversation, skipping'
          );
          continue;
        }
        
        // Ensure the conversation exists in the database
        const dbConversation = await ensureConversation(conversation);
        
        // Determine the oldest timestamp to fetch messages from
        let oldest = since;
        if (!oldest && dbConversation.last_ts_processed) {
          oldest = dbConversation.last_ts_processed;
        }
        
        // Fetch messages
        logger.info(
          { 
            channelId: conversation.id, 
            channelName: conversation.name, 
            oldest 
          },
          'Fetching messages'
        );
        
        const messages = await fetchMessages(conversation.id, oldest);
        
        // Process and store messages
        logger.info(
          { channelId: conversation.id, messageCount: messages.length },
          'Processing messages'
        );
        
        let lastTs: string | undefined;
        
        for (const message of messages) {
          await processMessage(message, conversation.id, dbConversation.id);
          
          // Keep track of the latest message timestamp
          if (!lastTs || parseFloat(message.ts) > parseFloat(lastTs)) {
            lastTs = message.ts;
          }
        }
        
        // Update the last processed timestamp
        if (lastTs) {
          await prisma.conversation.update({
            where: { id: dbConversation.id },
            data: { last_ts_processed: lastTs },
          });
        }
        
        logger.info(
          { channelId: conversation.id, processedCount: messages.length },
          'Finished processing conversation'
        );
      } catch (error) {
        logger.error(
          { error, conversationId: conversation.id },
          'Error processing conversation'
        );
      }
      
      // Avoid rate limiting by adding a small delay between conversations
      await sleep(1000);
    }
    
    logger.info('Completed ingestion for all conversations');
  } catch (error) {
    logger.error({ error }, 'Failed to ingest conversations');
    throw error;
  }
}

// Main function to run ingestion as a standalone script
if (require.main === module) {
  const args = process.argv.slice(2);
  let since: string | undefined;
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--since' && i + 1 < args.length) {
      // Convert ISO date to epoch timestamp
      const date = new Date(args[i + 1]);
      since = (date.getTime() / 1000).toString();
      i++;
    }
  }
  
  ingestAllConversations(since)
    .then(() => {
      logger.info('Ingestion complete');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Ingestion failed');
      process.exit(1);
    });
}

export default {
  listAllConversations,
  ensureConversation,
  fetchMessages,
  getPermalink,
  extractMentions,
  processMessage,
  queueMessageForIngestion,
  ingestAllConversations,
};