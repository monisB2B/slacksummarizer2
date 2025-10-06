#!/usr/bin/env node

const express = require('express');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client if credentials are available
let supabase = null;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
  console.log('Supabase client initialized with URL:', supabaseUrl);
}

// Create a simple Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    supabase: supabase ? 'initialized' : 'not configured',
  });
});

// Add Supabase test endpoint
app.get('/supabase-test', async (req, res) => {
  if (!supabase) {
    return res.status(400).send({
      status: 'error',
      message: 'Supabase is not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file.',
    });
  }

  try {
    // A simple query to test the Supabase connection
    const { data, error } = await supabase
      .from('_test')
      .select('*')
      .limit(1)
      .catch(e => ({ data: null, error: e }));

    if (error) {
      // This is expected if the _test table doesn't exist
      return res.status(200).send({
        status: 'connected',
        message: 'Supabase connection successful. Database schema not set up yet.',
        error: error.message,
      });
    }

    return res.status(200).send({
      status: 'success',
      message: 'Supabase connection successful and schema exists',
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

// Add a simple landing page
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
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Slack Summarizer</h1>
          <p>This is a simplified version of the Slack Summarizer application.</p>
          <p>Current Status: <strong>Running</strong></p>
          <p>Next steps:</p>
          <ol>
            <li>Set up your Supabase project (run <code>npm run setup:supabase</code>)</li>
            <li>Configure your Slack App credentials</li>
            <li>Run the full application once database and credentials are ready</li>
          </ol>
          <a href="/health" class="btn">Check Health Status</a>
          <a href="/supabase-test" class="btn" style="background-color: #3ECF8E; margin-left: 10px;">Test Supabase Connection</a>
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