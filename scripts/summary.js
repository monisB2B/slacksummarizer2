#!/usr/bin/env node
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { subDays, parseISO } = require('date-fns');

// Initialize Prisma client
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    days: 60,
    startDate: null,
    endDate: null,
    channel: null,
    format: 'text'
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--days' || arg === '-d') {
      options.days = parseInt(args[++i], 10);
    } else if (arg === '--start' || arg === '-s') {
      options.startDate = parseISO(args[++i]);
    } else if (arg === '--end' || arg === '-e') {
      options.endDate = parseISO(args[++i]);
    } else if (arg === '--channel' || arg === '-c') {
      options.channel = args[++i];
    } else if (arg === '--format' || arg === '-f') {
      options.format = args[++i].toLowerCase();
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }
  
  // Calculate dates if not provided
  if (!options.startDate) {
    options.startDate = options.days ? subDays(new Date(), options.days) : subDays(new Date(), 60);
  }
  
  if (!options.endDate) {
    options.endDate = new Date();
  }
  
  return options;
}

function showHelp() {
  console.log(`
Slack Summarizer - Activity Report Generator

USAGE:
  node summary.js [OPTIONS]

OPTIONS:
  --days, -d NUM       Summarize the last NUM days (default: 60)
  --start, -s DATE     Start date in ISO format (e.g., 2025-08-01)
  --end, -e DATE       End date in ISO format (e.g., 2025-10-01)
  --channel, -c NAME   Filter by channel name
  --format, -f FORMAT  Output format: text, json (default: text)
  --help, -h           Show this help message

EXAMPLES:
  node summary.js --days 30
  node summary.js --start 2025-09-01 --end 2025-10-01
  node summary.js --channel general
  node summary.js --format json
  `);
}

