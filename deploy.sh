#!/bin/bash
# Deployment script for Slack Summarizer

# Text formatting
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print header
echo -e "\n${BOLD}${BLUE}======================================${NC}"
echo -e "${BOLD}${BLUE}   Slack Summarizer Deployment Tool    ${NC}"
echo -e "${BOLD}${BLUE}======================================${NC}\n"

# Function to validate environment variables
check_env() {
  echo -e "${YELLOW}Checking environment variables...${NC}"
  
  missing_vars=0
  required_vars=(
    "SLACK_BOT_TOKEN" 
    "SLACK_SIGNING_SECRET" 
    "SLACK_CLIENT_ID" 
    "SLACK_CLIENT_SECRET" 
    "DATABASE_URL" 
    "DIGEST_CHANNEL"
  )

  for var in "${required_vars[@]}"; do
    if [ -z "$(printenv $var)" ]; then
      echo -e "${RED}Missing required environment variable: $var${NC}"
      missing_vars=1
    fi
  done

  if [ $missing_vars -eq 1 ]; then
    echo -e "${RED}Error: Missing required environment variables. Check your .env file.${NC}"
    exit 1
  else
    echo -e "${GREEN}All required environment variables are set.${NC}"
  fi
}

# Function to deploy to Heroku
deploy_heroku() {
  echo -e "${YELLOW}Deploying to Heroku...${NC}"
  
  # Check if Heroku CLI is installed
  if ! command -v heroku &> /dev/null; then
    echo -e "${RED}Error: Heroku CLI not found. Please install it first.${NC}"
    echo "Visit: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
  fi
  
  # Check if user is logged in to Heroku
  if ! heroku auth:whoami &> /dev/null; then
    echo -e "${YELLOW}You need to login to Heroku:${NC}"
    heroku login
  fi
  
  # Check if app exists or create new one
  read -p "Enter your Heroku app name (leave blank to create a new one): " app_name
  
  if [ -z "$app_name" ]; then
    echo -e "${YELLOW}Creating a new Heroku app...${NC}"
    app_name=$(heroku create --json | jq -r .name)
    echo -e "${GREEN}Created Heroku app: $app_name${NC}"
  elif ! heroku apps:info --app "$app_name" &> /dev/null; then
    echo -e "${YELLOW}App $app_name doesn't exist. Creating it...${NC}"
    heroku create "$app_name"
  else
    echo -e "${GREEN}Using existing Heroku app: $app_name${NC}"
  fi
  
  # Set environment variables
  echo -e "${YELLOW}Setting environment variables...${NC}"
  heroku config:set \
    SLACK_BOT_TOKEN="$SLACK_BOT_TOKEN" \
    SLACK_SIGNING_SECRET="$SLACK_SIGNING_SECRET" \
    SLACK_CLIENT_ID="$SLACK_CLIENT_ID" \
    SLACK_CLIENT_SECRET="$SLACK_CLIENT_SECRET" \
    DATABASE_URL="$DATABASE_URL" \
    DIGEST_CHANNEL="$DIGEST_CHANNEL" \
    --app "$app_name"
  
  if [ ! -z "$DIRECT_URL" ]; then
    heroku config:set DIRECT_URL="$DIRECT_URL" --app "$app_name"
  fi
  
  if [ ! -z "$OPENAI_API_KEY" ]; then
    heroku config:set OPENAI_API_KEY="$OPENAI_API_KEY" --app "$app_name"
  fi
  
  if [ ! -z "$SUPABASE_URL" ]; then
    heroku config:set SUPABASE_URL="$SUPABASE_URL" --app "$app_name"
  fi
  
  if [ ! -z "$SUPABASE_ANON_KEY" ]; then
    heroku config:set SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY" --app "$app_name"
  fi
  
  # Push code to Heroku
  echo -e "${YELLOW}Pushing code to Heroku...${NC}"
  git push https://git.heroku.com/"$app_name".git HEAD:main
  
  # Set up scheduler
  echo -e "${YELLOW}Setting up Heroku Scheduler...${NC}"
  heroku addons:create scheduler:standard --app "$app_name"
  echo -e "${GREEN}Scheduler add-on created.${NC}"
  echo -e "${YELLOW}Please open the scheduler dashboard and add a job to run 'node scripts/hourly-summarizer.js' hourly:${NC}"
  heroku addons:open scheduler --app "$app_name"
  
  echo -e "${GREEN}Heroku deployment complete!${NC}"
  echo -e "${BLUE}Your app is running at: https://$app_name.herokuapp.com${NC}"
}

# Function to deploy with Docker
deploy_docker() {
  echo -e "${YELLOW}Deploying with Docker...${NC}"
  
  # Check if Docker is installed
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker not found. Please install it first.${NC}"
    echo "Visit: https://docs.docker.com/get-docker/"
    exit 1
  fi
  
  # Check if Docker Compose is installed
  if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose not found. Please install it first.${NC}"
    echo "Visit: https://docs.docker.com/compose/install/"
    exit 1
  fi
  
  # Build and start Docker containers
  echo -e "${YELLOW}Building and starting Docker containers...${NC}"
  docker-compose build
  docker-compose up -d
  
  echo -e "${GREEN}Docker deployment complete!${NC}"
  echo -e "${BLUE}Your app is running at: http://localhost:3000${NC}"
  echo -e "${YELLOW}To see app logs, run: docker-compose logs -f app${NC}"
  echo -e "${YELLOW}To see cron logs, run: docker-compose logs -f cron${NC}"
}

# Function to deploy with PM2
deploy_pm2() {
  echo -e "${YELLOW}Deploying with PM2...${NC}"
  
  # Check if PM2 is installed
  if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}PM2 not found. Installing...${NC}"
    npm install -g pm2
  fi
  
  # Install dependencies
  echo -e "${YELLOW}Installing dependencies...${NC}"
  npm ci
  
  # Start the app with PM2
  echo -e "${YELLOW}Starting the app with PM2...${NC}"
  pm2 start ecosystem.config.js
  pm2 save
  
  echo -e "${YELLOW}Setting up PM2 to start on boot...${NC}"
  pm2 startup
  
  echo -e "${GREEN}PM2 deployment complete!${NC}"
  echo -e "${YELLOW}To check status, run: pm2 list${NC}"
  echo -e "${YELLOW}To view logs, run: pm2 logs${NC}"
}

# Main menu
echo -e "Please select a deployment option:"
echo -e "1) ${BOLD}Heroku${NC} - Cloud PaaS (easy, free for small apps)"
echo -e "2) ${BOLD}Docker${NC} - Container-based deployment"
echo -e "3) ${BOLD}PM2${NC} - Process manager for Node.js apps"
echo -e "4) ${BOLD}Exit${NC}"

read -p "Enter your choice (1-4): " choice

# Check environment variables
check_env

# Execute chosen deployment method
case $choice in
  1)
    deploy_heroku
    ;;
  2)
    deploy_docker
    ;;
  3)
    deploy_pm2
    ;;
  4)
    echo -e "${YELLOW}Exiting...${NC}"
    exit 0
    ;;
  *)
    echo -e "${RED}Invalid choice. Exiting...${NC}"
    exit 1
    ;;
esac