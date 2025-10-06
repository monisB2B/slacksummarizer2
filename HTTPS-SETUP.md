# HTTPS Setup for Slack OAuth

This guide will help you set up HTTPS for local development to support Slack OAuth redirect URLs.

## Files Created

1. `secure-server.js` - An HTTPS server that handles Slack OAuth callbacks
2. `generate-certs.js` - A script to generate self-signed certificates for HTTPS
3. `oauth-test.js` - A test server to verify your Slack OAuth configuration
4. `start-secure.bat` & `start-secure.ps1` - Convenience scripts to start the secure server

## Quick Start

1. Make sure your `.env` file has the following settings:
   ```
   BASE_URL=https://localhost:3000
   SLACK_SIGNING_SECRET=your_slack_signing_secret
   SLACK_BOT_TOKEN=your_slack_bot_token
   SLACK_CLIENT_ID=your_slack_client_id
   SLACK_CLIENT_SECRET=your_slack_client_secret
   ```

2. Update your Slack App configuration:
   - Set the OAuth Redirect URL to: `https://localhost:3000/slack/oauth/callback`
   - Set the Events API URL to: `https://localhost:3000/slack/events`

3. Run the secure server using:
   ```
   npm run setup:https
   ```
   Or directly:
   ```
   node generate-certs.js
   node secure-server.js
   ```

4. Test your OAuth configuration:
   ```
   node oauth-test.js
   ```
   Then open: https://localhost:3000/slack/oauth/test

## Important Notes

- When using self-signed certificates, you'll need to accept the security warning in your browser.
- For Slack to reach your local server, you may need to use a tunnel service like ngrok:
  ```
  ngrok http https://localhost:3000
  ```
  Then update your Slack app configuration with the ngrok URL.

## Troubleshooting

If you have issues:

1. Check your `.env` file for correct values
2. Make sure the certificates are generated in the `certs` directory
3. Verify your Slack App configuration matches your local setup
4. Check the console output for any error messages
5. Use the OAuth test page to verify your configuration

## Next Steps

1. Implement the full Slack OAuth flow in your application
2. Set up proper token storage and user authentication
3. Implement the Events API handlers for Slack events
4. Deploy to a production environment with proper HTTPS certificates