#!/usr/bin/env node
require('dotenv').config();
const { spawn } = require('child_process');
const readline = require('readline');

// ANSI color codes
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Ask for input with colored prompt
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(`${CYAN}${question}${RESET}`, (answer) => {
      resolve(answer);
    });
  });
}

// Run a command and return its process
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: options.silent ? 'ignore' : 'inherit',
      shell: true,
      ...options
    });

    proc.on('error', (err) => {
      reject(err);
    });

    proc.on('close', (code) => {
      if (code !== 0 && !options.ignoreError) {
        reject(new Error(`Command failed with exit code ${code}`));
      } else {
        resolve();
      }
    });
  });
}

// Main menu
async function showMenu() {
  console.clear();
  console.log(`${BOLD}${GREEN}=== Slack Summarizer Launcher ===${RESET}\n`);
  console.log(`${YELLOW}1${RESET}) Start HTTPS Server`);
  console.log(`${YELLOW}2${RESET}) Generate Hourly Summary`);
  console.log(`${YELLOW}3${RESET}) Generate Daily Summary`);
  console.log(`${YELLOW}4${RESET}) Set Up Hourly Scheduled Task`);
  console.log(`${YELLOW}5${RESET}) Deploy Application (Development)`);
  console.log(`${YELLOW}6${RESET}) Deploy to Production (Docker)`);
  console.log(`${YELLOW}7${RESET}) Show Available Channels`);
  console.log(`${YELLOW}8${RESET}) Validate Environment`);
  console.log(`${YELLOW}9${RESET}) Fetch Recent Slack Messages`);
  console.log(`${YELLOW}10${RESET}) Exit`);
  console.log();

  const answer = await prompt('Enter your choice (1-10): ');
  
  switch (answer) {
    case '1':
      await startHttpsServer();
      break;
    case '2':
      await generateHourlySummary();
      break;
    case '3':
      await generateDailySummary();
      break;
    case '4':
      await setupHourlyTask();
      break;
    case '5':
      await deployApplication();
      break;
    case '6':
      await deployProductionDocker();
      break;
    case '7':
      await showChannels();
      break;
    case '8':
      await validateEnvironment();
      break;
    case '9':
      await fetchRecentMessages();
      break;
    case '10':
      console.log(`\n${GREEN}Thank you for using Slack Summarizer!${RESET}`);
      rl.close();
      return;
    default:
      console.log(`\n${RED}Invalid option. Please try again.${RESET}`);
      await pressAnyKey();
      await showMenu();
      break;
  }
}

// Function to start HTTPS server
async function startHttpsServer() {
  console.clear();
  console.log(`${BOLD}${GREEN}Starting HTTPS Server...${RESET}\n`);
  
  try {
    console.log(`${YELLOW}Checking for SSL certificates...${RESET}`);
    await runCommand('node', ['generate-certs.js'], { ignoreError: true });
    
    console.log(`\n${YELLOW}Starting secure server...${RESET}`);
    console.log(`${CYAN}(Press Ctrl+C to stop the server)${RESET}\n`);
    
    await runCommand('node', ['secure-server.js']);
  } catch (error) {
    console.error(`\n${RED}Error starting HTTPS server:${RESET}`, error.message);
  }
  
  await pressAnyKey();
  await showMenu();
}

// Function to generate hourly summary
async function generateHourlySummary() {
  console.clear();
  console.log(`${BOLD}${GREEN}Generate Hourly Summary${RESET}\n`);
  
  const hours = await prompt('Enter the number of hours to summarize (default: 1): ');
  
  try {
    console.log(`\n${YELLOW}Generating hourly summary...${RESET}\n`);
    await runCommand('node', ['scripts/hourly-summarizer.js', hours || '1']);
    console.log(`\n${GREEN}Hourly summary generated successfully!${RESET}`);
  } catch (error) {
    console.error(`\n${RED}Error generating hourly summary:${RESET}`, error.message);
  }
  
  await pressAnyKey();
  await showMenu();
}

// Function to generate daily summary
async function generateDailySummary() {
  console.clear();
  console.log(`${BOLD}${GREEN}Generate Daily Summary${RESET}\n`);
  
  const days = await prompt('Enter the number of days to summarize (default: 1): ');
  
  try {
    console.log(`\n${YELLOW}Generating daily summary...${RESET}\n`);
    await runCommand('node', ['scripts/daily-summary.js', days || '1']);
    console.log(`\n${GREEN}Daily summary generated successfully!${RESET}`);
  } catch (error) {
    console.error(`\n${RED}Error generating daily summary:${RESET}`, error.message);
  }
  
  await pressAnyKey();
  await showMenu();
}

