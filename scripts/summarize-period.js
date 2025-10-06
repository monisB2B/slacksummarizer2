require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { subDays } = require('date-fns');

// Initialize Prisma client
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Test database connection
async function testConnection() {
  try {
    console.log('Testing database connection...');
    await prisma.$connect();
    console.log('Database connection successful!');
    
    // List all models in the database
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `;
    
    console.log('\nAvailable tables:');
    tables.forEach(table => console.log(`- ${table.tablename}`));
    
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Function to generate summary for the last N days
async function generateSummaryForLastDays(days) {
  console.log(`Generating summary for the last ${days} days...`);
  
  // Calculate start date (N days ago)
  const startDate = subDays(new Date(), days);
  
  console.log(`Start date: ${startDate.toISOString()}`);
  
  try {
    // Get channels from the Conversation model
    console.log('Looking for channels in the data...');
    
    const channels = await prisma.conversation.findMany({
      select: {
        id: true,
        slack_id: true,
        name: true,
        type: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`Found ${channels.length} channels`);
    
    // For each channel, get conversation statistics
    for (const channel of channels) {
      console.log(`\n--- Channel: ${channel.name} (${channel.slack_id}) ---`);
      console.log(`Type: ${channel.type}, Created: ${channel.createdAt.toISOString()}`);
      
      // Get messages in this channel since the start date
      const messageCount = await prisma.message.count({
        where: {
          channel_id: channel.id,
          createdAt: {
            gte: startDate
          }
        }
      });
      
      // Get users who participated in this channel
      const participantsQuery = await prisma.$queryRaw`
        SELECT DISTINCT "user_id" FROM "Message"
        WHERE "channel_id" = ${channel.id}
        AND "createdAt" >= ${startDate}
      `;
      const participantCount = participantsQuery.length;
      
      // Get thread statistics - count messages with thread_ts
      const threadCount = await prisma.message.count({
        where: {
          channel_id: channel.id,
          thread_ts: {
            not: null
          },
          createdAt: {
            gte: startDate
          }
        },
        distinct: ['thread_ts']
      });
      
      // Get reaction statistics from the message JSON field
      const messagesWithReactions = await prisma.message.count({
        where: {
          channel_id: channel.id,
          reactions: {
            not: null
          },
          createdAt: {
            gte: startDate
          }
        }
      });
      
      // Get most recent summary
      const recentSummary = await prisma.summary.findFirst({
        where: {
          channel_id: channel.id,
          createdAt: {
            gte: startDate
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      console.log(`Messages: ${messageCount}`);
      console.log(`Participants: ${participantCount}`);
      console.log(`Threads: ${threadCount}`);
      console.log(`Messages with Reactions: ${messagesWithReactions}`);
      
      if (recentSummary) {
        console.log(`\nMost recent summary (${recentSummary.createdAt}):`);
        console.log(recentSummary.summary);
        
        console.log('\nHighlights:');
        console.log(JSON.stringify(recentSummary.highlights, null, 2));
      } else {
        console.log(`\nNo summaries found for this channel in the last ${days} days.`);
      }
    }
    
    // Get overall statistics
    const totalMessages = await prisma.message.count({
      where: {
        createdAt: {
          gte: startDate
        }
      }
    });
    
    const totalThreads = await prisma.message.count({
      where: {
        thread_ts: {
          not: null
        },
        createdAt: {
          gte: startDate
        }
      },
      distinct: ['thread_ts', 'channel_id']
    });
    
    const totalSummaries = await prisma.summary.count({
      where: {
        createdAt: {
          gte: startDate
        }
      }
    });
    
    // Get user statistics
    const activeUsers = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT "user_id") as "userCount" 
      FROM "Message" 
      WHERE "createdAt" >= ${startDate}
    `;
    
    console.log(`\n=== OVERALL STATISTICS (Last ${days} days) ===`);
    console.log(`Total Messages: ${totalMessages}`);
    console.log(`Total Threads: ${totalThreads}`);
    console.log(`Total Summaries: ${totalSummaries}`);
    console.log(`Active Users: ${activeUsers[0]?.userCount || 0}`);
    
  } catch (error) {
    console.error('Error generating summary:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get days argument from command line or default to 60
const days = process.argv[2] ? parseInt(process.argv[2]) : 60;

// First test connection, then run summary if successful
async function main() {
  try {
    const isConnected = await testConnection();
    if (isConnected) {
      await generateSummaryForLastDays(days);
      console.log('Summary generation complete');
    } else {
      console.log('Aborting summary generation due to database connection issues');
    }
  } catch (error) {
    console.error('Error in main execution:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();