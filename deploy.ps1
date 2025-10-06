# Windows PowerShell Deployment Script for Slack Summarizer

# Text formatting
$Bold = $PSStyle.Bold
$Reset = $PSStyle.Reset
$Green = $PSStyle.Foreground.Green
$Yellow = $PSStyle.Foreground.Yellow
$Red = $PSStyle.Foreground.Red
$Blue = $PSStyle.Foreground.Blue

# Print header
Write-Host ""
Write-Host "${Bold}${Blue}======================================${Reset}"
Write-Host "${Bold}${Blue}   Slack Summarizer Deployment Tool    ${Reset}"
Write-Host "${Bold}${Blue}======================================${Reset}"
Write-Host ""

# Function to validate environment variables
function Test-RequiredEnv {
    Write-Host "${Yellow}Checking environment variables...${Reset}"
    
    $missingVars = 0
    $requiredVars = @(
        "SLACK_BOT_TOKEN", 
        "SLACK_SIGNING_SECRET", 
        "SLACK_CLIENT_ID", 
        "SLACK_CLIENT_SECRET", 
        "DATABASE_URL", 
        "DIGEST_CHANNEL"
    )

    foreach ($var in $requiredVars) {
        if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($var, "User"))) {
            Write-Host "${Red}Missing required environment variable: $var${Reset}"
            $missingVars = 1
        }
    }

    if ($missingVars -eq 1) {
        Write-Host "${Red}Error: Missing required environment variables. Check your .env file.${Reset}"
        exit 1
    } else {
        Write-Host "${Green}All required environment variables are set.${Reset}"
    }
}

