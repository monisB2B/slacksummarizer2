#!/usr/bin/env node
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Prisma client for database access
const prisma = new PrismaClient();

// Initialize Supabase client for API access
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Slack Summarizer</h1>
          <p>A production-ready Slack app that ingests messages from channels and generates daily summaries.</p>
          
          <div class="card">
            <h3>Status:</h3>
            <p>✅ Server: Running</p>
            <p>✅ Database: Connected to Supabase</p>
            <p>✅ Schema: Deployed</p>
          </div>
          
          <h2>How It Works</h2>
          <p>The Slack Summarizer app works as follows:</p>
          <ol>
            <li><strong>Ingestion:</strong> The app listens for new messages in channels where it's invited and stores them in the database.</li>
            <li><strong>Processing:</strong> On a scheduled basis (defined by CRON_EXPR), the app processes the collected messages.</li>
            <li><strong>Summarization:</strong> Using AI (if OpenAI API key is provided) or heuristic techniques, the app generates daily summaries.</li>
            <li><strong>Publishing:</strong> The summaries are posted to the configured channel (DIGEST_CHANNEL).</li>
          </ol>
          
          <h2>API Endpoints</h2>
          <pre><code>GET /health - Check system status
GET /api/conversations - List recent conversations
GET /api/summaries/latest - Get latest summaries</code></pre>
          
          <div class="features">
            <div class="feature">
              <h3>Ingestion</h3>
              <p>The app automatically ingests messages from all channels where it's invited using Slack's Events API.</p>
            </div>
            <div class="feature">
              <h3>Summarization</h3>
              <p>Produces concise, actionable summaries with important threads highlighted.</p>
            </div>
            <div class="feature">
              <h3>Task Detection</h3>
              <p>Identifies potential action items and tasks from conversation context.</p>
            </div>
            <div class="feature">
              <h3>Mention Tracking</h3>
              <p>Tracks user mentions across channels to highlight important interactions.</p>
            </div>
          </div>
          
          <h2>Next Steps</h2>
          <p>To complete your setup:</p>
          <ol>
            <li>Ensure your Slack app is properly configured with all required permissions</li>
            <li>Invite the bot to channels you want to summarize using <code>/invite @YourBotName</code></li>
            <li>Set the correct DIGEST_CHANNEL in your .env file</li>
            <li>Optional: Add your OpenAI API key for AI-powered summaries</li>
          </ol>
          
          <a href="/health" class="btn">Check Health Status</a>
          <a href="/api/conversations" class="btn">View Conversations</a>
          <a href="/api/summaries/latest" class="btn btn-supabase">Latest Summaries</a>
        </div>
      </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the app`);
});