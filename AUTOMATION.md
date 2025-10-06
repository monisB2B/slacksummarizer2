# Slack Summarizer Automation Guide

This document explains how to set up automatic running of the Slack channel summarizer on different platforms.

## Overview

The Slack Summarizer app can be configured to run automatically at regular intervals (typically every hour) to:
1. Fetch recent messages from your Slack workspace
2. Generate summaries for active channels
3. Post those summaries to a designated digest channel

## Windows Automation Options

### Option 1: Using PowerShell Script (Recommended)

The PowerShell script creates a Windows scheduled task that runs hourly:

1. Open PowerShell as Administrator
2. Navigate to the project directory
3. Run the setup script:
   ```powershell
   cd scripts
   .\setup-hourly-task.ps1
   ```

This will create a scheduled task named "SlackHourlySummary" that runs every hour.

### Option 2: Using Batch File

Alternatively, you can use the provided batch file:

1. Open Command Prompt as Administrator
2. Navigate to the project directory
3. Run the setup script:
   ```cmd
   cd scripts
   setup-hourly-task.bat
   ```

## Manual Task Scheduling (Windows)

If you prefer to set up the task manually:

1. Open Task Scheduler (search for "Task Scheduler" in the Start menu)
2. Click "Create Task" in the right panel
3. General tab:
   - Name: SlackHourlySummary
   - Description: Runs Slack channel summarization hourly
   - Run with highest privileges: checked
4. Triggers tab:
   - Click "New"
   - Begin the task: At a specific time
   - Repeat task every: 1 hour
   - Click OK
5. Actions tab:
   - Click "New"
   - Action: Start a program
   - Program/script: node
   - Arguments: "C:\path\to\slacksummarizer2\scripts\hourly-summarizer.js"
   - Start in: "C:\path\to\slacksummarizer2"
   - Click OK
6. Click OK to create the task

## Linux/MacOS Automation

### Using Cron

1. Open your crontab file:
   ```bash
   crontab -e
   ```

2. Add this line to run every hour:
   ```
   0 * * * * cd /path/to/slacksummarizer2 && node scripts/hourly-summarizer.js
   ```

3. Save and exit

### Using the provided bash script

1. Make the script executable:
   ```bash
   chmod +x scripts/setup-hourly-cron.sh
   ```

2. Run the script:
   ```bash
   ./scripts/setup-hourly-cron.sh
   ```

## Cloud Deployment

For production use, consider deploying to a cloud platform as described in DEPLOYMENT.md.

## Checking and Troubleshooting

### Windows

- View scheduled tasks: `schtasks /query /tn "SlackHourlySummary"`
- Run immediately: `schtasks /run /tn "SlackHourlySummary"`
- Delete task: `schtasks /delete /tn "SlackHourlySummary" /f`

### Linux/MacOS

- View cron jobs: `crontab -l`
- Check logs: `grep CRON /var/log/syslog`

## Environment Configuration

Ensure your .env file is properly configured with the following variables:

```
DATABASE_URL=your_database_connection_string
SLACK_BOT_TOKEN=xoxb-your-slack-bot-token
DIGEST_CHANNEL=C09JV3TQR8V
```

## Testing the Setup

After setting up automation, you can manually trigger the summarizer:

### Windows
```powershell
Start-ScheduledTask -TaskName "SlackHourlySummary"
```

### Linux/MacOS
```bash
cd /path/to/slacksummarizer2 && node scripts/hourly-summarizer.js
```

Check the digest channel in Slack to see if summaries are posted successfully.