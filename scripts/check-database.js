require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient({
  log: ['error', 'warn'],
});

async function checkDatabaseContent() {
  console.log('Checking database content...');
  
  try {
    // Check all tables for content
    const tables = ['Conversation', 'Message', 'Summary', 'User', 'Installation'];
    
    for (const table of tables) {
      let count;
      
      switch(table) {
        case 'Conversation':
          count = await prisma.conversation.count();
          break;
        case 'Message':
          count = await prisma.message.count();
          break;
        case 'Summary':
          count = await prisma.summary.count();
          break;
        case 'User':
          count = await prisma.user.count();
          break;
        case 'Installation':
          count = await prisma.installation.count();
          break;
        default:
          count = 0;
      }
      
      console.log(`${table}: ${count} records`);
      
      // If there are records, show some sample data
      if (count > 0) {
        let sampleData;
        
        switch(table) {
          case 'Conversation':
            sampleData = await prisma.conversation.findMany({
              take: 5,
              orderBy: { createdAt: 'desc' }
            });
            break;
          case 'Message':
            sampleData = await prisma.message.findMany({
              take: 5,
              orderBy: { createdAt: 'desc' }
            });
            break;
          case 'Summary':
            sampleData = await prisma.summary.findMany({
              take: 5,
              orderBy: { createdAt: 'desc' }
            });
            break;
          case 'User':
            sampleData = await prisma.user.findMany({
              take: 5,
              orderBy: { last_updated: 'desc' }
            });
            break;
          case 'Installation':
            sampleData = await prisma.installation.findMany({
              take: 1,
              orderBy: { installed_at: 'desc' },
              select: {
                team_id: true,
                team_name: true,
                installed_at: true,
                updated_at: true,
                bot_id: true
                // Omitting sensitive fields
              }
            });
            break;
          default:
            sampleData = [];
        }
        
        console.log(`Sample data from ${table}:`);
        
        // For sensitive tables, show limited info
        if (table === 'Installation') {
          console.log('Team:', sampleData[0]?.team_name);
          console.log('Installed at:', sampleData[0]?.installed_at);
        } else if (table === 'Message') {
          console.log('Latest messages:');
          for (const msg of sampleData) {
            console.log(`- ${new Date(msg.createdAt).toLocaleString()}: ${msg.text.substring(0, 50)}${msg.text.length > 50 ? '...' : ''}`);
          }
        } else if (table === 'User') {
          console.log('Users:');
          for (const user of sampleData) {
            console.log(`- ${user.name} (${user.slack_id}), Bot: ${user.is_bot}`);
          }
        } else {
          console.log(JSON.stringify(sampleData, null, 2));
        }
      }
      
      console.log('---');
    }
    
  } catch (error) {
    console.error('Error checking database content:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the database check
checkDatabaseContent()
  .then(() => console.log('Database check complete.'))
  .catch(console.error);