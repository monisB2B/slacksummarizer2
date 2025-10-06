#!/usr/bin/env node
require('dotenv').config();
const { WebClient } = require('@slack/web-api');
const { PrismaClient } = require('@prisma/client');

// ANSI color codes
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

console.log(`${BOLD}Slack Summarizer Environment Validation${RESET}\n`);

// Required environment variables
const requiredEnvVars = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'SLACK_CLIENT_ID',
  'SLACK_CLIENT_SECRET',
  'DATABASE_URL',
  'DIGEST_CHANNEL'
];

// Optional environment variables
const optionalEnvVars = [
  'DIRECT_URL',
  'OPENAI_API_KEY',
  'BASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'CRON_EXPR',
  'SOFT_DELETE_DAYS'
];

// Check for required environment variables
let missingVars = false;
console.log(`${BOLD}Checking required environment variables:${RESET}`);
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.log(`${RED}✗ ${envVar} is missing${RESET}`);
    missingVars = true;
  } else {
    console.log(`${GREEN}✓ ${envVar} is set${RESET}`);
  }
}

// Check for optional environment variables
console.log(`\n${BOLD}Checking optional environment variables:${RESET}`);
for (const envVar of optionalEnvVars) {
  if (!process.env[envVar]) {
    console.log(`${YELLOW}○ ${envVar} is not set${RESET}`);
  } else {
    console.log(`${GREEN}✓ ${envVar} is set${RESET}`);
  }
}

// If any required vars are missing, exit
if (missingVars) {
  console.log(`\n${RED}${BOLD}Error: Some required environment variables are missing!${RESET}`);
  console.log(`Please check your .env file and ensure all required variables are set.`);
  process.exit(1);
}

// Initialize clients
const prisma = new PrismaClient();
const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

async function validateEnvironment() {
  try {
    // Check database connection
    console.log(`\n${BOLD}Testing database connection...${RESET}`);
    try {
      await prisma.$connect();
      console.log(`${GREEN}✓ Successfully connected to database${RESET}`);
    } catch (dbError) {
      console.log(`${RED}✗ Failed to connect to database: ${dbError.message}${RESET}`);
      throw new Error('Database connection failed');
    }

    // Check Slack token
    console.log(`\n${BOLD}Testing Slack connection...${RESET}`);
    try {
      const auth = await slack.auth.test();
      console.log(`${GREEN}✓ Slack token is valid${RESET}`);
      console.log(`  Bot name: ${auth.user}`);
      console.log(`  Bot ID: ${auth.user_id}`);
      console.log(`  Team: ${auth.team}`);
    } catch (slackError) {
      console.log(`${RED}✗ Failed to authenticate with Slack: ${slackError.message}${RESET}`);
      throw new Error('Slack authentication failed');
    }

    // Check digest channel
    console.log(`\n${BOLD}Checking digest channel...${RESET}`);
    try {
      const channelId = process.env.DIGEST_CHANNEL;
      const channelInfo = await slack.conversations.info({ channel: channelId });
      console.log(`${GREEN}✓ Digest channel is valid${RESET}`);
      console.log(`  Channel name: ${channelInfo.channel.name}`);
      console.log(`  Channel ID: ${channelInfo.channel.id}`);
      
      // Check if bot is a member of the channel
      if (!channelInfo.channel.is_member) {
        console.log(`${YELLOW}○ Warning: Bot is not a member of the digest channel${RESET}`);
        console.log(`  Please invite the bot to the channel using /invite @YourBotName`);
      } else {
        console.log(`${GREEN}✓ Bot is a member of the digest channel${RESET}`);
      }
    } catch (channelError) {
      console.log(`${RED}✗ Failed to access digest channel: ${channelError.message}${RESET}`);
      console.log(`  Please check the DIGEST_CHANNEL value and ensure the bot has been invited to the channel`);
    }

    console.log(`\n${BOLD}Environment validation completed.${RESET}`);
    console.log(`${GREEN}Your environment is ready for deployment.${RESET}`);
    
  } catch (error) {
    console.log(`\n${RED}${BOLD}Environment validation failed:${RESET} ${error.message}`);
    console.log(`Please fix the issues above before deploying the application.`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

validateEnvironment().catch(console.error);