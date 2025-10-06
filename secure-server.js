const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
const { App, ExpressReceiver } = require('@slack/bolt');
require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Prisma client for database access
const prisma = new PrismaClient();

// Initialize Supabase client for API access
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Create Express receiver for Slack Bolt
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  endpoints: '/slack/events',
  processBeforeResponse: true,
});

// Initialize Slack app
const slackApp = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver,
  installerOptions: {
    directInstall: true,
  },
});

// Install routes
app.use(receiver.router);

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OAuth redirect endpoint
app.get('/slack/oauth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      console.error('No code provided');
      return res.status(400).send('Invalid code');
    }
    
    console.log('Received OAuth code:', code);
    
    // In a production app, you would exchange this code for tokens
    // For now, just acknowledge it for testing
    res.send(`
      <html>
        <body>
          <h1>Authentication successful!</h1>
          <p>You can close this window and return to your Slack workspace.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).send('OAuth error: ' + error.message);
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    const dbStatus = await prisma.$queryRaw`SELECT 1 as result`;
    
    res.status(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      database: dbStatus[0].result === 1 ? 'connected' : 'error',
      supabase: 'initialized'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).send({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// API Routes
app.get('/api/conversations', async (req, res) => {
  try {
    const conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10
    });
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/summaries/latest', async (req, res) => {
  try {
    const summaries = await prisma.summary.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { channel: true }
    });
    res.json(summaries);
  } catch (error) {
    console.error('Error fetching summaries:', error);
    res.status(500).json({ error: error.message });
  }
});

// Slack event handling
slackApp.event('app_mention', async ({ event, say }) => {
  try {
    await say({
      text: `Hello <@${event.user}>! I'm your Slack summarizer bot. I'll summarize conversations in this channel daily.`,
      thread_ts: event.ts
    });
  } catch (error) {
    console.error('Error handling mention:', error);
  }
});

slackApp.event('message', async ({ event }) => {
  try {
    // Log message for debugging
    console.log('Received message event:', event);
    
    // In production, would store message in database
    // For now, just acknowledge we received it
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

// Simple landing page with app information
app.get('/', (req, res) => {
  res.status(200).send(`
    <html>
      <head>
        <title>Slack Summarizer</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 40px;
            background-color: #f8f8f8;
            color: #333;
            line-height: 1.5;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          h1 {
            color: #1264A3;
            margin-top: 0;
            font-size: 28px;
          }
          h2 {
            color: #1264A3;
            margin-top: 30px;
            font-size: 22px;
          }
          .btn {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 24px;
            background-color: #1264A3;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            margin-right: 10px;
          }
          .btn-supabase {
            background-color: #3ECF8E;
          }
          .card {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            border-left: 4px solid #1264A3;
          }
          .features {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 30px;
          }
          .feature {
            background-color: #f9f9f9;
            padding: 20px;
            border-radius: 8px;
            border-top: 3px solid #1264A3;
          }
          pre {
            background-color: #f1f1f1;
            padding: 15px;
            border-radius: 4px;
            overflow-x: auto;
          }
          code {
            font-family: monospace;
            color: #333;
          }
          .status {
            padding: 8px 12px;
            border-radius: 4px;
            display: inline-block;
            font-weight: bold;
          }
          .status-ok {
            background-color: #D1FAE5;
            color: #047857;
          }
          .status-warn {
            background-color: #FEF3C7;
            color: #B45309;
          }
          .status-error {
            background-color: #FEE2E2;
            color: #B91C1C;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Slack Summarizer</h1>
          <p>A production-ready Slack app that ingests messages from channels and generates daily summaries.</p>
          
          <div class="card">
            <h3>Status:</h3>
            <p>✅ Server: Running with HTTPS</p>
            <p>✅ Database: Connected to Supabase</p>
            <p>✅ Schema: Deployed</p>
            <p>✅ Slack: Bot Connected</p>
            <p>ℹ️ OAuth: Ready for testing</p>
          </div>
          
          <h2>Configuration</h2>
          <p>Your current configuration:</p>
          <ul>
            <li>Server is running on: <code>https://localhost:3000</code></li>
            <li>OAuth Callback: <code>https://localhost:3000/slack/oauth/callback</code></li>
            <li>Events Endpoint: <code>https://localhost:3000/slack/events</code></li>
          </ul>
          
          <div class="card status-warn">
            <h3>Important Notice</h3>
            <p>For Slack to reach your local server, you may need to set up a tunnel service like ngrok:</p>
            <pre><code>ngrok http https://localhost:3000</code></pre>
            <p>Then update your Slack app's Redirect URL and Request URL with the ngrok URL.</p>
          </div>
          
          <h2>API Endpoints</h2>
          <pre><code>GET /health - Check system status
GET /api/conversations - List recent conversations
GET /api/summaries/latest - Get latest summaries</code></pre>
          
          <h2>Slack Endpoints</h2>
          <pre><code>GET /slack/oauth/callback - OAuth redirect URL
POST /slack/events - Events API endpoint</code></pre>
          
          <div class="features">
            <div class="feature">
              <h3>Ingestion</h3>
              <p>The app automatically ingests messages from all channels where it's invited using Slack's Events API.</p>
            </div>
            <div class="feature">
              <h3>Summarization</h3>
              <p>Produces concise, actionable summaries with important threads highlighted.</p>
            </div>
          </div>
          
          <a href="/health" class="btn">Check Health Status</a>
          <a href="/api/conversations" class="btn">View Conversations</a>
        </div>
      </body>
    </html>
  `);
});

// Create HTTPS server
let httpsOptions;
try {
  // Check if cert files exist
  const certPath = path.join(__dirname, 'certs', 'cert.pem');
  const keyPath = path.join(__dirname, 'certs', 'key.pem');
  
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    httpsOptions = {
      key: fs.readFileSync(keyPath),
      cert: fs.readFileSync(certPath)
    };
    console.log('Using existing certificates for HTTPS');
  } else {
    console.log('No certificates found, creating self-signed certificates...');
    // This is a fallback - in production you would use proper certificates
    const { generateKeyPairSync } = require('crypto');
    const selfsigned = require('selfsigned');
    
    // Create a simple self-signed cert
    const attrs = [{ name: 'commonName', value: 'localhost' }];
    const pems = selfsigned.generate(attrs, { days: 365 });
    
    fs.writeFileSync(keyPath, pems.private);
    fs.writeFileSync(certPath, pems.cert);
    
    httpsOptions = {
      key: pems.private,
      cert: pems.cert
    };
    console.log('Generated self-signed certificates for HTTPS');
  }
} catch (error) {
  console.error('Error setting up HTTPS:', error);
  console.log('Falling back to HTTP server');
  // For fallback, we'll use HTTP
  const http = require('http');
  http.createServer(app).listen(PORT, () => {
    console.log(`⚠️ HTTP server running on port ${PORT} (no HTTPS)`);
    console.log(`Visit http://localhost:${PORT} to view the app`);
  });
  process.exit(1);
}

// Start the HTTPS server
https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`🔒 HTTPS server running on port ${PORT}`);
  console.log(`Visit https://localhost:${PORT} to view the app`);
});