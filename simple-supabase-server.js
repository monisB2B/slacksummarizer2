// Simple server with Supabase client instead of direct database connection
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Get Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client if credentials are available
let supabase = null;
if (supabaseUrl && supabaseAnonKey && supabaseAnonKey !== '[PASTE_YOUR_FULL_ANON_KEY_HERE]') {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('Supabase client initialized with URL:', supabaseUrl);
} else {
  console.log('Supabase credentials missing or incomplete');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    supabase: supabase ? 'initialized' : 'not configured',
  });
});

// Supabase test endpoint - using client API instead of direct DB
app.get('/supabase-test', async (req, res) => {
  if (!supabase) {
    return res.status(400).send({
      status: 'error',
      message: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.',
    });
  }

  try {
    // Test a simple query using the Supabase client
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);

    if (error) {
      return res.status(200).send({
        status: 'connected',
        message: 'Supabase connection successful, but the "profiles" table does not exist yet.',
        error: error.message,
        recommendation: 'Run "npx prisma db push" to create your schema'
      });
    }

    return res.status(200).send({
      status: 'success',
      message: 'Supabase connection successful and profiles table exists',
      data,
    });
  } catch (err) {
    return res.status(500).send({
      status: 'error',
      message: 'Error testing Supabase connection',
      error: err.message,
    });
  }
});

// Simple landing page
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
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          h1 {
            color: #1264A3;
            margin-top: 0;
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
          }
          .btn-supabase {
            background-color: #3ECF8E;
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
          .status-error {
            background-color: #FEE2E2;
            color: #B91C1C;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Slack Summarizer</h1>
          <p>This is a simplified version of the Slack Summarizer application.</p>
          <p>Current Status: <span class="status status-ok">Running</span></p>
          <p>Supabase: <span class="status ${supabase ? 'status-ok' : 'status-error'}">${supabase ? 'Configured' : 'Not Configured'}</span></p>
          <p>Next steps:</p>
          <ol>
            ${!supabase ? '<li><strong>Update your .env file with Supabase anon key</strong></li>' : ''}
            <li>Create your database schema with <code>npx prisma db push</code></li>
            <li>Configure your Slack App credentials</li>
            <li>Run the full application once database and credentials are ready</li>
          </ol>
          <a href="/health" class="btn">Check Health Status</a>
          <a href="/supabase-test" class="btn btn-supabase">Test Supabase Connection</a>
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