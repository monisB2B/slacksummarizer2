#!/usr/bin/env node
require('dotenv').config();
const { WebClient } = require('@slack/web-api');

// Initialize Slack client
const slackToken = process.env.SLACK_BOT_TOKEN;

if (!slackToken) {
  console.error('Error: SLACK_BOT_TOKEN not found in environment variables');
  process.exit(1);
}

const slack = new WebClient(slackToken);

// ANSI color codes
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

async function listChannels() {
  console.log(`${BOLD}Slack Channel Finder${RESET}`);
  console.log('Listing all channels the bot has access to...\n');

  try {
    // Get bot info
    const authTest = await slack.auth.test();
    console.log(`${YELLOW}Connected as: ${authTest.user} (${authTest.user_id})${RESET}`);
    console.log(`${YELLOW}Team: ${authTest.team} (${authTest.team_id})${RESET}\n`);

    // Get public channels
    const publicChannels = await slack.conversations.list({
      types: 'public_channel',
      exclude_archived: true
    });

    // Get private channels where the bot is a member
    const privateChannels = await slack.conversations.list({
      types: 'private_channel',
      exclude_archived: true
    });

    // Process the results
    const channels = [
      ...publicChannels.channels.map(c => ({ ...c, type: 'public' })),
      ...privateChannels.channels.map(c => ({ ...c, type: 'private' }))
    ];

    // Filter to only include channels where the bot is a member
    const botChannels = channels.filter(channel => channel.is_member);

    // Sort by name
    botChannels.sort((a, b) => a.name.localeCompare(b.name));

    if (botChannels.length === 0) {
      console.log('No channels found where the bot is a member.');
      console.log('Please invite the bot to at least one channel using: /invite @YourBotName');
    } else {
      console.log(`${BOLD}Available channels for digest (${botChannels.length}):${RESET}`);
      console.log(`${CYAN}(Only channels where the bot is a member are shown)${RESET}\n`);
      console.log('┌────────────────────┬────────────────────┬──────────┐');
      console.log('│ Channel Name       │ Channel ID         │ Type     │');
      console.log('├────────────────────┼────────────────────┼──────────┤');

      for (const channel of botChannels) {
        const name = channel.name.padEnd(18).substring(0, 18);
        const id = channel.id.padEnd(18).substring(0, 18);
        const type = channel.type.padEnd(8).substring(0, 8);
        console.log(`│ ${name} │ ${id} │ ${type} │`);
      }

      console.log('└────────────────────┴────────────────────┴──────────┘\n');

      // Current setting
      const currentDigestChannel = process.env.DIGEST_CHANNEL;
      if (currentDigestChannel) {
        const foundChannel = botChannels.find(c => c.id === currentDigestChannel);
        if (foundChannel) {
          console.log(`${GREEN}Current DIGEST_CHANNEL is set to: ${foundChannel.name} (${currentDigestChannel})${RESET}`);
        } else {
          console.log(`${YELLOW}Warning: Current DIGEST_CHANNEL (${currentDigestChannel}) is not found in the list of accessible channels.${RESET}`);
          console.log('Please update your .env file with one of the channel IDs listed above.');
        }
      } else {
        console.log(`${YELLOW}DIGEST_CHANNEL is not set in your .env file.${RESET}`);
        console.log('Please set it to one of the channel IDs listed above.');
      }

      // Instructions
      console.log('\nTo set a digest channel, add this to your .env file:');
      console.log(`${CYAN}DIGEST_CHANNEL=CHANNEL_ID_HERE${RESET}`);
      console.log('\nReplace CHANNEL_ID_HERE with the ID of your chosen channel from the list above.');
    }
  } catch (error) {
    console.error('Error accessing Slack channels:', error.message);
    if (error.data && error.data.error) {
      console.error('Slack error:', error.data.error);
    }
  }
}

listChannels().catch(console.error);