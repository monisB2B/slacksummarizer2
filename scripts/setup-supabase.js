#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Helper function to prompt for input
 */
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log('Supabase Database Setup Helper');
  console.log('==============================\n');
  
  // Check if .env file exists
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found. Please create one first.');
    rl.close();
    return;
  }
  
  // Get Supabase credentials
  console.log('Please enter your Supabase project details:');
  const projectId = await prompt('Project ID (from project URL): ');
  const dbPassword = await prompt('Database password: ');
  const anonKey = await prompt('Anon key (from API settings): ');
  
  // Update .env file
  let envContent = fs.readFileSync(envPath, 'utf8');
  envContent = envContent.replace(
    /DATABASE_URL=.*/,
    `DATABASE_URL=postgresql://postgres:${dbPassword}@db.${projectId}.supabase.co:5432/postgres`
  );
  envContent = envContent.replace(
    /SUPABASE_URL=.*/,
    `SUPABASE_URL=https://${projectId}.supabase.co`
  );
  envContent = envContent.replace(
    /SUPABASE_ANON_KEY=.*/,
    `SUPABASE_ANON_KEY=${anonKey}`
  );
  
  // Write updated .env file
  fs.writeFileSync(envPath, envContent);
  console.log('\n.env file updated successfully with Supabase configuration.');
  
  // Ask if user wants to run Prisma migrations
  const runMigrations = await prompt('\nDo you want to run database migrations now? (y/n): ');
  
  if (runMigrations.toLowerCase() === 'y') {
    console.log('\nRunning Prisma migrations...');
    try {
      execSync('npx prisma db push', { stdio: 'inherit' });
      console.log('\nDatabase schema deployed successfully!');
    } catch (error) {
      console.error('\nError running Prisma migrations:', error.message);
    }
  }
  
  rl.close();
}

main().catch(err => {
  console.error('Error:', err);
  rl.close();
  process.exit(1);
});