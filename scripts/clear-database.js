#!/usr/bin/env node
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Initialize Prisma client
const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('Starting database cleanup...');
  
  try {
    // Delete all data in reverse order of dependencies
    console.log('Deleting messages...');
    await prisma.message.deleteMany({});
    
    console.log('Deleting summaries...');
    await prisma.summary.deleteMany({});
    
    console.log('Deleting users...');
    await prisma.user.deleteMany({});
    
    console.log('Deleting conversations...');
    await prisma.conversation.deleteMany({});
    
    console.log('Database cleanup completed successfully!');
  } catch (error) {
    console.error('Error cleaning database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the function if this script is run directly
if (require.main === module) {
  clearDatabase()
    .then(() => console.log('Done!'))
    .catch(console.error);
}

module.exports = clearDatabase;