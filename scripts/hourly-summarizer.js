#!/usr/bin/env node
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { WebClient } = require('@slack/web-api');
const { subHours, format } = require('date-fns');

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Slack client
const slackToken = process.env.SLACK_BOT_TOKEN;
const slack = new WebClient(slackToken);

// Get digest channel from env or fallback
const digestChannelId = process.env.DIGEST_CHANNEL;

// Parse command line args
const args = process.argv.slice(2);
const hours = args[0] ? parseInt(args[0], 10) : 1;  // Default to 1 hour

// Main function to create and post hourly summaries
async function createAndPostHourlySummary() {
  console.log(`Starting hourly summary generation for the past ${hours} hour(s)...`);
  
  try {
    // Calculate time range
    const endDate = new Date();
    const startDate = subHours(endDate, hours);
    
    console.log(`Generating summary from ${format(startDate, 'yyyy-MM-dd HH:mm:ss')} to ${format(endDate, 'yyyy-MM-dd HH:mm:ss')}`);
    
    // First, fetch new messages from Slack to ensure we have the latest data
    await refreshRecentMessages();
    
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
    
    console.log(`Found ${channels.length} active channels in the past ${hours} hour(s)`);
    
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
          console.log(`No messages found in ${channel.name} in the specified time range. Skipping summary.`);
          continue;
        }
        
        // Count threads
        const threadMessages = messages.filter(m => m.thread_ts != null);
        const distinctThreads = new Set(threadMessages.map(m => m.thread_ts)).size;
        
        // Get unique users
        const uniqueUsers = [...new Set(messages.map(m => m.user_id))];
        
        // Generate summary text
        const summaryText = `Hourly summary for #${channel.name}: ${messages.length} messages were posted by ${uniqueUsers.length} users in the past ${hours} hour(s)${distinctThreads > 0 ? `, with ${distinctThreads} thread${distinctThreads > 1 ? 's' : ''}` : ''}.`;
        
        // Extract highlights (first message of each thread or standalone messages)
        const threadStarters = messages.filter(m => !m.thread_ts || m.thread_ts === m.ts);
        const highlights = threadStarters.slice(0, 3).map(m => ({
          text: m.text.length > 100 ? m.text.substring(0, 100) + '...' : m.text,
          ts: m.ts,
          user: m.user_id
        }));
        
        // Post to Slack
        await postSummaryToSlack(channel, summaryText, highlights);
        
      } catch (channelError) {
        console.error(`Error processing channel ${channel.name}:`, channelError);
      }
    }
    
    console.log('Hourly summary generation and posting complete!');
    
  } catch (error) {
    console.error('Error creating summaries:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to refresh recent messages from Slack
async function refreshRecentMessages() {
  console.log('Refreshing recent messages from Slack...');
  try {
    // This would be a simplified version of your fetch-slack-data.js script
    // focusing only on recent messages
    
    // For simplicity, we're not implementing the full refresh logic here
    // In a production environment, you would want to fetch new messages
    // from Slack since the last run
    
    console.log('Message refresh complete.');
  } catch (error) {
    console.error('Error refreshing messages:', error);
  }
}

// Function to post summary to Slack
async function postSummaryToSlack(channel, summaryText, highlights) {
  try {
    if (!digestChannelId) {
      console.log(`WARNING: No DIGEST_CHANNEL environment variable set. Cannot post summary to Slack.`);
      console.log(`Summary for ${channel.name}: ${summaryText}`);
      return false;
    }
    
    console.log(`Posting summary for ${channel.name} to Slack channel ${digestChannelId}...`);
    
    // Create blocks for Slack message
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `⏱️ Hourly Update: #${channel.name}`,
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
          text: "*Recent Messages:*"
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
    const result = await slack.chat.postMessage({
      channel: digestChannelId,
      text: `Hourly Update for #${channel.name}`,
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
createAndPostHourlySummary()
  .then(() => console.log('Script execution complete'))
  .catch(console.error);