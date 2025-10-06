@echo off
setlocal enabledelayedexpansion

:: Deployment script for Slack Summarizer

echo.
echo ======================================
echo    Slack Summarizer Deployment Tool    
echo ======================================
echo.

:: Check environment variables
echo Checking environment variables...

set missing_vars=0
set required_vars=SLACK_BOT_TOKEN SLACK_SIGNING_SECRET SLACK_CLIENT_ID SLACK_CLIENT_SECRET DATABASE_URL DIGEST_CHANNEL

for %%v in (%required_vars%) do (
    if "!%%v!"=="" (
        echo Missing required environment variable: %%v
        set missing_vars=1
    )
)

if %missing_vars%==1 (
    echo Error: Missing required environment variables. Check your .env file.
    exit /b 1
) else (
    echo All required environment variables are set.
)

echo.
echo Please select a deployment option:
echo 1) Heroku - Cloud PaaS (easy, free for small apps)
echo 2) Docker - Container-based deployment
echo 3) PM2 - Process manager for Node.js apps
echo 4) Windows Task Scheduler - Run hourly with Task Scheduler
echo 5) Exit

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto deploy_heroku
if "%choice%"=="2" goto deploy_docker
if "%choice%"=="3" goto deploy_pm2
if "%choice%"=="4" goto setup_windows_scheduler
if "%choice%"=="5" goto exit_script

echo Invalid choice. Exiting...
exit /b 1

:deploy_heroku
echo Deploying to Heroku...

:: Check if Heroku CLI is installed
heroku --version > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Heroku CLI not found. Please install it first.
    echo Visit: https://devcenter.heroku.com/articles/heroku-cli
    exit /b 1
)

:: Check if user is logged in to Heroku
heroku auth:whoami > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo You need to login to Heroku:
    heroku login
)

:: Check if app exists or create new one
set /p app_name="Enter your Heroku app name (leave blank to create a new one): "

if "%app_name%"=="" (
    echo Creating a new Heroku app...
    for /f "tokens=*" %%a in ('heroku create') do set app_line=%%a
    for /f "tokens=2 delims=| " %%a in ("!app_line!") do set app_name=%%a
    echo Created Heroku app: !app_name!
) else (
    heroku apps:info --app %app_name% > nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo App %app_name% doesn't exist. Creating it...
        heroku create %app_name%
    ) else (
        echo Using existing Heroku app: %app_name%
    )
)

:: Set environment variables
echo Setting environment variables...
heroku config:set ^
    SLACK_BOT_TOKEN="%SLACK_BOT_TOKEN%" ^
    SLACK_SIGNING_SECRET="%SLACK_SIGNING_SECRET%" ^
    SLACK_CLIENT_ID="%SLACK_CLIENT_ID%" ^
    SLACK_CLIENT_SECRET="%SLACK_CLIENT_SECRET%" ^
    DATABASE_URL="%DATABASE_URL%" ^
    DIGEST_CHANNEL="%DIGEST_CHANNEL%" ^
    --app %app_name%

if defined DIRECT_URL (
    heroku config:set DIRECT_URL="%DIRECT_URL%" --app %app_name%
)

if defined OPENAI_API_KEY (
    heroku config:set OPENAI_API_KEY="%OPENAI_API_KEY%" --app %app_name%
)

if defined SUPABASE_URL (
    heroku config:set SUPABASE_URL="%SUPABASE_URL%" --app %app_name%
)

if defined SUPABASE_ANON_KEY (
    heroku config:set SUPABASE_ANON_KEY="%SUPABASE_ANON_KEY%" --app %app_name%
)

:: Push code to Heroku
echo Pushing code to Heroku...
git push https://git.heroku.com/%app_name%.git HEAD:main

:: Set up scheduler
echo Setting up Heroku Scheduler...
heroku addons:create scheduler:standard --app %app_name%
echo Scheduler add-on created.
echo Please open the scheduler dashboard and add a job to run 'node scripts/hourly-summarizer.js' hourly:
heroku addons:open scheduler --app %app_name%

echo Heroku deployment complete!
echo Your app is running at: https://%app_name%.herokuapp.com
goto end

:deploy_docker
echo Deploying with Docker...

:: Check if Docker is installed
docker --version > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Docker not found. Please install it first.
    echo Visit: https://docs.docker.com/get-docker/
    exit /b 1
)

:: Check if Docker Compose is installed
docker-compose --version > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Error: Docker Compose not found. Please install it first.
    echo Visit: https://docs.docker.com/compose/install/
    exit /b 1
)

:: Build and start Docker containers
echo Building and starting Docker containers...
docker-compose build
docker-compose up -d

echo Docker deployment complete!
echo Your app is running at: http://localhost:3000
echo To see app logs, run: docker-compose logs -f app
echo To see cron logs, run: docker-compose logs -f cron
goto end

:deploy_pm2
echo Deploying with PM2...

:: Check if PM2 is installed
pm2 --version > nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo PM2 not found. Installing...
    npm install -g pm2
)

:: Install dependencies
echo Installing dependencies...
npm ci

:: Start the app with PM2
echo Starting the app with PM2...
pm2 start ecosystem.config.js
pm2 save

echo Setting up PM2 to start on boot...
pm2 startup

echo PM2 deployment complete!
echo To check status, run: pm2 list
echo To view logs, run: pm2 logs
goto end

:setup_windows_scheduler
echo Setting up Windows Task Scheduler...

:: Get the current directory
set "SCRIPT_DIR=%CD%"
set "SCRIPT_PATH=%SCRIPT_DIR%\scripts\hourly-summarizer.js"
set "NODE_PATH=node"

:: Echo the paths for verification
echo Script location: %SCRIPT_PATH%
echo Working directory: %SCRIPT_DIR%

:: Create the scheduled task
echo Creating scheduled task for hourly summarizer...
schtasks /create /tn "SlackHourlySummary" /tr "%NODE_PATH% \"%SCRIPT_PATH%\"" /sc HOURLY /mo 1 /st %time:~0,5% /f

echo Windows Task Scheduler setup complete!
echo The script will run every hour to generate and post Slack channel summaries.
echo To view task details, run: schtasks /query /tn "SlackHourlySummary"
echo To run the summary immediately, run: schtasks /run /tn "SlackHourlySummary"
goto end

:exit_script
echo Exiting...
exit /b 0

:end
echo.
echo Deployment completed! Thank you for using Slack Summarizer.
echo.