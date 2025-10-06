@echo off
echo Slack Summarizer - Summary Generation Tools
echo ===========================================

if "%1"=="" goto :help

if "%1"=="daily" goto :daily
if "%1"=="report" goto :report
if "%1"=="days" goto :days
if "%1"=="check" goto :check
if "%1"=="seed" goto :seed
if "%1"=="help" goto :help

echo Unknown command: %1
goto :help

:daily
echo Running daily summary generation...
node scripts/daily-summary.js
goto :eof

:report
echo Running custom summary report...
if "%2"=="" (
  node scripts/summary.js
) else (
  node scripts/summary.js %2 %3 %4 %5 %6 %7 %8 %9
)
goto :eof

:days
echo Running summary for last N days...
if "%2"=="" (
  echo Error: Please specify number of days, e.g., "summarize days 30"
  goto :eof
)
node scripts/summary.js --days %2
goto :eof

:check
echo Checking database content...
node scripts/check-database.js
goto :eof

:seed
echo Seeding database with sample data...
node scripts/seed-database.js
goto :eof

:help
echo.
echo Usage: summarize COMMAND [OPTIONS]
echo.
echo Commands:
echo   daily            Generate and post daily summaries
echo   report [opts]    Run a custom report with options (see below)
echo   days NUM         Summarize the last NUM days
echo   check            Check database content
echo   seed             Seed database with sample data
echo   help             Show this help message
echo.
echo Report options:
echo   --days, -d NUM       Summarize the last NUM days (default: 60)
echo   --start, -s DATE     Start date in ISO format (e.g., 2025-08-01)
echo   --end, -e DATE       End date in ISO format (e.g., 2025-10-01)
echo   --channel, -c NAME   Filter by channel name
echo   --format, -f FORMAT  Output format: text, json (default: text)
echo.
echo Examples:
echo   summarize days 30
echo   summarize report --channel general
echo   summarize report --start 2025-09-01 --end 2025-10-01
echo   summarize daily
echo.