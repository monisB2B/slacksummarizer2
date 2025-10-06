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

// Get digest channel from env or fallback
const digestChannelId = process.env.DIGEST_CHANNEL || null;

// Main function to create and post daily summaries
async function createAndPostDailySummary() {
  console.log('Starting daily summary generation...');
  
  try {
    // Default to summarizing the last day
    const endDate = new Date();
    const startDate = subDays(endDate, 1);
    
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
        
        // In a real implementation, you would use OpenAI or another service to generate 
        // an intelligent summary. For this example, we'll create a simple one.
        const summaryText = `Daily channel summary for ${channel.name}: ${messages.length} messages were posted by ${uniqueUsers.length} users, with ${distinctThreads} threads.`;
        
        // Extract highlights (in this simplified version, we'll use the first message of each thread)
        const threadStarters = messages.filter(m => !m.thread_ts || m.thread_ts === m.ts);
        const highlights = threadStarters.slice(0, 3).map(m => ({
          text: m.text.length > 100 ? m.text.substring(0, 100) + '...' : m.text,
          ts: m.ts,
          user: m.user_id
        }));
        
        // Create a summary in the database
        const summary = await prisma.summary.create({
          data: {
            channel_id: channel.id,
            period_start: startDate,
            period_end: endDate,
            summary: summaryText,
            highlights: JSON.stringify(highlights),
            tasks: JSON.stringify([]), // No tasks in this simple version
            mentions: JSON.stringify(
              uniqueUsers.map(u => ({ user: u, count: messages.filter(m => m.user_id === u).length }))
            )
          }
        });
        
        console.log(`Created summary for ${channel.name} with ID ${summary.id}`);
        
        // Post to Slack if digest channel is configured
        if (digestChannelId) {
          await postSummaryToSlack(summary, channel, highlights);
        }
        
      } catch (channelError) {
        console.error(`Error processing channel ${channel.name}:`, channelError);
      }
    }
    
    console.log('Daily summary generation complete!');
    
  } catch (error) {
    console.error('Error creating daily summaries:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Function to post summary to Slack
async function postSummaryToSlack(summary, channel, highlights) {
  try {
    console.log(`Posting summary for ${channel.name} to Slack channel ${digestChannelId}...`);
    
    // Create blocks for Slack message
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `📊 Daily Summary: #${channel.name}`,
          emoji: true
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: summary.summary
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
    const result = await slack.chat.postMessage({
      channel: digestChannelId,
      text: `Daily Summary for #${channel.name}`,
      blocks: blocks
    });
    
    console.log(`Posted summary to Slack, message ID: ${result.ts}`);
    
  } catch (error) {
    console.error('Error posting summary to Slack:', error);
  }
}

// Run the main function
createAndPostDailySummary()
  .then(() => console.log('Script execution complete'))
  .catch(console.error);