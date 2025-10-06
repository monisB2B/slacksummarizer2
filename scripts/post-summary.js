#!/usr/bin/env node
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { WebClient } = require('@slack/web-api');
const { subDays } = require('date-fns');

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Slack client
const slackToken = process.env.SLACK_BOT_TOKEN;
const slack = new WebClient(slackToken);

// Get digest channel from env or fallback to the specific channel we know works
const digestChannelId = process.env.DIGEST_CHANNEL || 'C09JV3TQR8V';

// Parse command line args
const args = process.argv.slice(2);
const days = args[0] ? parseInt(args[0], 10) : 7;  // Default to 7 days instead of 1

// Main function to create and post daily summaries
async function createAndPostSummary() {
  console.log(`Starting summary generation for last ${days} days...`);
  
  try {
    // Use the specified number of days
    const endDate = new Date();
    const startDate = subDays(endDate, days);
    
    console.log(`Generating summary from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
    
    // Get active channels
    const channels = await prisma.conversation.findMany({
      where: {
        messages: {
          some: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`Found ${channels.length} active channels`);
    
    if (channels.length === 0) {
      console.log('No active channels found. No summary to generate.');
      return;
    }
    
    // For each active channel, generate a summary
    for (const channel of channels) {
      try {
        console.log(`Generating summary for ${channel.name} (${channel.slack_id})...`);
        
        // Get messages for this channel
        const messages = await prisma.message.findMany({
          where: {
            channel_id: channel.id,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        });
        
        if (messages.length === 0) {
          console.log(`No messages found in ${channel.name}. Skipping summary.`);
          continue;
        }
        
        // Count threads
        const threadMessages = messages.filter(m => m.thread_ts != null);
        const distinctThreads = new Set(threadMessages.map(m => m.thread_ts)).size;
        
        // Get unique users
        const uniqueUsers = [...new Set(messages.map(m => m.user_id))];
        
        // Get existing summary if available
        const existingSummary = await prisma.summary.findFirst({
          where: {
            channel_id: channel.id,
            period_start: {
              lte: endDate
            },
            period_end: {
              gte: startDate
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        });
        
        let summaryText, highlights;
        
        if (existingSummary) {
          console.log(`Found existing summary for ${channel.name}, using that content`);
          summaryText = existingSummary.summary;
          
          try {
            highlights = typeof existingSummary.highlights === 'string'
              ? JSON.parse(existingSummary.highlights)
              : existingSummary.highlights;
          } catch (e) {
            console.error('Error parsing highlights:', e);
            highlights = [];
          }
        } else {
          // In a real implementation, you would use OpenAI or another service
          // For this example, we'll create a simple summary
          summaryText = `${days}-day summary for #${channel.name}: ${messages.length} messages were posted by ${uniqueUsers.length} users, with ${distinctThreads} threads.`;
          
          // Extract highlights (first message of each thread)
          const threadStarters = messages.filter(m => !m.thread_ts || m.thread_ts === m.ts);
          highlights = threadStarters.slice(0, 3).map(m => ({
            text: m.text.length > 100 ? m.text.substring(0, 100) + '...' : m.text,
            ts: m.ts,
            user: m.user_id
          }));
        }
        
        // Post to Slack if digest channel is configured
        if (digestChannelId) {
          await postSummaryToSlack(channel, summaryText, highlights);
        } else {
          console.log('No digest channel configured. Summary not posted.');
          console.log('Summary text:', summaryText);
        }
        
      } catch (channelError) {
        console.error(`Error processing channel ${channel.name}:`, channelError);
      }
    }
    
    console.log('Summary generation and posting complete!');
    
  } catch (error) {
    console.error('Error creating summaries:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to post summary to Slack
async function postSummaryToSlack(channel, summaryText, highlights) {
  try {
    console.log(`Posting summary for ${channel.name} to Slack channel C09JV3TQR8V...`);
    
    // Create blocks for Slack message
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `📊 Channel Summary: #${channel.name}`,
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: summaryText
        }
      },
      {
        type: "divider"
      }
    ];
    
    // Add highlights if available
    if (highlights && highlights.length > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Highlights:*"
        }
      });
      
      for (const highlight of highlights) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `• ${highlight.text}`
          }
        });
      }
    }
    
    // Send message to Slack
    // Explicitly use the channel ID we know works
    const targetChannelId = 'C09JV3TQR8V';
    console.log(`Attempting to post to channel ID: ${targetChannelId}`);
    
    const result = await slack.chat.postMessage({
      channel: targetChannelId,
      text: `Channel Summary for #${channel.name}`,
      blocks: blocks
    });
    
    console.log(`Posted summary to Slack, message ID: ${result.ts}`);
    return true;
    
  } catch (error) {
    console.error('Error posting summary to Slack:', error);
    console.log('Error details:', JSON.stringify(error, null, 2));
    return false;
  }
}

// Run the main function
createAndPostSummary()
  .then(() => console.log('Script execution complete'))
  .catch(console.error);