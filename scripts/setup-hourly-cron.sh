#!/bin/bash
# This script sets up a cron job to run the hourly summary script

echo "Setting up cron job for hourly Slack summaries..."

# Get the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
HOURLY_SCRIPT="$PROJECT_DIR/scripts/hourly-summary.js"

# Make sure the script is executable
chmod +x "$HOURLY_SCRIPT"

# Create a temporary file for the crontab
TEMP_CRON=$(mktemp)

# Export the current crontab
crontab -l > "$TEMP_CRON" 2>/dev/null

# Check if the entry already exists
if grep -q "$HOURLY_SCRIPT" "$TEMP_CRON"; then
  echo "Cron job already exists. No changes made."
else
  # Add the new cron job
  echo "0 * * * * cd $PROJECT_DIR && /usr/bin/node $HOURLY_SCRIPT >> $PROJECT_DIR/logs/hourly-summary.log 2>&1" >> "$TEMP_CRON"
  
  # Install the new crontab
  crontab "$TEMP_CRON"
  echo "Cron job added! The script will run at the start of every hour."
fi

# Clean up
rm "$TEMP_CRON"

echo ""
echo "To view your current cron jobs, run: crontab -l"
echo "To edit your cron jobs, run: crontab -e"
echo ""

# Create logs directory if it doesn't exist
LOGS_DIR="$PROJECT_DIR/logs"
if [ ! -d "$LOGS_DIR" ]; then
  mkdir -p "$LOGS_DIR"
  echo "Created logs directory at $LOGS_DIR"
fi