// Function to setup hourly task
async function setupHourlyTask() {
  console.clear();
  console.log(`${BOLD}${GREEN}Set Up Hourly Scheduled Task${RESET}\n`);
  
  try {
    // Check if Windows
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      console.log(`${YELLOW}Setting up Windows scheduled task...${RESET}\n`);
      await runCommand('powershell', ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/setup-hourly-task.ps1']);
    } else {
      console.log(`${YELLOW}Setting up cron job...${RESET}\n`);
      await runCommand('chmod', ['+x', 'scripts/setup-hourly-cron.sh']);
      await runCommand('./scripts/setup-hourly-cron.sh');
    }
    
    console.log(`\n${GREEN}Hourly task set up successfully!${RESET}`);
  } catch (error) {
    console.error(`\n${RED}Error setting up hourly task:${RESET}`, error.message);
  }
  
  await pressAnyKey();
  await showMenu();
}

// Function to deploy application
async function deployApplication() {
  console.clear();
  console.log(`${BOLD}${GREEN}Deploy Application${RESET}\n`);
  
  try {
    // Check if Windows
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      console.log(`${YELLOW}Running Windows deployment script...${RESET}\n`);
      await runCommand('powershell', ['-ExecutionPolicy', 'Bypass', '-File', './deploy.ps1']);
    } else {
      console.log(`${YELLOW}Running deployment script...${RESET}\n`);
      await runCommand('chmod', ['+x', './deploy.sh']);
      await runCommand('./deploy.sh');
    }
  } catch (error) {
    console.error(`\n${RED}Error deploying application:${RESET}`, error.message);
  }
  
  await pressAnyKey();
  await showMenu();
}

// Function to show available channels
async function showChannels() {
  console.clear();
  console.log(`${BOLD}${GREEN}Available Slack Channels${RESET}\n`);
  
  try {
    console.log(`${YELLOW}Fetching available channels...${RESET}\n`);
    await runCommand('node', ['scripts/find-channels.js']);
  } catch (error) {
    console.error(`\n${RED}Error fetching channels:${RESET}`, error.message);
  }
  
  await pressAnyKey();
  await showMenu();
}

// Function to validate environment
async function validateEnvironment() {
  console.clear();
  console.log(`${BOLD}${GREEN}Validate Environment${RESET}\n`);
  
  try {
    console.log(`${YELLOW}Validating environment...${RESET}\n`);
    await runCommand('node', ['scripts/validate-env.js']);
  } catch (error) {
    console.error(`\n${RED}Error validating environment:${RESET}`, error.message);
  }
  
  await pressAnyKey();
  await showMenu();
}

// Function to deploy to production with Docker
async function deployProductionDocker() {
  console.clear();
  console.log(`${BOLD}${GREEN}Deploy to Production (Docker)${RESET}\n`);
  
  try {
    // Check if Windows
    const isWindows = process.platform === 'win32';
    
    if (isWindows) {
      console.log(`${YELLOW}Running Windows production deployment script...${RESET}\n`);
      // For Windows, run the batch file which is easier
      await runCommand('cmd', ['/c', 'setup-production.bat']);
    } else {
      console.log(`${YELLOW}Running production deployment script...${RESET}\n`);
      await runCommand('chmod', ['+x', './deploy-production.sh']);
      await runCommand('./deploy-production.sh');
    }
    
    console.log(`\n${GREEN}Production deployment complete!${RESET}`);
    console.log(`${YELLOW}Your app is now running in Docker containers with automatic scheduling.${RESET}`);
  } catch (error) {
    console.error(`\n${RED}Error deploying to production:${RESET}`, error.message);
  }
  
  await pressAnyKey();
  await showMenu();
}

// Function to fetch recent messages
async function fetchRecentMessages() {
  console.clear();
  console.log(`${BOLD}${GREEN}Fetch Recent Slack Messages${RESET}\n`);
  
  const days = await prompt('Enter the number of days to fetch (default: 1): ');
  
  try {
    console.log(`\n${YELLOW}Fetching recent messages from Slack...${RESET}\n`);
    await runCommand('node', ['scripts/fetch-slack-data.js', days || '1']);
    console.log(`\n${GREEN}Messages fetched successfully!${RESET}`);
  } catch (error) {
    console.error(`\n${RED}Error fetching messages:${RESET}`, error.message);
  }
  
  await pressAnyKey();
  await showMenu();
}

// Function to wait for any key press
async function pressAnyKey() {
  console.log(`\n${CYAN}Press any key to continue...${RESET}`);
  
  process.stdin.setRawMode(true);
  return new Promise(resolve => {
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      resolve();
    });
  });
}

// Start the menu
showMenu().catch(console.error);