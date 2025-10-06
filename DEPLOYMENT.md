# Deployment Guide for Slack Summarizer

This guide outlines multiple options for deploying the Slack Summarizer application to a production environment.

## Prerequisites

- Node.js 16+ installed
- Git installed
- Access to your Slack workspace with admin permissions
- Supabase account with a PostgreSQL database (already set up)

## Option 1: Deploy to Heroku

### Step 1: Install Heroku CLI

```bash
# On Windows
# Download and install from https://devcenter.heroku.com/articles/heroku-cli

# On macOS
brew tap heroku/brew && brew install heroku

# On Linux
curl https://cli-assets.heroku.com/install.sh | sh
```

### Step 2: Login to Heroku

```bash
heroku login
```

### Step 3: Create a Heroku App

```bash
cd slacksummarizer2
heroku create slack-summarizer-app
```

### Step 4: Configure Environment Variables

```bash
heroku config:set SLACK_BOT_TOKEN=your_slack_bot_token
heroku config:set SLACK_SIGNING_SECRET=your_slack_signing_secret
heroku config:set SLACK_CLIENT_ID=your_slack_client_id
heroku config:set SLACK_CLIENT_SECRET=your_slack_client_secret
heroku config:set DIGEST_CHANNEL=your_digest_channel_id
heroku config:set DATABASE_URL=your_supabase_db_url
heroku config:set DIRECT_URL=your_supabase_direct_url
heroku config:set SUPABASE_URL=your_supabase_url
heroku config:set SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Step 5: Deploy to Heroku

```bash
git push heroku main
```

### Step 6: Set Up Scheduler for Hourly Runs

```bash
heroku addons:create scheduler:standard
heroku addons:open scheduler
```

In the Heroku Scheduler dashboard, add a new job:
- Command: `node scripts/hourly-summarizer.js`
- Frequency: Hourly
- Next due: Set to the next hour

## Option 2: Deploy with Docker (for any cloud provider)

### Step 1: Install Docker and Docker Compose

Follow the installation guide at [docker.com](https://docs.docker.com/get-docker/).

### Step 2: Configure Environment Variables

Create a `.env` file in your project root with all the required environment variables.

### Step 3: Build and Start the Docker Containers

```bash
docker-compose build
docker-compose up -d
```

This will start both the main application server and the cron service that runs hourly summaries.

### Step 4: Check Logs

```bash
# For the main app
docker-compose logs -f app

# For the cron service
docker-compose logs -f cron
```

## Option 3: Deploy to a VPS with PM2

### Step 1: Set Up a VPS

1. Provision a VPS from a provider like DigitalOcean, Linode, or AWS EC2
2. SSH into your server: `ssh root@your_server_ip`

### Step 2: Install Required Software

```bash
# Update packages
apt update && apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
apt install -y nodejs

# Install Git
apt install -y git

# Install PM2
npm install -g pm2
```

### Step 3: Clone the Repository

```bash
git clone https://github.com/your-username/slacksummarizer2.git
cd slacksummarizer2
npm install
```

### Step 4: Set Up Environment Variables

```bash
cp .env.example .env
# Edit the .env file with your production values
nano .env
```

### Step 5: Start the Application with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Step 6: Monitor the Application

```bash
pm2 list
pm2 logs
```

## Option 4: Deploy to AWS Elastic Beanstalk

### Step 1: Install the AWS CLI and EB CLI

```bash
# Install AWS CLI
pip install awscli

# Install EB CLI
pip install awsebcli
```

### Step 2: Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID, Secret Access Key, region, and output format
```

### Step 3: Initialize EB Application

```bash
cd slacksummarizer2
eb init
# Follow the prompts to configure your application
```

### Step 4: Create an EB Environment

```bash
eb create slack-summarizer-env
```

### Step 5: Configure Environment Variables

```bash
eb setenv SLACK_BOT_TOKEN=your_slack_bot_token SLACK_SIGNING_SECRET=your_slack_signing_secret SLACK_CLIENT_ID=your_slack_client_id SLACK_CLIENT_SECRET=your_slack_client_secret DIGEST_CHANNEL=your_digest_channel_id DATABASE_URL=your_supabase_db_url DIRECT_URL=your_supabase_direct_url
```

### Step 6: Deploy the Application

```bash
eb deploy
```

### Step 7: Set Up CloudWatch Event for Hourly Task

1. Go to AWS Management Console > CloudWatch > Events > Rules
2. Create a new rule with a schedule expression: `rate(1 hour)`
3. Set the target as your Elastic Beanstalk environment's worker tier
4. Configure the input to run your hourly script

## Updating Your Deployed Application

### For Heroku

```bash
git add .
git commit -m "Update application"
git push heroku main
```

### For Docker

```bash
git pull  # If you're pulling from a repository
docker-compose build
docker-compose down
docker-compose up -d
```

### For VPS with PM2

```bash
cd slacksummarizer2
git pull
npm install
pm2 restart all
```

### For AWS Elastic Beanstalk

```bash
git add .
git commit -m "Update application"
eb deploy
```

## Troubleshooting

### Database Connection Issues

1. Verify your database connection string is correct
2. Check that your database is accessible from your deployment environment
3. For Supabase, ensure your IP address is allowed in their settings

### Slack API Issues

1. Verify all Slack tokens are correct
2. Check that your bot has the necessary permissions
3. Ensure your app's redirect URLs are configured correctly for the production domain

### Scheduler Issues

1. Check the logs of your scheduler/cron job
2. Verify that the environment variables are accessible to the cron job
3. Make sure the script path is correct

## Monitoring and Maintenance

- Set up logging and monitoring for your deployed application
- Check the logs regularly for errors
- Consider setting up alerts for critical errors
- Keep your dependencies updated
- Regularly back up your database

## Security Best Practices

1. Never commit sensitive information to your repository
2. Use environment variables for all secrets
3. Set up SSL/TLS for secure HTTPS connections
4. Regularly update your dependencies
5. Follow the principle of least privilege for API keys and tokens