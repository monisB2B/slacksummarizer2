# Production deployment script for Slack Summarizer (Windows PowerShell)

# Text formatting
$Green = $PSStyle.Foreground.Green
$Yellow = $PSStyle.Foreground.Yellow
$Red = $PSStyle.Foreground.Red
$Reset = $PSStyle.Reset

Write-Host "${Green}=== Slack Summarizer Production Deployment ===${Reset}"
Write-Host "${Yellow}This script will deploy the Slack Summarizer app to run automatically${Reset}"

# Create necessary directories
New-Item -ItemType Directory -Force -Path logs | Out-Null
New-Item -ItemType Directory -Force -Path certs | Out-Null

# Check if Docker is installed
try {
    docker --version | Out-Null
}
catch {
    Write-Host "${Red}Error: Docker is not installed. Please install Docker first.${Reset}"
    Write-Host "Visit https://docs.docker.com/docker-for-windows/install/ for installation instructions."
    exit 1
}

# Check if Docker Compose is installed
try {
    docker-compose --version | Out-Null
}
catch {
    Write-Host "${Red}Error: Docker Compose is not installed. Please install Docker Compose first.${Reset}"
    Write-Host "Visit https://docs.docker.com/compose/install/ for installation instructions."
    exit 1
}

# Check if .env file exists
if (-not (Test-Path .env)) {
    Write-Host "${Red}Error: .env file not found. Please create a .env file with your configuration.${Reset}"
    exit 1
}

Write-Host "`n${Yellow}Generating SSL certificates for HTTPS...$Reset"
node generate-certs.js

Write-Host "`n${Yellow}Building and starting Docker containers...$Reset"
docker-compose build
docker-compose up -d

Write-Host "`n${Green}Deployment successful!$Reset"
Write-Host "${Yellow}Your Slack Summarizer is now running in production mode.$Reset"
Write-Host "${Yellow}The app server is accessible at: https://YOUR_SERVER_IP:3000$Reset"
Write-Host "${Yellow}The secure server is accessible at: https://YOUR_SERVER_IP:3001$Reset"
Write-Host "${Yellow}Hourly summaries will run automatically every hour$Reset"
Write-Host "${Yellow}Daily summaries will run automatically at midnight$Reset"
Write-Host "${Yellow}New messages will be fetched every Monday at 1:00 AM$Reset"

Write-Host "`n${Yellow}Useful commands:$Reset"
Write-Host "View app logs: docker-compose logs -f app"
Write-Host "View cron logs: docker-compose logs -f cron"
Write-Host "Check hourly summary logs: docker exec -it slacksummarizer2_cron_1 cat /app/logs/hourly-summary-$(Get-Date -Format 'yyyyMMdd').log"
Write-Host "Check daily summary logs: docker exec -it slacksummarizer2_cron_1 cat /app/logs/daily-summary-$(Get-Date -Format 'yyyyMMdd').log"
Write-Host "Stop the app: docker-compose down"
Write-Host "Restart the app: docker-compose restart"

# Check for hosting platform
Write-Host "`n${Yellow}Where are you hosting this Docker container?$Reset"
Write-Host "1) Local Windows Machine"
Write-Host "2) Windows Server"
Write-Host "3) Azure Container Instances"
Write-Host "4) AWS EC2"
Write-Host "5) Other Cloud Provider"
$hosting = Read-Host "Enter your choice (1-5)"

switch ($hosting) {
    "1" {
        Write-Host "`n${Yellow}Setting up Docker to start automatically on boot...$Reset"
        Write-Host "Running: Get-Service docker | Set-Service -StartupType Automatic"
        Get-Service docker | Set-Service -StartupType Automatic
        Write-Host "${Green}Docker will now start automatically when your computer boots.$Reset"
        Write-Host "${Yellow}Note: For true production use, consider hosting on a cloud provider or dedicated server.$Reset"
    }
    "2" {
        Write-Host "`n${Yellow}Setting up Docker to start automatically on server boot...$Reset"
        Write-Host "Running: Get-Service docker | Set-Service -StartupType Automatic"
        Get-Service docker | Set-Service -StartupType Automatic
        Write-Host "${Green}Docker will now start automatically when your server boots.$Reset"
        Write-Host "${Yellow}Remember to set up proper network security and SSL certificates for production use.$Reset"
    }
    "3" {
        Write-Host "`n${Yellow}For Azure Container Instances:$Reset"
        Write-Host "1. Use the Azure CLI or Azure Portal to deploy your container"
        Write-Host "2. Push your Docker image to Azure Container Registry:"
        Write-Host "   docker tag slacksummarizer2_app myregistry.azurecr.io/slacksummarizer:latest"
        Write-Host "   docker push myregistry.azurecr.io/slacksummarizer:latest"
        Write-Host "3. Create a container instance with environment variables from your .env file"
        Write-Host "   az container create --resource-group myResourceGroup --name slacksummarizer --image myregistry.azurecr.io/slacksummarizer:latest ..."
    }
    "4" {
        Write-Host "`n${Yellow}For AWS EC2:$Reset"
        Write-Host "1. Ensure your EC2 instance has Docker and Docker Compose installed"
        Write-Host "2. Configure security groups to allow traffic on ports 3000 and 3001"
        Write-Host "3. Set up an Elastic IP address for your instance"
        Write-Host "4. Consider setting up AWS CloudWatch for monitoring"
        Write-Host "5. Run the following on your EC2 instance to ensure Docker starts on boot:"
        Write-Host "   sudo systemctl enable docker"
    }
    "5" {
        Write-Host "`n${Yellow}General recommendations for cloud hosting:$Reset"
        Write-Host "1. Push your Docker image to a registry (Docker Hub, GitHub Container Registry, etc.)"
        Write-Host "2. Configure environment variables in your cloud provider's dashboard"
        Write-Host "3. Set up SSL certificates for HTTPS (Let's Encrypt or cloud provider's SSL)"
        Write-Host "4. Configure proper monitoring and logging"
        Write-Host "5. Set up automated backups for your database"
    }
    default {
        Write-Host "${Yellow}No specific hosting platform selected. Continuing with general deployment.$Reset"
    }
}