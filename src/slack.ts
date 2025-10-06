import { App, ExpressReceiver, LogLevel } from '@slack/bolt';
import { WebClient, ErrorCode, WebAPICallResult } from '@slack/web-api';
import config from './config';
import logger from './logger';
import prisma from './store';
import { queueMessageForIngestion } from './ingest';

// Initialize receiver
const receiver = new ExpressReceiver({
  signingSecret: config.SLACK_SIGNING_SECRET,
  clientId: config.SLACK_CLIENT_ID,
  clientSecret: config.SLACK_CLIENT_SECRET,
  stateSecret: 'slack-summarizer-state-secret',
  installationStore: {
    storeInstallation: async (installation) => {
      logger.info('Storing installation');
      
      if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
        // Enterprise installation
        throw new Error('Enterprise installations are not supported yet');
      }
      
      if (installation.team !== undefined) {
        // Team installation
        await prisma.installation.upsert({
          where: {
            team_id: installation.team.id,
          },
          update: {
            team_name: installation.team.name,
            bot_token: installation.bot?.token as string,
            bot_id: installation.bot?.id as string,
            bot_user_id: installation.bot?.userId as string,
            user_id: installation.user?.id,
            user_token: installation.user?.token,
            incoming_webhook_url: installation.incomingWebhook?.url,
            incoming_webhook_channel: installation.incomingWebhook?.channel,
            incoming_webhook_channel_id: installation.incomingWebhook?.channelId,
            updated_at: new Date(),
          },
          create: {
            team_id: installation.team.id,
            team_name: installation.team.name,
            bot_token: installation.bot?.token as string,
            bot_id: installation.bot?.id as string,
            bot_user_id: installation.bot?.userId as string,
            user_id: installation.user?.id,
            user_token: installation.user?.token,
            incoming_webhook_url: installation.incomingWebhook?.url,
            incoming_webhook_channel: installation.incomingWebhook?.channel,
            incoming_webhook_channel_id: installation.incomingWebhook?.channelId,
            installed_at: new Date(),
            updated_at: new Date(),
          },
        });
        return;
      }
      
      throw new Error('Failed saving installation data');
    },
    fetchInstallation: async (installQuery: any) => {
      logger.info('Fetching installation', installQuery);
      
      if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
        // Enterprise installation lookup
        throw new Error('Enterprise installations are not supported yet');
      }
      
      if (installQuery.teamId !== undefined) {
        // Team installation lookup
        const installation = await prisma.installation.findUnique({
          where: {
            team_id: installQuery.teamId,
          },
        });
        
        if (installation) {
          return {
            team: { id: installation.team_id, name: installation.team_name },
            enterprise: undefined,
            user: { id: installation.user_id, token: installation.user_token },
            bot: {
              id: installation.bot_id,
              userId: installation.bot_user_id,
              token: installation.bot_token,
            },
            incomingWebhook: installation.incoming_webhook_url 
              ? {
                  url: installation.incoming_webhook_url,
                  channel: installation.incoming_webhook_channel || '',
                  channelId: installation.incoming_webhook_channel_id || '',
                  configurationUrl: '',
                }
              : undefined,
            isEnterpriseInstall: false,
            authVersion: 'v2',
          };
        }
      }
      
      throw new Error('Failed fetching installation data');
    },
    deleteInstallation: async (installQuery) => {
      logger.info('Deleting installation', installQuery);
      
      if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
        // Enterprise installation deletion
        throw new Error('Enterprise installations are not supported yet');
      }
      
      if (installQuery.teamId !== undefined) {
        // Team installation deletion
        await prisma.installation.delete({
          where: {
            team_id: installQuery.teamId,
          },
        });
        return;
      }
      
      throw new Error('Failed deleting installation data');
    },
  },
  installerOptions: {
    directInstall: true,
    callbackOptions: {
      success: (installation, installOptions, req, res) => {
        // Handle successful installations
        res.writeHead(302, { Location: `${config.BASE_URL}/slack/installation-success` });
        res.end();
      },
      failure: (error, installOptions, req, res) => {
        // Handle failed installations
        logger.error(error, 'Installation failed');
        res.writeHead(302, { Location: `${config.BASE_URL}/slack/installation-error` });
        res.end();
      },
    },
  },
  scopes: [
    'channels:read',
    'groups:read',
    'im:read',
    'mpim:read',
    'channels:history',
    'groups:history',
    'im:history',
    'mpim:history',
    'users:read',
    'users:read.email',
    'reactions:read',
    'chat:write',
    'app_mentions:read',
  ],
});

// Create the Slack app
const app = new App({
  receiver,
  token: config.SLACK_BOT_TOKEN,
  logLevel: config.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
});

// Create a web client for additional functionality
export const slackClient = new WebClient(config.SLACK_BOT_TOKEN);

// Define middleware to catch and handle rate limits
app.use(async ({ next }) => {
  try {
    const result = await next();
    return result;
  } catch (error: any) {
    if (error.code === ErrorCode.RateLimitedError) {
      logger.warn({ retryAfter: error.retryAfter }, 'Rate limited by Slack API');
      // Wait for the specified time and then retry
      await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
      // Next middleware will be called after the timeout
    } else {
      logger.error(error, 'Error in Slack middleware');
      throw error;
    }
  }
});

// Handle app mention events
app.event('app_mention', async ({ event, say }) => {
  try {
    await say({
      text: `Hello <@${event.user}>! I'm Slack Summarizer. I'll generate daily summaries of this channel's activity.`,
      thread_ts: event.thread_ts || event.ts,
    });
  } catch (error) {
    logger.error(error, 'Error handling app_mention event');
  }
});

// Handle all message events
const messageHandler = async ({ event, client }: { event: any, client: any }) => {
  try {
    // Queue the message for ingestion
    await queueMessageForIngestion(event, client);
  } catch (error) {
    logger.error({ error, event }, 'Error handling message event');
  }
};

app.event('message', messageHandler);
app.event('message.channels', messageHandler);
app.event('message.groups', messageHandler);
app.event('message.im', messageHandler);
app.event('message.mpim', messageHandler);

// Handle reaction events
app.event('reaction_added', async ({ event }) => {
  try {
    // Get the message being reacted to
    const { item } = event;
    
    if (item.type === 'message') {
      const { channel, ts } = item;
      
      // Fetch the conversation to get the internal ID
      const conversation = await prisma.conversation.findFirst({
        where: {
          slack_id: channel,
        },
      });
      
      if (!conversation) {
        logger.warn({ channel }, 'Conversation not found when processing reaction');
        return;
      }
      
      // Find the message in the database
      const message = await prisma.message.findUnique({
        where: {
          channel_id_ts: {
            channel_id: conversation.id,
            ts: ts,
          },
        },
      });
      
      if (!message) {
        logger.warn({ channel, ts }, 'Message not found when processing reaction');
        return;
      }
      
      // Get the current reactions
      let reactions = message.reactions as Record<string, string[]> || {};
      
      // Add the new reaction
      if (!reactions[event.reaction]) {
        reactions[event.reaction] = [];
      }
      
      // Add the user if not already present
      if (!reactions[event.reaction].includes(event.user)) {
        reactions[event.reaction].push(event.user);
      }
      
      // Update the message in the database
      await prisma.message.update({
        where: {
          id: message.id,
        },
        data: {
          reactions,
        },
      });
    }
  } catch (error) {
    logger.error({ error, event }, 'Error handling reaction_added event');
  }
});

export default app;
export { receiver };