// Generate summary report
async function generateSummaryReport(options) {
  const { startDate, endDate, channel, format } = options;
  
  console.log(`Generating summary report from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
  if (channel) console.log(`Filtering by channel: ${channel}`);
  
  try {
    // Build channel query
    let channelWhere = {};
    if (channel) {
      channelWhere = {
        name: {
          contains: channel,
          mode: 'insensitive'
        }
      };
    }
    
    // Get channels
    const channels = await prisma.conversation.findMany({
      where: channelWhere,
      orderBy: {
        name: 'asc'
      }
    });
    
    // Get overall message statistics
    const totalMessages = await prisma.message.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        ...(channel ? { channel: { name: { contains: channel, mode: 'insensitive' } } } : {})
      }
    });
    
    // Get thread messages count
    const threadMessages = await prisma.message.count({
      where: {
        thread_ts: {
          not: null
        },
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        ...(channel ? { channel: { name: { contains: channel, mode: 'insensitive' } } } : {})
      }
    });
    
    // Get distinct thread count using a raw query
    let distinctThreadsResult;
    
    if (channel) {
      distinctThreadsResult = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT m.thread_ts) as thread_count
        FROM "Message" m
        JOIN "Conversation" c ON m.channel_id = c.id
        WHERE m.thread_ts IS NOT NULL
        AND m."createdAt" >= ${startDate}
        AND m."createdAt" <= ${endDate}
        AND c.name ILIKE ${`%${channel}%`}
      `;
    } else {
      distinctThreadsResult = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT m.thread_ts) as thread_count
        FROM "Message" m
        JOIN "Conversation" c ON m.channel_id = c.id
        WHERE m.thread_ts IS NOT NULL
        AND m."createdAt" >= ${startDate}
        AND m."createdAt" <= ${endDate}
      `;
    }
    const distinctThreads = parseInt(distinctThreadsResult[0]?.thread_count || '0');
    
    // Get total summaries
    const totalSummaries = await prisma.summary.count({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        ...(channel ? { channel: { name: { contains: channel, mode: 'insensitive' } } } : {})
      }
    });
    
    // Get user statistics
    let activeUsersResult;
    
    if (channel) {
      activeUsersResult = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT user_id) as user_count
        FROM "Message" m
        JOIN "Conversation" c ON m.channel_id = c.id
        WHERE m."createdAt" >= ${startDate}
        AND m."createdAt" <= ${endDate}
        AND c.name ILIKE ${`%${channel}%`}
      `;
    } else {
      activeUsersResult = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT user_id) as user_count
        FROM "Message" m
        JOIN "Conversation" c ON m.channel_id = c.id
        WHERE m."createdAt" >= ${startDate}
        AND m."createdAt" <= ${endDate}
      `;
    }
    const activeUsers = parseInt(activeUsersResult[0]?.user_count || '0');
    
    // Prepare report data
    const reportData = {
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        days: Math.round((endDate - startDate) / (1000 * 60 * 60 * 24))
      },
      overall: {
        totalMessages,
        threadMessages,
        distinctThreads,
        totalSummaries,
        activeUsers,
        totalChannels: channels.length
      },
      channels: []
    };
    
    // Generate channel-specific data
    for (const channelData of channels) {
      // Get messages in this channel
      const channelMessages = await prisma.message.count({
        where: {
          channel_id: channelData.id,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });
      
      // Skip channels with no activity in the period
      if (channelMessages === 0) continue;
      
      // Get thread count for this channel
      const channelThreadsResult = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT thread_ts) as thread_count
        FROM "Message"
        WHERE thread_ts IS NOT NULL
        AND channel_id = ${channelData.id}
        AND "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
      `;
      const channelThreads = parseInt(channelThreadsResult[0]?.thread_count || '0');
      
      // Get unique users in this channel
      const channelUsersResult = await prisma.$queryRaw`
        SELECT COUNT(DISTINCT user_id) as user_count
        FROM "Message"
        WHERE channel_id = ${channelData.id}
        AND "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
      `;
      const channelUsers = parseInt(channelUsersResult[0]?.user_count || '0');
      
      // Get the most recent summary
      const recentSummary = await prisma.summary.findFirst({
        where: {
          channel_id: channelData.id,
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      // Parse highlights
      let highlights = [];
      if (recentSummary?.highlights) {
        try {
          highlights = typeof recentSummary.highlights === 'string'
            ? JSON.parse(recentSummary.highlights)
            : recentSummary.highlights;
        } catch (e) {
          console.error(`Error parsing highlights for ${channelData.name}:`, e.message);
        }
      }
      
      // Channel report data
      const channelReport = {
        id: channelData.id,
        slackId: channelData.slack_id,
        name: channelData.name,
        type: channelData.type,
        createdAt: channelData.createdAt.toISOString(),
        stats: {
          messages: channelMessages,
          threads: channelThreads,
          users: channelUsers
        },
        summary: recentSummary ? {
          id: recentSummary.id,
          periodStart: recentSummary.period_start.toISOString(),
          periodEnd: recentSummary.period_end.toISOString(),
          content: recentSummary.summary,
          highlights: highlights,
          createdAt: recentSummary.createdAt.toISOString()
        } : null
      };
      
      reportData.channels.push(channelReport);
    }
    
    // Output based on format
    if (format === 'json') {
      console.log(JSON.stringify(reportData, null, 2));
    } else {
      // Text format (default)
      console.log(`\n====== SLACK ACTIVITY REPORT ======`);
      console.log(`Period: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()} (${reportData.period.days} days)`);
      
      console.log(`\nOVERALL STATISTICS:`);
      console.log(`- Total Messages: ${reportData.overall.totalMessages}`);
      console.log(`- Thread Messages: ${reportData.overall.threadMessages}`);
      console.log(`- Distinct Threads: ${reportData.overall.distinctThreads}`);
      console.log(`- Total Summaries: ${reportData.overall.totalSummaries}`);
      console.log(`- Active Users: ${reportData.overall.activeUsers}`);
      console.log(`- Active Channels: ${reportData.channels.length}`);
      
      if (reportData.channels.length === 0) {
        console.log('\nNo channel activity found for this period.');
      } else {
        console.log(`\nCHANNEL ACTIVITY:`);
        
        for (const channel of reportData.channels) {
          console.log(`\n--- ${channel.name} (${channel.type}) ---`);
          console.log(`Messages: ${channel.stats.messages} | Threads: ${channel.stats.threads} | Active Users: ${channel.stats.users}`);
          
          if (channel.summary) {
            console.log(`\nLatest Summary (${new Date(channel.summary.createdAt).toLocaleDateString()}):`);
            console.log(channel.summary.content);
            
            if (channel.summary.highlights && channel.summary.highlights.length > 0) {
              console.log('\nHighlights:');
              channel.summary.highlights.forEach((highlight, i) => {
                if (typeof highlight === 'string') {
                  console.log(`${i+1}. ${highlight}`);
                } else {
                  console.log(`${i+1}. ${highlight.text || highlight.message || JSON.stringify(highlight)}`);
                }
              });
            }
          } else {
            console.log('\nNo summaries available for this period.');
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Error generating summary report:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Main execution
const options = parseArgs();
generateSummaryReport(options)
  .then(() => console.log('\nSummary report generation complete.'))
  .catch(console.error);