@echo off
:: This batch file sets up a scheduled task to run the hourly Slack summarizer script

echo Setting up scheduled task for hourly Slack summaries...

:: Get the current directory and construct paths
set "CURR_DIR=%~dp0"
set "ROOT_DIR=%CURR_DIR%.."
set "SCRIPT_PATH=%ROOT_DIR%\scripts\hourly-summarizer.js"
set "NODE_PATH=node"

:: Echo the paths for verification
echo Script location: %SCRIPT_PATH%
echo Working directory: %ROOT_DIR%

:: Create the scheduled task with current user
schtasks /create /tn "SlackHourlySummary" /tr "%NODE_PATH% \"%SCRIPT_PATH%\"" /sc HOURLY /mo 1 /st %time:~0,5% /f

echo.
echo Scheduled task "SlackHourlySummary" has been created!
echo The script will run every hour to generate and post Slack channel summaries.
echo.
echo To view all scheduled tasks, run: schtasks /query /tn "SlackHourlySummary"
echo To delete this task, run: schtasks /delete /tn "SlackHourlySummary" /f
echo To run the summary immediately, run: schtasks /run /tn "SlackHourlySummary"
echo.