# Function to deploy to Heroku
function Start-HerokuDeployment {
    Write-Host "${Yellow}Deploying to Heroku...${Reset}"
    
    # Check if Heroku CLI is installed
    try {
        $null = Get-Command heroku -ErrorAction Stop
    } catch {
        Write-Host "${Red}Error: Heroku CLI not found. Please install it first.${Reset}"
        Write-Host "Visit: https://devcenter.heroku.com/articles/heroku-cli"
        exit 1
    }
    
    # Check if user is logged in to Heroku
    try {
        $null = heroku auth:whoami
    } catch {
        Write-Host "${Yellow}You need to login to Heroku:${Reset}"
        heroku login
    }
    
    # Check if app exists or create new one
    $appName = Read-Host "Enter your Heroku app name (leave blank to create a new one)"
    
    if ([string]::IsNullOrEmpty($appName)) {
        Write-Host "${Yellow}Creating a new Heroku app...${Reset}"
        $herokuOutput = heroku create --json
        $appName = ($herokuOutput | ConvertFrom-Json).name
        Write-Host "${Green}Created Heroku app: $appName${Reset}"
    } elseif ((heroku apps:info --app $appName 2>&1) -match "Couldn't find that app") {
        Write-Host "${Yellow}App $appName doesn't exist. Creating it...${Reset}"
        heroku create $appName
    } else {
        Write-Host "${Green}Using existing Heroku app: $appName${Reset}"
    }
    
    # Set environment variables
    Write-Host "${Yellow}Setting environment variables...${Reset}"
    heroku config:set `
        SLACK_BOT_TOKEN="$env:SLACK_BOT_TOKEN" `
        SLACK_SIGNING_SECRET="$env:SLACK_SIGNING_SECRET" `
        SLACK_CLIENT_ID="$env:SLACK_CLIENT_ID" `
        SLACK_CLIENT_SECRET="$env:SLACK_CLIENT_SECRET" `
        DATABASE_URL="$env:DATABASE_URL" `
        DIGEST_CHANNEL="$env:DIGEST_CHANNEL" `
        --app $appName
    
    if (-not [string]::IsNullOrEmpty($env:DIRECT_URL)) {
        heroku config:set DIRECT_URL="$env:DIRECT_URL" --app $appName
    }
    
    if (-not [string]::IsNullOrEmpty($env:OPENAI_API_KEY)) {
        heroku config:set OPENAI_API_KEY="$env:OPENAI_API_KEY" --app $appName
    }
    
    if (-not [string]::IsNullOrEmpty($env:SUPABASE_URL)) {
        heroku config:set SUPABASE_URL="$env:SUPABASE_URL" --app $appName
    }
    
    if (-not [string]::IsNullOrEmpty($env:SUPABASE_ANON_KEY)) {
        heroku config:set SUPABASE_ANON_KEY="$env:SUPABASE_ANON_KEY" --app $appName
    }
    
    # Push code to Heroku
    Write-Host "${Yellow}Pushing code to Heroku...${Reset}"
    git push https://git.heroku.com/$appName.git HEAD:main
    
    # Set up scheduler
    Write-Host "${Yellow}Setting up Heroku Scheduler...${Reset}"
    heroku addons:create scheduler:standard --app $appName
    Write-Host "${Green}Scheduler add-on created.${Reset}"
    Write-Host "${Yellow}Please open the scheduler dashboard and add a job to run 'node scripts/hourly-summarizer.js' hourly:${Reset}"
    heroku addons:open scheduler --app $appName
    
    Write-Host "${Green}Heroku deployment complete!${Reset}"
    Write-Host "${Blue}Your app is running at: https://$appName.herokuapp.com${Reset}"
}

# Function to deploy with Docker
function Start-DockerDeployment {
    Write-Host "${Yellow}Deploying with Docker...${Reset}"
    
    # Check if Docker is installed
    try {
        $null = Get-Command docker -ErrorAction Stop
    } catch {
        Write-Host "${Red}Error: Docker not found. Please install it first.${Reset}"
        Write-Host "Visit: https://docs.docker.com/get-docker/"
        exit 1
    }
    
    # Check if Docker Compose is installed
    try {
        $null = Get-Command docker-compose -ErrorAction Stop
    } catch {
        Write-Host "${Red}Error: Docker Compose not found. Please install it first.${Reset}"
        Write-Host "Visit: https://docs.docker.com/compose/install/"
        exit 1
    }
    
    # Build and start Docker containers
    Write-Host "${Yellow}Building and starting Docker containers...${Reset}"
    docker-compose build
    docker-compose up -d
    
    Write-Host "${Green}Docker deployment complete!${Reset}"
    Write-Host "${Blue}Your app is running at: http://localhost:3000${Reset}"
    Write-Host "${Yellow}To see app logs, run: docker-compose logs -f app${Reset}"
    Write-Host "${Yellow}To see cron logs, run: docker-compose logs -f cron${Reset}"
}

# Function to deploy with PM2
function Start-PM2Deployment {
    Write-Host "${Yellow}Deploying with PM2...${Reset}"
    
    # Check if PM2 is installed
    try {
        $null = Get-Command pm2 -ErrorAction Stop
    } catch {
        Write-Host "${Yellow}PM2 not found. Installing...${Reset}"
        npm install -g pm2
    }
    
    # Install dependencies
    Write-Host "${Yellow}Installing dependencies...${Reset}"
    npm ci
    
    # Start the app with PM2
    Write-Host "${Yellow}Starting the app with PM2...${Reset}"
    pm2 start ecosystem.config.js
    pm2 save
    
    Write-Host "${Yellow}Setting up PM2 to start on boot...${Reset}"
    pm2 startup
    
    Write-Host "${Green}PM2 deployment complete!${Reset}"
    Write-Host "${Yellow}To check status, run: pm2 list${Reset}"
    Write-Host "${Yellow}To view logs, run: pm2 logs${Reset}"
}

# Function to set up Windows Task Scheduler
function Register-WindowsScheduler {
    Write-Host "${Yellow}Setting up Windows Task Scheduler...${Reset}"
    
    # Get paths
    $scriptDir = Get-Location
    $scriptPath = Join-Path $scriptDir "scripts\hourly-summarizer.js"
    $nodePath = "node"
    
    # Create the scheduled task
    Write-Host "${Yellow}Creating scheduled task for hourly summarizer...${Reset}"
    
    # Check if task already exists
    $taskName = "SlackSummarizerHourly"
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    
    if ($existingTask) {
        Write-Host "${Yellow}Task already exists. Removing and recreating...${Reset}"
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    }
    
    # Create a new task
    $action = New-ScheduledTaskAction -Execute $nodePath -Argument $scriptPath -WorkingDirectory $scriptDir
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $principal = New-ScheduledTaskPrincipal -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) -RunLevel Highest
    
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
    
    Write-Host "${Green}Windows Task Scheduler setup complete!${Reset}"
    Write-Host "${Yellow}The script will run every hour to generate and post Slack channel summaries.${Reset}"
    Write-Host "${Yellow}To run the summary immediately, run: Start-ScheduledTask -TaskName '$taskName'${Reset}"
}

# Main menu
Write-Host "Please select a deployment option:"
Write-Host "1) ${Bold}Heroku${Reset} - Cloud PaaS (easy, free for small apps)"
Write-Host "2) ${Bold}Docker${Reset} - Container-based deployment"
Write-Host "3) ${Bold}PM2${Reset} - Process manager for Node.js apps"
Write-Host "4) ${Bold}Windows Task Scheduler${Reset} - Run hourly with Task Scheduler"
Write-Host "5) ${Bold}Exit${Reset}"

$choice = Read-Host "Enter your choice (1-5)"

# Check environment variables
Test-RequiredEnv

# Execute chosen deployment method
switch ($choice) {
    "1" { Start-HerokuDeployment }
    "2" { Start-DockerDeployment }
    "3" { Start-PM2Deployment }
    "4" { Register-WindowsScheduler }
    "5" { 
        Write-Host "${Yellow}Exiting...${Reset}"
        exit 0
    }
    default {
        Write-Host "${Red}Invalid choice. Exiting...${Reset}"
        exit 1
    }
}