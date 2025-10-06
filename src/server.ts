import express from 'express';
import { receiver } from './slack';
import logger from './logger';
import config from './config';
import prisma from './store';

// Create Express app from the receiver
const app = receiver.app;

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Add installation success page
app.get('/slack/installation-success', (req, res) => {
  res.status(200).send(`
    <html>
      <head>
        <title>Slack Summarizer - Installation Successful</title>
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
          ul {
            margin-top: 20px;
            padding-left: 20px;
          }
          li {
            margin-bottom: 10px;
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
          <h1>Installation Successful! 🎉</h1>
          <p>Slack Summarizer has been successfully installed to your workspace.</p>
          <p>Next steps:</p>
          <ul>
            <li>Add the app to the channels you want to summarize using <code>/invite @SlackSummarizer</code></li>
            <li>Remember that for private channels, you must explicitly invite the bot</li>
            <li>Daily summaries will be posted according to your configured schedule</li>
          </ul>
          <a href="https://slack.com" class="btn">Return to Slack</a>
        </div>
      </body>
    </html>
  `);
});

// Add installation error page
app.get('/slack/installation-error', (req, res) => {
  res.status(200).send(`
    <html>
      <head>
        <title>Slack Summarizer - Installation Failed</title>
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
            color: #E01E5A;
            margin-top: 0;
          }
          ul {
            margin-top: 20px;
            padding-left: 20px;
          }
          li {
            margin-bottom: 10px;
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
          <h1>Installation Failed</h1>
          <p>We encountered an issue while installing Slack Summarizer to your workspace.</p>
          <p>Common reasons for installation failures:</p>
          <ul>
            <li>Missing required scopes - ensure all required scopes are approved</li>
            <li>Redirect URL mismatch - check your app's OAuth configuration</li>
            <li>Permissions issues - you may need admin approval to install this app</li>
          </ul>
          <p>Please try again or contact support if the issue persists.</p>
          <a href="/slack/install" class="btn">Try Again</a>
        </div>
      </body>
    </html>
  `);
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
          <p>A Slack app that generates daily summaries of channel activity.</p>
          <a href="/slack/install" class="btn">Install to Slack</a>
        </div>
      </body>
    </html>
  `);
});

// Start the server
const startServer = async () => {
  try {
    // Connect to the database
    await prisma.$connect();
    logger.info('Connected to the database');
    
    // Start the server
    const server = app.listen(config.PORT, () => {
      logger.info(`Server is running on port ${config.PORT}`);
    });
    
    // Handle shutdown gracefully
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
      });
      await prisma.$disconnect();
      logger.info('Database connection closed');
      process.exit(0);
    });
    
    return server;
  } catch (error) {
    logger.error(error, 'Failed to start server');
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

export { app, startServer };