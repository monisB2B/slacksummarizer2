#!/usr/bin/env node
require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');

// Path to the hourly summary script
const scriptPath = path.join(__dirname, 'hourly-summary.js');
const nodePath = process.execPath; // Path to the current Node.js executable

console.log('Starting Slack hourly summary scheduler...');
console.log(`Will run: ${nodePath} ${scriptPath} every hour`);

// Function to run the hourly summary script
function runHourlySummary() {
  console.log(`Running hourly summary at ${new Date().toLocaleString()}...`);
  
  // Execute the script as a separate process
  const child = exec(`"${nodePath}" "${scriptPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Execution error: ${error}`);
      return;
    }
    if (stderr) {
      console.error(`Script errors: ${stderr}`);
      return;
    }
    console.log(`Script output: ${stdout}`);
  });
  
  // Log when the child process exits
  child.on('exit', (code) => {
    console.log(`Hourly summary process exited with code ${code}`);
  });
}

// Run immediately on startup
runHourlySummary();

// Then schedule to run every hour
setInterval(runHourlySummary, 60 * 60 * 1000); // Every hour in milliseconds

console.log('Scheduler is running. Press Ctrl+C to exit.');
console.log('This script will continue running until stopped.');
console.log('For production use, consider using a process manager like PM2.');

// Keep the process alive
process.stdin.resume();

// Handle graceful shutdown
process.on('SIGINT', function() {
  console.log('Stopping scheduler...');
  process.exit();
});