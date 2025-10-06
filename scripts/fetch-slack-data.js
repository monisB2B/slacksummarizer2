#!/usr/bin/env node
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { WebClient } = require('@slack/web-api');
const { subDays, formatISO } = require('date-fns');

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize Slack client
const slackToken = process.env.SLACK_BOT_TOKEN;
const slack = new WebClient(slackToken);

// Parse command line arguments
const args = process.argv.slice(2);
const sinceDaysArg = args.find(arg => arg.startsWith('--days='));
const sinceDays = sinceDaysArg 
  ? parseInt(sinceDaysArg.split('=')[1], 10) 
  : 60; // Default to 60 days

// Calculate the start date
const startDate = subDays(new Date(), sinceDays);
const startTimestamp = Math.floor(startDate.getTime() / 1000);

// Main function
async function fetchSlackData() {
  try {
    console.log(`Starting to fetch Slack data from the past ${sinceDays} days (since ${startDate.toLocaleDateString()})...`);
    
    // Step 1: Get all channels where the bot is a member
    console.log('Fetching channels...');
    const { channels } = await slack.conversations.list({
      exclude_archived: true,
      types: 'public_channel,private_channel'
    });
    
    console.log(`Found ${channels.length} channels. Checking bot membership...`);
    
    // Filter for channels where the bot is a member
    const botChannels = [];
    
    for (const channel of channels) {
      try {
        // Check if the bot can access this channel by fetching info
        await slack.conversations.info({ channel: channel.id });
        botChannels.push(channel);
        console.log(`✓ Bot has access to #${channel.name} (${channel.id})`);
      } catch (error) {
        console.log(`✗ Bot does not have access to #${channel.name} (${channel.id})`);
      }
    }
    
    console.log(`Bot has access to ${botChannels.length} channels`);
    
    // Step 2: Store channels in the database
    for (const channel of botChannels) {
      // Map Slack channel type to our ConversationType enum
      const channelType = channel.is_private ? 'group' : 'channel';
      
      await prisma.conversation.upsert({
        where: { slack_id: channel.id },
        update: {
          name: channel.name,
          type: channelType,
          updatedAt: new Date()
        },
        create: {
          slack_id: channel.id,
          name: channel.name,
          type: channelType,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }
    
    // Step 3: Get users
    console.log('Fetching users...');
    const { members } = await slack.users.list();
    
    console.log(`Found ${members.length} users. Storing in database...`);
    
    // Store users in the database
    for (const member of members) {
      // Skip deleted users
      if (member.deleted) continue;
      
      await prisma.user.upsert({
        where: { slack_id: member.id },
        update: {
          name: member.name,
          real_name: member.real_name || member.name,
          email: member.profile?.email || null,
          avatar: member.profile?.image_72 || null,
          is_bot: member.is_bot || false,
          last_updated: new Date()
        },
        create: {
          slack_id: member.id,
          name: member.name,
          real_name: member.real_name || member.name,
          email: member.profile?.email || null,
          avatar: member.profile?.image_72 || null,
          is_bot: member.is_bot || false,
          last_updated: new Date()
        }
      });
    }
    
    // Step 4: Fetch messages from each channel
    console.log('Fetching messages from channels...');
    
    let totalMessages = 0;
    
    for (const channel of botChannels) {
      console.log(`\nFetching messages from #${channel.name} (${channel.id})...`);
      
      const dbChannel = await prisma.conversation.findUnique({
        where: { slack_id: channel.id }
      });
      
      if (!dbChannel) {
        console.error(`Channel ${channel.name} not found in database. Skipping.`);
        continue;
      }
      
      try {
        let cursor;
        let hasMore = true;
        let channelMessages = 0;
        
        while (hasMore) {
          const params = {
            channel: channel.id,
            oldest: startTimestamp.toString(),
            limit: 100,
            ...(cursor ? { cursor } : {})
          };
          
          const result = await slack.conversations.history(params);
          const messages = result.messages || [];
          
          if (messages.length > 0) {
            console.log(`Processing batch of ${messages.length} messages...`);
            
            // Store each message in the database
            for (const message of messages) {
              // Skip bot messages and non-standard messages without text
              if (!message.text || message.subtype) continue;
              
              // Find or create the user
              let userId;
              
              if (message.user) {
                const dbUser = await prisma.user.findUnique({
                  where: { slack_id: message.user }
                });
                
                if (dbUser) {
                  userId = dbUser.slack_id;
                } else {
                  try {
                    // Try to fetch and create the user if missing
                    const userInfo = await slack.users.info({ user: message.user });
                    const user = userInfo.user;
                    
                    const createdUser = await prisma.user.create({
                      data: {
                        slack_id: user.id,
                        name: user.name,
                        real_name: user.real_name || user.name,
                        email: user.profile?.email || null,
                        avatar: user.profile?.image_72 || null,
                        is_bot: user.is_bot || false,
                        last_updated: new Date()
                      }
                    });
                    
                    userId = createdUser.slack_id;
                  } catch (error) {
                    console.warn(`Could not fetch user info for ID ${message.user}: ${error.message}`);
                    // Create a placeholder user if we can't fetch details
                    const createdUser = await prisma.user.create({
                      data: {
                        slack_id: message.user,
                        name: `unknown-${message.user}`,
                        real_name: `Unknown User (${message.user})`,
                        is_bot: false,
                        last_updated: new Date()
                      }
                    });
                    
                    userId = createdUser.slack_id;
                  }
                }
              }
              
              if (!userId) {
                console.warn(`Skipping message without user ID: ${message.text.substring(0, 20)}...`);
                continue;
              }
              
              // Format the message timestamp as a Date
              const ts = message.ts;
              const createdAt = new Date(parseFloat(message.ts) * 1000);
              
              // Check for thread messages
              const thread_ts = message.thread_ts !== message.ts ? message.thread_ts : null;
              
              try {
                // Use the channel_id_ts compound key
                await prisma.message.upsert({
                  where: {
                    channel_id_ts: {
                      channel_id: dbChannel.id,
                      ts: ts
                    }
                  },
                  update: {
                    text: message.text,
                    thread_ts: thread_ts,
                  },
                  create: {
                    ts: ts,
                    channel_id: dbChannel.id,
                    user_id: userId,
                    text: message.text,
                    thread_ts: thread_ts,
                    permalink: message.permalink || `https://slack.com/archives/${channel.id}/p${ts.replace('.', '')}`,
                    mentions: message.blocks?.find(b => b.type === 'rich_text')?.elements?.filter(e => e.type === 'user')?.map(e => e.user_id) || [],
                    createdAt: createdAt
                  }
                });
                
                channelMessages++;
                totalMessages++;
              } catch (error) {
                console.error(`Error storing message: ${error.message}`);
                console.error(`Message data: ${JSON.stringify({
                  ts,
                  channel_id: dbChannel.id,
                  user_id: userId,
                  text: message.text.substring(0, 50),
                  thread_ts,
                  createdAt
                })}`);
              }
            }
          }
          
          // Check if we need to paginate
          cursor = result.response_metadata?.next_cursor;
          hasMore = !!cursor;
          
          // If we have more pages, add a small delay to avoid rate limits
          if (hasMore) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
        
        console.log(`Fetched and stored ${channelMessages} messages from #${channel.name}`);
      } catch (error) {
        console.error(`Error fetching messages from ${channel.name}: ${error.message}`);
      }
    }
    
    console.log(`\nCompleted Slack data import!`);
    console.log(`Total channels processed: ${botChannels.length}`);
    console.log(`Total messages imported: ${totalMessages}`);
    console.log(`Date range: ${startDate.toLocaleDateString()} - ${new Date().toLocaleDateString()}`);
    
  } catch (error) {
    console.error('Error fetching Slack data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the main function
fetchSlackData()
  .then(() => console.log('Script complete'))
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });