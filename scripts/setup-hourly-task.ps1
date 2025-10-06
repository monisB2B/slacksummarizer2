# PowerShell script to create a scheduled task for hourly Slack summaries

Write-Host "Setting up scheduled task for hourly Slack summaries..." -ForegroundColor Cyan

# Get the current script directory and determine paths
$scriptDir = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $scriptDir "scripts\hourly-summarizer.js"  # Using the updated script
$nodePath = "node"

# Build the full command
$action = New-ScheduledTaskAction -Execute $nodePath -Argument $scriptPath -WorkingDirectory $scriptDir

# Set trigger for hourly execution
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)

# Set settings to ensure the task runs properly
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

# Set principal to run with highest privileges (current user for better environment access)
$principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -RunLevel Highest

# Check if the task already exists
$taskName = "SlackHourlySummary"
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "Task already exists. Removing and recreating..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Register the scheduled task
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force

Write-Host "`nScheduled task '$taskName' has been created!" -ForegroundColor Green
Write-Host "The script will run every hour to generate and post Slack channel summaries." -ForegroundColor Green
Write-Host "`nTo view task details, run: Get-ScheduledTask | Where-Object {`$_.TaskName -eq '$taskName'}" -ForegroundColor Yellow
Write-Host "To delete this task, run: Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false" -ForegroundColor Yellow
Write-Host "`nTo run the summary immediately, run: Start-ScheduledTask -TaskName '$taskName'" -ForegroundColor Cyan