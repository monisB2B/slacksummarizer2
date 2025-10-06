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
const digestChannelId = process.env.DIGEST_CHANNEL || 'C09JV3TQR8V';

// Parse command line args
const args = process.argv.slice(2);
const hours = args[0] ? parseInt(args[0], 10) : 1; // Default to 1 hour

// Main function to create and post hourly summaries
async function createAndPostHourlySummary() {
  console.log(`Starting hourly summary generation for the last ${hours} hour(s)...`);
  
  try {
    // Use the specified number of hours
    const endDate = new Date();
    const startDate = subHours(endDate, hours);
    
    console.log(`Generating summary from ${format(startDate, 'MMM dd, yyyy HH:mm')} to ${format(endDate, 'MMM dd, yyyy HH:mm')}`);
    
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
      console.log('No active channels found in the specified time period. No summary to generate.');
      return;
    }
    
    // For each active channel, generate a summary
    for (const channel of channels) {
      try {
        console.log(`Generating summary for #${channel.name} (${channel.slack_id})...`);
        
        // Get messages for this channel in the specified time range
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
          console.log(`No messages found in #${channel.name} during the specified time period. Skipping summary.`);
          continue;
        }
        
        // Count threads
        const threadMessages = messages.filter(m => m.thread_ts != null);
        const distinctThreads = new Set(threadMessages.map(m => m.thread_ts)).size;
        
        // Get unique users
        const uniqueUsers = [...new Set(messages.map(m => m.user_id))];
        
        // Prepare summary text
        const timeframe = hours === 1 ? 'hour' : `${hours} hours`;
        const summaryText = `In the past ${timeframe}, #${channel.name} had ${messages.length} messages from ${uniqueUsers.length} users, with ${distinctThreads} thread(s).`;
        
        // Extract highlights (first message of each thread or standalone messages)
        const highlights = [];
        
        // Get thread starters
        const threadStarters = messages.filter(m => !m.thread_ts || m.thread_ts === m.ts);
        
        // Take up to 3 most recent messages for highlights
        const recentMessages = threadStarters.slice(-3).reverse();
        
        for (const msg of recentMessages) {
          // Get user info
          const userInfo = await prisma.user.findFirst({
            where: { slack_id: msg.user_id }
          });
          
          const userName = userInfo?.name || 'Unknown User';
          
          // Truncate message if too long
          const messageText = msg.text.length > 100 ? msg.text.substring(0, 100) + '...' : msg.text;
          
          highlights.push({
            text: messageText,
            user: userName,
            ts: msg.ts
          });
        }
        
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

// Function to post summary to Slack
async function postSummaryToSlack(channel, summaryText, highlights) {
  try {
    console.log(`Posting summary for ${channel.name} to Slack channel ${digestChannelId}...`);
    
    // Explicitly use the channel ID we know works
    const targetChannelId = 'C09JV3TQR8V';
    console.log(`Attempting to post to channel ID: ${targetChannelId}`);
    
    // Create blocks for Slack message
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `⏰ Hourly Update: #${channel.name}`,
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
            text: `• @${highlight.user}: ${highlight.text}`
          }
        });
      }
    }
    
    // Add timestamp
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `_Summary generated at ${format(new Date(), 'MMM dd, yyyy HH:mm')}_`
        }
      ]
    });
    
    // Send message to Slack
    const result = await slack.chat.postMessage({
      channel: targetChannelId,
      text: `Hourly Update for #${channel.name}`,
      blocks: blocks
    });
    
    console.log(`Posted summary to Slack, message ID: ${result.ts}`);
    return true;
    
  } catch (error) {
    console.error('Error posting summary to Slack:', error);
    return false;
  }
}

// Run the main function
createAndPostHourlySummary()
  .then(() => console.log('Script execution complete'))
  .catch(console.error);