#!/bin/bash
# Production deployment script for Slack Summarizer

# ANSI color codes for better readability
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Slack Summarizer Production Deployment ===${NC}"
echo -e "${YELLOW}This script will deploy the Slack Summarizer app to run automatically${NC}"

# Create necessary directories
mkdir -p logs certs

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed. Please install Docker first.${NC}"
    echo "Visit https://docs.docker.com/get-docker/ for installation instructions."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed. Please install Docker Compose first.${NC}"
    echo "Visit https://docs.docker.com/compose/install/ for installation instructions."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${RED}Error: .env file not found. Please create a .env file with your configuration.${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Generating SSL certificates for HTTPS...${NC}"
node generate-certs.js

echo -e "\n${YELLOW}Building and starting Docker containers...${NC}"
docker-compose build
docker-compose up -d

echo -e "\n${GREEN}Deployment successful!${NC}"
echo -e "${YELLOW}Your Slack Summarizer is now running in production mode.${NC}"
echo -e "${YELLOW}The app server is accessible at: https://YOUR_SERVER_IP:3000${NC}"
echo -e "${YELLOW}The secure server is accessible at: https://YOUR_SERVER_IP:3001${NC}"
echo -e "${YELLOW}Hourly summaries will run automatically every hour${NC}"
echo -e "${YELLOW}Daily summaries will run automatically at midnight${NC}"
echo -e "${YELLOW}New messages will be fetched every Monday at 1:00 AM${NC}"

echo -e "\n${YELLOW}Useful commands:${NC}"
echo "View app logs: docker-compose logs -f app"
echo "View cron logs: docker-compose logs -f cron"
echo "Check hourly summary logs: docker exec -it slacksummarizer2_cron_1 cat /app/logs/hourly-summary-$(date +%Y%m%d).log"
echo "Check daily summary logs: docker exec -it slacksummarizer2_cron_1 cat /app/logs/daily-summary-$(date +%Y%m%d).log"
echo "Stop the app: docker-compose down"
echo "Restart the app: docker-compose restart"