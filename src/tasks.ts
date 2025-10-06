import cron from 'node-cron';
import { subDays } from 'date-fns';
import logger from './logger';
import config from './config';
import prisma from './store';
import { ingestAllConversations } from './ingest';
import { generateSummaryForTimeWindow, postSummaryToSlack } from './summarize';
import { softDeleteOldMessages } from './store';

/**
 * Main task to run daily:
 * 1. Ingest new messages since the last run
 * 2. Generate summaries for each conversation
 * 3. Post summaries to the digest channel
 */
export async function runDailyTask() {
  try {
    logger.info('Starting daily scheduled task');

    // 1. Ingest new messages from all conversations
    logger.info('Starting message ingestion');
    await ingestAllConversations();
    logger.info('Message ingestion completed');

    // 2. Generate summaries for each conversation for the past day
    const now = new Date();
    const oneDayAgo = subDays(now, 1);

    logger.info({ from: oneDayAgo, to: now }, 'Generating summaries for time window');

    // Get all conversations
    const conversations = await prisma.conversation.findMany();

    // Generate summaries for each conversation
    const summaryPromises = conversations.map(async (conversation) => {
      try {
        const summary = await generateSummaryForTimeWindow(conversation.id, oneDayAgo, now);
        return summary;
      } catch (error) {
        logger.error({ error, conversationId: conversation.id }, 'Failed to generate summary');
        return null;
      }
    });

    const summaries = (await Promise.all(summaryPromises)).filter(Boolean);
    logger.info({ count: summaries.length }, 'Generated summaries');

    // 3. Post summaries to the digest channel
    if (summaries.length > 0 && config.DIGEST_CHANNEL) {
      logger.info({ channel: config.DIGEST_CHANNEL }, 'Posting summaries to digest channel');

      for (const summary of summaries) {
        try {
          await postSummaryToSlack(summary!.id);
        } catch (error) {
          logger.error({ error, summaryId: summary!.id }, 'Failed to post summary to Slack');
        }
      }
    }

    // 4. Soft delete old messages if configured
    if (config.SOFT_DELETE_DAYS) {
      logger.info({ days: config.SOFT_DELETE_DAYS }, 'Soft deleting old messages');
      await softDeleteOldMessages(config.SOFT_DELETE_DAYS);
    }

    logger.info('Completed daily scheduled task');
  } catch (error) {
    logger.error({ error }, 'Failed to run daily task');
    throw error;
  }
}

/**
 * Initialize scheduled tasks
 */
export function initializeScheduledTasks() {
  logger.info({ cronExpression: config.CRON_EXPR }, 'Scheduling daily task');

  cron.schedule(config.CRON_EXPR, () => {
    runDailyTask().catch((error) => {
      logger.error({ error }, 'Error in scheduled task');
    });
  });

  logger.info('Scheduled tasks initialized');
}

// If this file is run directly, execute the daily task once
if (require.main === module) {
  runDailyTask()
    .then(() => {
      logger.info('Daily task executed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ error }, 'Failed to execute daily task');
      process.exit(1);
    });
}

export default {
  runDailyTask,
  initializeScheduledTasks,
};