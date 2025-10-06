# Automatic Execution & Hosting Guide for Slack Summarizer

This document provides comprehensive instructions on how to set up your Slack Summarizer to run automatically on various hosting platforms.

## Hosting Options

The Slack Summarizer app can be hosted in several ways:

1. **Local Windows Machine**: Using Windows Task Scheduler
2. **Windows Server**: Using Windows Task Scheduler or Docker
3. **Docker Containers**: On any platform that supports Docker
4. **Cloud Providers**: Heroku, Azure, AWS, or any other cloud platform
5. **VPS with PM2**: Using Node.js process manager on a virtual private server

## 1. Automatic Execution on Windows (Local or Server)

### Option A: Using Windows Task Scheduler

1. Run the setup script to create a scheduled task:

```powershell
# Run with administrator privileges
powershell -ExecutionPolicy Bypass -File scripts/setup-hourly-task.ps1
```

This creates a task named "SlackHourlySummary" that runs hourly.

2. Verify the task is created:

```powershell
Get-ScheduledTask -TaskName "SlackHourlySummary"
```

3. To run the task immediately:

```powershell
Start-ScheduledTask -TaskName "SlackHourlySummary"
```

### Option B: Using PM2 on Windows

1. Install PM2 globally:

```powershell
npm install -g pm2
```

2. Start the app with PM2:

```powershell
pm2 start ecosystem.config.js
```

3. Set PM2 to start on boot:

```powershell
pm2 save
pm2 startup
```

## 2. Docker Deployment (Recommended for Production)

Docker allows you to run the application in containers, which is ideal for production environments.

### Prerequisites:
- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose installed ([Get Docker Compose](https://docs.docker.com/compose/install/))

### Deployment Steps:

1. Use our production deployment script:

**Windows:**
```powershell
# Run with administrator privileges
powershell -ExecutionPolicy Bypass -File deploy-production.ps1
```

**Linux/macOS:**
```bash
chmod +x deploy-production.sh
./deploy-production.sh
```

This script will:
- Generate SSL certificates for HTTPS
- Build and start Docker containers
- Configure automatic execution of hourly and daily summaries
- Set up logging

The Docker Compose setup includes:
- An application server container running on ports 3000/3001
- A cron container that runs:
  - Hourly summaries (every hour)
  - Daily summaries (at midnight)
  - Weekly data fetch (every Monday at 1 AM)

### Docker Compose Manual Setup:

If you prefer to set up manually, use these commands:

```bash
# Build the containers
docker-compose build

# Start the containers in detached mode
docker-compose up -d

# View logs
docker-compose logs -f
```

### Maintenance Commands:

```bash
# Stop all containers
docker-compose down

# Restart all containers
docker-compose restart

# Update containers after code changes
docker-compose build
docker-compose up -d
```

## 3. Cloud Provider Deployments

### Heroku Deployment

1. Install the Heroku CLI:
   [Heroku CLI Installation](https://devcenter.heroku.com/articles/heroku-cli)

2. Login to Heroku:
   ```bash
   heroku login
   ```

3. Create a new Heroku app:
   ```bash
   heroku create slack-summarizer-app
   ```

4. Add the Heroku Postgres add-on:
   ```bash
   heroku addons:create heroku-postgresql:hobby-dev
   ```

5. Set environment variables:
   ```bash
   heroku config:set SLACK_BOT_TOKEN=your_bot_token
   heroku config:set SLACK_SIGNING_SECRET=your_signing_secret
   heroku config:set SLACK_CLIENT_ID=your_client_id
   heroku config:set SLACK_CLIENT_SECRET=your_client_secret
   heroku config:set DIGEST_CHANNEL=your_channel_id
   ```

6. Deploy your code:
   ```bash
   git push heroku main
   ```

7. Add the Heroku Scheduler add-on:
   ```bash
   heroku addons:create scheduler:standard
   ```

8. Open the scheduler dashboard and add jobs:
   ```bash
   heroku addons:open scheduler
   ```
   - Add a job to run `node scripts/hourly-summarizer.js` hourly
   - Add a job to run `node scripts/daily-summary.js` daily

### AWS EC2 Deployment

1. Launch an EC2 instance with Amazon Linux 2
2. Connect to your instance via SSH
3. Install Docker and Docker Compose:
   ```bash
   sudo yum update -y
   sudo amazon-linux-extras install docker
   sudo service docker start
   sudo usermod -a -G docker ec2-user
   sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

4. Clone your repository:
   ```bash
   git clone https://github.com/yourusername/slacksummarizer2.git
   cd slacksummarizer2
   ```

5. Create a .env file with your environment variables
6. Run the deployment script:
   ```bash
   chmod +x deploy-production.sh
   ./deploy-production.sh
   ```

## 4. VPS with PM2 Deployment

1. Set up a VPS with your preferred provider
2. Install Node.js, npm, and PM2:
   ```bash
   curl -sL https://deb.nodesource.com/setup_16.x | sudo -E bash -
   sudo apt-get install -y nodejs
   sudo npm install -g pm2
   ```

3. Clone your repository:
   ```bash
   git clone https://github.com/yourusername/slacksummarizer2.git
   cd slacksummarizer2
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Start with PM2:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

## Monitoring Your Deployment

### Docker Logs

```bash
# View all logs
docker-compose logs -f

# View app logs only
docker-compose logs -f app

# View cron logs only
docker-compose logs -f cron
```

### PM2 Monitoring

```bash
# View logs
pm2 logs

# View dashboard
pm2 monit

# View status
pm2 status
```

### Heroku Logs

```bash
heroku logs --tail
```

## Troubleshooting

If your automatic execution isn't working:

1. **Check logs** for error messages
2. **Verify environment variables** are set correctly
3. **Test database connection** using the validate script:
   ```bash
   node scripts/validate-env.js
   ```
4. **Check Slack permissions** using the find channels script:
   ```bash
   node scripts/find-channels.js
   ```
5. **Verify DIGEST_CHANNEL** is correct and the bot is a member of that channel

## Security Considerations

For production deployments:
- Use proper SSL certificates (Let's Encrypt or provider-supplied)
- Keep your .env file secure and never commit it to repositories
- Use a firewall to restrict access to only the necessary ports
- Regularly update dependencies with `npm audit fix`
- Consider using a reverse proxy like Nginx for additional security