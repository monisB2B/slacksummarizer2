# Slack Summarizer

A production-ready Slack app that ingests messages from channels and generates daily or hourly summaries, thread links, mentions, recaps, and task suggestions. This is a fully operational app that can be deployed for regular automated summaries.

## Features

- Daily summaries of channel activity
- Important thread identification with links
- User mention tracking and statistics
- Automated task suggestions based on message content
- Support for both public and private channels (with proper authorization)
- Configurable retention policy for message storage
- AI-powered summarization with OpenAI (with fallback to heuristic extraction)

## Requirements

- Node.js 20 or later
- PostgreSQL database
- Slack workspace with admin permissions to create apps

## Stack

- Node.js 20 + TypeScript
- Slack Bolt for JS + Slack Web API
- Express for OAuth and health endpoints
- PostgreSQL + Prisma ORM
- node-cron for scheduled jobs
- Pino logger
- Zod for configuration validation
- OpenAI SDK for summaries (with fallback to heuristic extraction)

## Security and Scope Constraints

**IMPORTANT**: This app follows Slack's security model and API limitations:

- **Private Channels and DMs**: The app can only access private channels and direct messages where it has been explicitly invited or authorized. There is no API to read all private content without Enterprise-level compliance APIs.
- **Authorization**: For each private channel you want to summarize, you must either:
  1. Add the bot to that channel, or
  2. Grant a user token with proper scopes from a member of that channel.
- **Data Storage**: The app stores only essential message fields needed for summarization. Supports a configurable retention policy via the `SOFT_DELETE_DAYS` environment variable.

## Setup Instructions

### 1. Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click "Create New App".
2. Choose "From scratch", provide a name (e.g., "Slack Summarizer"), and select your workspace.

### 2. Configure App Settings

#### OAuth & Permissions

Navigate to "OAuth & Permissions" in your app settings and:

1. Add the following **Bot Token Scopes**:
   - `channels:read` - View basic information about public channels
   - `groups:read` - View basic information about private channels
   - `im:read` - View basic information about direct messages
   - `mpim:read` - View basic information about group direct messages
   - `channels:history` - View messages and other content in public channels
   - `groups:history` - View messages and other content in private channels
   - `im:history` - View messages and other content in direct messages
   - `mpim:history` - View messages and other content in group direct messages
   - `users:read` - View people in the workspace
   - `users:read.email` - View email addresses of people in the workspace
   - `reactions:read` - View emoji reactions on messages
   - `chat:write` - Send messages as the app
   - `app_mentions:read` - Receive events when the app is mentioned

2. Set the **Redirect URL**:
   - Add `https://<YOUR_DOMAIN>/slack/oauth/callback` (Replace `<YOUR_DOMAIN>` with your actual domain)
   - For local development with direct access: `http://localhost:3000/slack/oauth/callback`
   - For local development with tunneling: `https://<YOUR_TUNNEL_URL>/slack/oauth/callback` (recommended for using with Slack API)

#### Event Subscriptions

Navigate to "Event Subscriptions" in your app settings and:

1. Toggle "Enable Events" to On
2. Set the Request URL to `https://<YOUR_DOMAIN>/slack/events`
3. Subscribe to the following **Bot Events**:
   - `message.channels` - A message was posted in a public channel
   - `message.groups` - A message was posted in a private channel
   - `message.im` - A message was posted in a DM
   - `message.mpim` - A message was posted in a group DM
   - `app_mention` - The app was mentioned in a message

### 3. Install the App to Your Workspace

1. Navigate to "Install App" in your app settings
2. Click "Install to Workspace"
3. Review the permissions and click "Allow"

### 4. Add the Bot to Channels

- For each channel you want to summarize, invite the bot using `/invite @YourAppName`
- For private channels, this step is mandatory as the bot cannot access private channels without being invited

### 5. Configure Environment Variables

Copy the example environment file:

```bash
cp src/env.example .env
```

Fill in the following values:

