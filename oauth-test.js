const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Load certificates
const certPath = path.join(__dirname, 'certs', 'cert.pem');
const keyPath = path.join(__dirname, 'certs', 'key.pem');

// Options for HTTPS server
const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
};

// Slack OAuth test endpoint
app.get('/slack/oauth/test', (req, res) => {
  // This URL should match what you've set in the Slack app settings
  const slackClientId = process.env.SLACK_CLIENT_ID;
  const redirectUri = `${process.env.BASE_URL}/slack/oauth/callback`;
  
  if (!slackClientId) {
    return res.status(500).send('SLACK_CLIENT_ID is not set in environment variables');
  }
  
  // Construct OAuth URL
  const oauthUrl = `https://slack.com/oauth/v2/authorize?client_id=${slackClientId}&scope=channels:read,groups:read,im:read,mpim:read,channels:history,groups:history,im:history,mpim:history,users:read,users:read.email,reactions:read,chat:write,app_mentions:read&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  res.send(`
    <html>
      <head>
        <title>Slack OAuth Test</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            line-height: 1.5;
          }
          .container {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #1264A3; }
          .btn {
            display: inline-block;
            background-color: #1264A3;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 500;
            margin-top: 20px;
          }
          code {
            background-color: #f1f1f1;
            padding: 2px 5px;
            border-radius: 3px;
            font-family: monospace;
          }
          .info {
            background-color: #e3f2fd;
            border-left: 4px solid #2196f3;
            padding: 15px;
            margin: 20px 0;
          }
          .warning {
            background-color: #fff8e1;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Slack OAuth Test</h1>
          <p>This page helps you verify your Slack OAuth configuration is working correctly.</p>
          
          <div class="info">
            <h3>Current Configuration:</h3>
            <ul>
              <li>Base URL: <code>${process.env.BASE_URL || 'Not set'}</code></li>
              <li>OAuth Redirect URI: <code>${redirectUri}</code></li>
              <li>Client ID: <code>${slackClientId ? slackClientId.substring(0, 5) + '...' : 'Not set'}</code></li>
            </ul>
          </div>
          
          <div class="warning">
            <h3>Before Testing:</h3>
            <p>Make sure you have:</p>
            <ol>
              <li>Set <code>SLACK_CLIENT_ID</code>, <code>SLACK_CLIENT_SECRET</code>, and <code>BASE_URL</code> in your .env file</li>
              <li>Added <code>${redirectUri}</code> to your Slack App's Redirect URLs</li>
              <li>Added all required OAuth scopes to your Slack App</li>
            </ol>
          </div>
          
          <p>Click the button below to test the Slack OAuth flow:</p>
          <a href="${oauthUrl}" class="btn">Test Slack OAuth</a>
          
          <p style="margin-top: 30px">
            <b>What happens next:</b> You'll be redirected to Slack to authorize the app. 
            After authorization, Slack will redirect back to your callback URL.
          </p>
        </div>
      </body>
    </html>
  `);
});

// Simple callback handler
app.get('/slack/oauth/callback', (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>OAuth Error</h1>
          <p>Error: ${error}</p>
          <p>Please check your Slack app configuration.</p>
        </body>
      </html>
    `);
  }
  
  if (!code) {
    return res.status(400).send(`
      <html>
        <body>
          <h1>Invalid Request</h1>
          <p>No authorization code provided.</p>
        </body>
      </html>
    `);
  }
  
  // In a real implementation, you would exchange this code for tokens
  // For this test, we'll just acknowledge we received the code
  res.send(`
    <html>
      <head>
        <title>OAuth Success</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 40px;
            max-width: 800px;
            margin: 0 auto;
            text-align: center;
            line-height: 1.5;
          }
          .container {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 { color: #2EB67D; }
          .code {
            background-color: #f1f1f1;
            padding: 8px;
            border-radius: 4px;
            font-family: monospace;
            text-align: left;
            max-width: 400px;
            margin: 0 auto;
            overflow-wrap: break-word;
          }
          .success-icon {
            font-size: 48px;
            color: #2EB67D;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✅</div>
          <h1>Authentication Successful!</h1>
          <p>OAuth code was successfully received:</p>
          <div class="code">${code}</div>
          <p style="margin-top: 20px">In a real implementation, this code would be exchanged for access tokens.</p>
          <p>You can close this window and return to your application.</p>
        </div>
      </body>
    </html>
  `);
});

// Create HTTPS server
https.createServer(httpsOptions, app).listen(PORT, () => {
  console.log(`🔒 HTTPS server running on port ${PORT}`);
  console.log(`Visit https://localhost:${PORT}/slack/oauth/test to test Slack OAuth`);
});