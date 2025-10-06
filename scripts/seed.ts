import { PrismaClient } from '@prisma/client';
import logger from '../src/logger';

// This script seeds the database with test data

const prisma = new PrismaClient();

async function main() {
  logger.info('Starting seed script');

  try {
    // Create test conversations
    const generalChannel = await prisma.conversation.create({
      data: {
        slack_id: 'C01234GENERAL',
        name: 'general',
        type: 'channel',
        last_ts_processed: '1621573200.000000',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const randomChannel = await prisma.conversation.create({
      data: {
        slack_id: 'C01234RANDOM',
        name: 'random',
        type: 'channel',
        last_ts_processed: '1621573200.000000',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Create test users
    const user1 = await prisma.user.create({
      data: {
        slack_id: 'U01234USER1',
        name: 'user1',
        real_name: 'User One',
        email: 'user1@example.com',
        avatar: 'https://example.com/user1.png',
        is_bot: false,
        last_updated: new Date(),
      },
    });

    const user2 = await prisma.user.create({
      data: {
        slack_id: 'U01234USER2',
        name: 'user2',
        real_name: 'User Two',
        email: 'user2@example.com',
        avatar: 'https://example.com/user2.png',
        is_bot: false,
        last_updated: new Date(),
      },
    });

    const botUser = await prisma.user.create({
      data: {
        slack_id: 'U01234BOT',
        name: 'slacksummarizer',
        real_name: 'Slack Summarizer',
        email: null,
        avatar: 'https://example.com/bot.png',
        is_bot: true,
        last_updated: new Date(),
      },
    });

    // Create test messages
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Messages in general channel
    await prisma.message.create({
      data: {
        channel_id: generalChannel.id,
        ts: '1621573200.000001',
        user_id: user1.slack_id,
        text: 'Good morning everyone!',
        permalink: 'https://example.com/archives/C01234GENERAL/p1621573200000001',
        mentions: [],
        createdAt: yesterday,
      },
    });

    await prisma.message.create({
      data: {
        channel_id: generalChannel.id,
        ts: '1621573300.000002',
        user_id: user2.slack_id,
        text: 'Morning! @user1 can you help me with the project today?',
        permalink: 'https://example.com/archives/C01234GENERAL/p1621573300000002',
        mentions: [user1.slack_id],
        createdAt: yesterday,
      },
    });

    await prisma.message.create({
      data: {
        channel_id: generalChannel.id,
        ts: '1621573400.000003',
        user_id: user1.slack_id,
        text: 'Sure @user2, I can help. Let\'s meet at 3pm to discuss.',
        permalink: 'https://example.com/archives/C01234GENERAL/p1621573400000003',
        thread_ts: '1621573300.000002',
        mentions: [user2.slack_id],
        createdAt: yesterday,
      },
    });

    // Messages in random channel
    await prisma.message.create({
      data: {
        channel_id: randomChannel.id,
        ts: '1621574200.000001',
        user_id: user2.slack_id,
        text: 'Check out this cool article: https://example.com/article',
        permalink: 'https://example.com/archives/C01234RANDOM/p1621574200000001',
        mentions: [],
        reactions: {
          '+1': [user1.slack_id],
          'eyes': [user1.slack_id, botUser.slack_id],
        },
        createdAt: yesterday,
      },
    });

    await prisma.message.create({
      data: {
        channel_id: randomChannel.id,
        ts: '1621574300.000002',
        user_id: user1.slack_id,
        text: 'Thanks for sharing! TODO: Read this article by tomorrow.',
        permalink: 'https://example.com/archives/C01234RANDOM/p1621574300000002',
        mentions: [],
        createdAt: yesterday,
      },
    });

    // Create test summary
    await prisma.summary.create({
      data: {
        channel_id: generalChannel.id,
        period_start: new Date(yesterday.setHours(0, 0, 0, 0)),
        period_end: new Date(yesterday.setHours(23, 59, 59, 999)),
        summary: 'Discussion about project collaboration.',
        highlights: [
          {
            text: 'Morning! @user1 can you help me with the project today?',
            permalink: 'https://example.com/archives/C01234GENERAL/p1621573300000002',
            ts: '1621573300.000002',
            user_id: user2.slack_id,
          },
        ],
        tasks: [
          {
            title: 'Meet at 3pm to discuss project',
            owner_user_id: user1.slack_id,
            due_date: new Date().toISOString(),
            confidence: 0.8,
            source_ts: '1621573400.000003',
            source_permalink: 'https://example.com/archives/C01234GENERAL/p1621573400000003',
          },
        ],
        mentions: {
          [user1.slack_id]: {
            count: 1,
            contexts: ['Morning! @user1 can you help me with...'],
          },
          [user2.slack_id]: {
            count: 1,
            contexts: ['Sure @user2, I can help. Let\'s...'],
          },
        },
        createdAt: new Date(),
      },
    });

    logger.info('Seed data created successfully');
  } catch (error) {
    logger.error({ error }, 'Error seeding database');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log('Seeding complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  });