- `SLACK_SIGNING_SECRET`: Find in "Basic Information" > "App Credentials"
- `SLACK_BOT_TOKEN`: Find in "OAuth & Permissions" > "Bot User OAuth Token"
- `SLACK_CLIENT_ID`: Find in "Basic Information" > "App Credentials"
- `SLACK_CLIENT_SECRET`: Find in "Basic Information" > "App Credentials"
- `BASE_URL`: Your app's public URL (must be accessible by Slack)
- `OPENAI_API_KEY`: (Optional) Your OpenAI API key for AI-powered summarization
- `DIGEST_CHANNEL`: Channel ID where daily summaries will be posted (e.g., "C0123456789")
- `CRON_EXPR`: When to run daily summaries (default: "0 23 * * *" - 11:00 PM daily)
- `SOFT_DELETE_DAYS`: (Optional) Number of days after which raw messages are deleted

### 6. Database Setup

#### Option A: Local PostgreSQL (requires PostgreSQL installation)

1. Start the database:

```bash
docker-compose up -d postgres
```

2. Run migrations:

```bash
npx prisma migrate dev
```

#### Option B: Supabase (managed PostgreSQL)

1. Create a Supabase account at [https://supabase.io](https://supabase.io) if you don't have one.

2. Create a new project in Supabase.

3. Get your Supabase URL and anon key from the project's API settings.

4. Update your `.env` file with Supabase credentials:
   ```
   DATABASE_URL=postgresql://postgres:[DB_PASSWORD]@db.[SUPABASE_PROJECT_ID].supabase.co:5432/postgres
   SUPABASE_URL=https://[SUPABASE_PROJECT_ID].supabase.co
   SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY]
   ```

5. Run migrations to set up your database schema:
   ```bash
   npx prisma db push
   ```

### 7. Run the Application

#### Using Docker:

```bash
docker-compose up -d
```

#### Using Node.js locally:

```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Start the application (HTTP only)
npm run dev

# Start with HTTPS for Slack OAuth (recommended)
npm run setup:https
```

#### Using HTTPS for Local Development:

For Slack OAuth to work properly, you need HTTPS. The app includes a simple way to run with HTTPS locally:

```bash
# Generate self-signed certificates and start secure server
npm run setup:https

# Or individually:
# Generate certificates
npm run certs

# Run the secure server
npm run secure
```

> **Note:** When using self-signed certificates, you'll need to accept the security warning in your browser. This is normal for development environments.

### 8. Verify Installation

1. Check the logs to ensure the app started successfully
2. Visit your configured `BASE_URL` to see the health check status
3. Try mentioning the bot in a channel: `@YourAppName hello`

## Usage

Once installed and configured, the app will:

1. Listen for new messages in channels where it's invited
2. Process these messages in real-time
3. Generate daily summaries based on the configured schedule (`CRON_EXPR`)
4. Post daily digests to the configured channel (`DIGEST_CHANNEL`)

### Manual Operations

You can trigger operations manually using the following scripts:

- **Generate a summary for a specific time period:**
  ```bash
  node scripts/summary.js [days] [--channel=CHANNEL_NAME]
  ```

- **Generate and post daily summaries:**
  ```bash
  node scripts/daily-summary.js
  ```
  This script will generate summaries for the past day and post them to the designated Slack channel.

- **Generate and post hourly summaries:**
  ```bash
  node scripts/hourly-summarizer.js [hours]
  ```
  This script will generate summaries for the past hour (or specified hours) and post them to the designated Slack channel.

- **Generate and post 7-day summaries:**
  ```bash
  node scripts/post-summary.js
  ```
  This script will generate summaries for the past 7 days and post them to the designated Slack channel.

- **Seed the database with sample data:**
  ```bash
  node scripts/seed-database.js
  ```
  This will create sample channels, users, messages, and threads for testing.

- **Run a one-time ingestion for all channels since a specific date:**
  ```bash
  npm run ingest:once -- --since 2023-01-01T00:00:00Z
  ```

- **Force a summary generation and posting:**
  ```bash
  npm run cron:run
  ```

### Automated Operations and Deployment

The application includes several options for automation and deployment:

#### Quick Deployment

Use the provided deployment scripts to easily deploy your application:

**Windows (PowerShell):**
```powershell
# Run the PowerShell deployment script
.\deploy.ps1
```

**Windows (Batch):**
```batch
REM Run the batch deployment script
deploy.bat
```

**Linux/macOS:**
```bash
# Make the script executable
chmod +x ./deploy.sh

# Run the script
./deploy.sh
```

These scripts will guide you through deploying the app via different methods:
1. **Heroku**: Cloud-based deployment
2. **Docker**: Containerized deployment
3. **PM2**: Process manager for Node.js
4. **System Scheduler**: Task Scheduler (Windows) or Cron (Linux/macOS)

#### Hourly Summaries

To set up hourly summaries that run automatically:

**Method 1: Simple Node.js scheduler (No admin privileges required):**
```bash
# Run this in a terminal window
node scripts/scheduler.js

# Keep the terminal window open to keep the scheduler running
```

For production environments, use a process manager like PM2:
```bash
# Install PM2 globally
npm install -g pm2

# Start the scheduler with PM2
pm2 start ecosystem.config.js
```

**Method 2: System Scheduler (Requires admin privileges):**

**Windows (PowerShell):**
```powershell
# Run as Administrator
powershell -ExecutionPolicy Bypass -File scripts/setup-hourly-task.ps1
```

**Windows (Batch):**
```batch
REM Run as Administrator
scripts\setup-hourly-task.bat
```

**Linux/macOS:**
```bash
# Make the script executable
chmod +x ./scripts/setup-hourly-cron.sh

# Run the script
./scripts/setup-hourly-cron.sh
```

This will create a scheduled task (Windows) or cron job (Linux/macOS) that runs the hourly summary script every hour.

For more detailed deployment options, see [DEPLOYMENT.md](DEPLOYMENT.md) and [AUTOMATION.md](AUTOMATION.md).

## Production Deployment & Automatic Execution

The Slack Summarizer can be deployed to run automatically on various platforms.

### Quick Production Setup

For a quick production setup with Docker (recommended):

**Windows:**
```batch
setup-production.bat
```

**Linux/macOS:**
```bash
./deploy-production.sh
```

This will set up Docker containers that:
- Run the HTTPS server continuously
- Execute hourly summaries automatically (every hour)
- Execute daily summaries automatically (at midnight)
- Fetch new messages weekly (every Monday at 1 AM)

### Hosting Options

The application can be hosted in multiple ways:

1. **Docker containers** (recommended for production)
   ```bash
   npm run deploy:prod       # Linux/macOS
   npm run deploy:prod:windows  # Windows
   ```

2. **Windows Task Scheduler**
   ```powershell
   npm run setup:hourly
   ```

3. **Cloud providers** (Heroku, AWS, Azure)
   ```bash
   npm run deploy
   ```

4. **PM2 process manager**
   ```bash
   pm2 start ecosystem.config.js
   ```

For detailed deployment instructions for all hosting options, see [HOSTING.md](HOSTING.md)

## Troubleshooting

### Common Issues

#### Invalid Scope Error

If you see `invalid_scope` errors during installation:
- Verify that all required scopes are added in the "OAuth & Permissions" section
- Reinstall the app to your workspace after adding any missing scopes

#### Redirect URL Mismatch

If you encounter a redirect URL mismatch:
- Ensure the `BASE_URL` in your `.env` file matches exactly with the Redirect URL configured in "OAuth & Permissions"
- The redirect URL must be `https://<YOUR_DOMAIN>/slack/oauth/callback`
- For local development with HTTPS:
  - Make sure you're using the secure server: `npm run secure`
  - Set `BASE_URL=https://localhost:3000` in your `.env` file
  - Set the Redirect URL in Slack to `https://localhost:3000/slack/oauth/callback`
  - If Slack can't reach your local server, consider using a tunneling service like ngrok

#### Rate Limiting (429 Errors)

If you encounter rate limiting:
- The app implements automatic backoff when hitting rate limits
- For large workspaces, consider increasing the `RATE_LIMIT_DELAY` in the configuration
- Run initial backfills during off-hours

#### App Cannot Access Private Channels

If the app cannot access certain private channels:
- Verify that the bot has been invited to each private channel using `/invite @YourAppName`
- Remember that the bot can only access private channels where it has been explicitly invited

#### Missing Summaries

If summaries are not being generated:
- Check that the `CRON_EXPR` is configured correctly
- Verify that the bot has the `chat:write` permission
- Ensure the `DIGEST_CHANNEL` exists and the bot is a member of that channel

## License

MIT License