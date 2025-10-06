import { PrismaClient } from '@prisma/client';
import logger from './logger';

const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'error',
    },
    {
      emit: 'event',
      level: 'info',
    },
    {
      emit: 'event',
      level: 'warn',
    },
  ],
});

// Logging middleware
prisma.$on('query', (e) => {
  logger.debug(e, 'Prisma Query');
});

prisma.$on('error', (e) => {
  logger.error(e, 'Prisma Error');
});

prisma.$on('info', (e) => {
  logger.info(e, 'Prisma Info');
});

prisma.$on('warn', (e) => {
  logger.warn(e, 'Prisma Warning');
});

/**
 * Store model helper functions
 */

export async function softDeleteOldMessages(days: number) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const deletedCount = await prisma.message.deleteMany({
    where: {
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  logger.info({ count: deletedCount.count }, `Deleted ${deletedCount.count} messages older than ${days} days`);
  return deletedCount;
}

export default prisma;