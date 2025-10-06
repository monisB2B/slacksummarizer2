#!/usr/bin/env pwsh
# Slack Summarizer - Summary Generation Tools

param(
    [Parameter(Position = 0)]
    [string]$Command,
    
    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [string[]]$Args
)

function Show-Help {
    Write-Host "`nSlack Summarizer - Summary Generation Tools" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "`nUsage: ./summarize.ps1 COMMAND [OPTIONS]`n" -ForegroundColor White
    
    Write-Host "Commands:" -ForegroundColor Yellow
    Write-Host "  daily            Generate and post daily summaries"
    Write-Host "  report [opts]    Run a custom report with options (see below)"
    Write-Host "  days NUM         Summarize the last NUM days"
    Write-Host "  check            Check database content"
    Write-Host "  seed             Seed database with sample data"
    Write-Host "  help             Show this help message`n"
    
    Write-Host "Report options:" -ForegroundColor Yellow
    Write-Host "  --days, -d NUM       Summarize the last NUM days (default: 60)"
    Write-Host "  --start, -s DATE     Start date in ISO format (e.g., 2025-08-01)"
    Write-Host "  --end, -e DATE       End date in ISO format (e.g., 2025-10-01)"
    Write-Host "  --channel, -c NAME   Filter by channel name"
    Write-Host "  --format, -f FORMAT  Output format: text, json (default: text)`n"
    
    Write-Host "Examples:" -ForegroundColor Green
    Write-Host "  ./summarize.ps1 days 30"
    Write-Host "  ./summarize.ps1 report --channel general"
    Write-Host "  ./summarize.ps1 report --start 2025-09-01 --end 2025-10-01"
    Write-Host "  ./summarize.ps1 daily`n"
}

# Main script logic
switch ($Command) {
    "daily" {
        Write-Host "Running daily summary generation..." -ForegroundColor Cyan
        node scripts/daily-summary.js
    }
    "report" {
        Write-Host "Running custom summary report..." -ForegroundColor Cyan
        node scripts/summary.js $Args
    }
    "days" {
        if ($Args.Count -eq 0) {
            Write-Host "Error: Please specify number of days, e.g., './summarize.ps1 days 30'" -ForegroundColor Red
            exit 1
        }
        
        $days = $Args[0]
        Write-Host "Running summary for last $days days..." -ForegroundColor Cyan
        node scripts/summary.js --days $days
    }
    "check" {
        Write-Host "Checking database content..." -ForegroundColor Cyan
        node scripts/check-database.js
    }
    "seed" {
        Write-Host "Seeding database with sample data..." -ForegroundColor Cyan
        node scripts/seed-database.js
    }
    "help" {
        Show-Help
    }
    default {
        if ($Command) {
            Write-Host "Unknown command: $Command" -ForegroundColor Red
        }
        Show-Help
        exit 1
    }
}