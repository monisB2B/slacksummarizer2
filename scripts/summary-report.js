require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { subDays } = require('date-fns');

// Initialize Prisma client
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function generateSummaryReport(days) {
  console.log(`Generating summary report for the last ${days} days...`);
  
  // Calculate start date (N days ago)
  const startDate = subDays(new Date(), days);
  console.log(`Start date: ${startDate.toISOString()}`);
  
  try {
    // Get overall message statistics
    const totalMessages = await prisma.message.count({
      where: {
        createdAt: {
          gte: startDate
        }
      }
    });
    
    // Get thread messages count
    const threadMessages = await prisma.message.count({
      where: {
        thread_ts: {
          not: null
        },
        createdAt: {
          gte: startDate
        }
      }
    });
    
    // Get distinct thread count using a raw query
    const distinctThreadsResult = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT thread_ts) as thread_count
      FROM "Message"
      WHERE thread_ts IS NOT NULL
      AND "createdAt" >= ${startDate}
    `;
    const distinctThreads = parseInt(distinctThreadsResult[0]?.thread_count || '0');
    
    // Get total summaries
    const totalSummaries = await prisma.summary.count({
      where: {
        createdAt: {
          gte: startDate
        }
      }
    });
    
    // Get user statistics
    const activeUsersResult = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT user_id) as user_count
      FROM "Message"
      WHERE "createdAt" >= ${startDate}
    `;
    const activeUsers = parseInt(activeUsersResult[0]?.user_count || '0');
    
    // Get list of channels
    const channels = await prisma.conversation.findMany({
      orderBy: {
        name: 'asc'
      }
    });
    
    console.log(`\n====== SUMMARY REPORT: LAST ${days} DAYS ======`);
    console.log(`Period: ${startDate.toLocaleDateString()} to ${new Date().toLocaleDateString()}`);
    console.log(`\nOVERALL STATISTICS:`);
    console.log(`- Total Messages: ${totalMessages}`);
    console.log(`- Thread Messages: ${threadMessages}`);
    console.log(`- Distinct Threads: ${distinctThreads}`);
    console.log(`- Total Summaries: ${totalSummaries}`);
    console.log(`- Active Users: ${activeUsers}`);
    console.log(`- Total Channels: ${channels.length}`);
    
    // Show channel-specific data
    console.log(`\nCHANNEL ACTIVITY:`);
    
    if (channels.length === 0) {
      console.log('No channels found in the database.');
    } else {
      // For each channel, get activity data
      for (const channel of channels) {
        // Get messages in this channel
        const channelMessages = await prisma.message.count({
          where: {
            channel_id: channel.id,
            createdAt: {
              gte: startDate
            }
          }
        });
        
        // Skip channels with no activity
        if (channelMessages === 0) {
          continue;
        }
        
        console.log(`\n--- ${channel.name} (${channel.type}) ---`);
        
        // Get thread count for this channel
        const channelThreadsResult = await prisma.$queryRaw`
          SELECT COUNT(DISTINCT thread_ts) as thread_count
          FROM "Message"
          WHERE thread_ts IS NOT NULL
          AND channel_id = ${channel.id}
          AND "createdAt" >= ${startDate}
        `;
        const channelThreads = parseInt(channelThreadsResult[0]?.thread_count || '0');
        
        // Get unique users in this channel
        const channelUsersResult = await prisma.$queryRaw`
          SELECT COUNT(DISTINCT user_id) as user_count
          FROM "Message"
          WHERE channel_id = ${channel.id}
          AND "createdAt" >= ${startDate}
        `;
        const channelUsers = parseInt(channelUsersResult[0]?.user_count || '0');
        
        console.log(`Messages: ${channelMessages} | Threads: ${channelThreads} | Active Users: ${channelUsers}`);
        
        // Get the most recent summary
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
        
        if (recentSummary) {
          console.log(`\nLatest Summary (${recentSummary.createdAt.toLocaleDateString()}):`);
          console.log(recentSummary.summary);
          
          // Display highlights
          try {
            // Parse the highlights which might be stored as a JSON string
            const highlightsRaw = typeof recentSummary.highlights === 'string' 
              ? JSON.parse(recentSummary.highlights) 
              : recentSummary.highlights;
              
            const highlights = Array.isArray(highlightsRaw) ? highlightsRaw : [];
            
            if (highlights && highlights.length > 0) {
              console.log('\nHighlights:');
              highlights.forEach((highlight, i) => {
                if (typeof highlight === 'string') {
                  console.log(`${i+1}. ${highlight}`);
                } else {
                  console.log(`${i+1}. ${highlight.text || highlight.message || JSON.stringify(highlight)}`);
                }
              });
            }
          } catch (e) {
            console.log('\nCould not parse highlights:', e.message);
          }
        } else {
          console.log('No summaries available for this period.');
        }
      }
    }
    
  } catch (error) {
    console.error('Error generating summary report:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Get command line argument for days or default to 60
const days = process.argv[2] ? parseInt(process.argv[2], 10) : 60;

// Execute the summary report
generateSummaryReport(days)
  .then(() => console.log('\nSummary report generation complete.'))
  .catch(console.error);