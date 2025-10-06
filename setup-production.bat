@echo off
echo ===== Slack Summarizer Production Setup =====
echo This script will set up your application to run automatically in Docker

REM Check if Docker is installed
where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Docker is not installed.
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    exit /b 1
)

REM Check if Docker Compose is installed
where docker-compose >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Docker Compose is not installed.
    echo Please install Docker Compose from https://docs.docker.com/compose/install/
    exit /b 1
)

REM Check if .env file exists
if not exist .env (
    echo Error: .env file not found.
    echo Please create a .env file with your configuration before continuing.
    exit /b 1
)

REM Create necessary directories
mkdir logs 2>nul
mkdir certs 2>nul

REM Generate SSL certificates for HTTPS
echo Generating SSL certificates for HTTPS...
node generate-certs.js

REM Build and start Docker containers
echo Building and starting Docker containers...
docker-compose build
docker-compose up -d

echo.
echo Deployment successful!
echo Your Slack Summarizer is now running in production mode.
echo The app server is accessible at: https://localhost:3000
echo The secure server is accessible at: https://localhost:3001
echo.
echo Hourly summaries will run automatically every hour
echo Daily summaries will run automatically at midnight
echo New messages will be fetched every Monday at 1:00 AM
echo.
echo Useful commands:
echo - View app logs: npm run docker:logs
echo - Stop the app: npm run docker:stop
echo - Restart the app: docker-compose restart
echo.
echo NOTE: For a true production environment, consider:
echo 1. Using a cloud provider like AWS, Azure, or a dedicated server
echo 2. Setting up proper SSL certificates
echo 3. Configuring a reverse proxy like Nginx
echo 4. Setting up proper monitoring and backups
echo.

pause