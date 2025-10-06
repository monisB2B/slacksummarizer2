module.exports = {
  apps: [
    {
      name: "slack-summarizer-server",
      script: "secure-server.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      name: "slack-summarizer-cron",
      script: "scripts/hourly-summarizer.js",
      cron_restart: "0 * * * *", // Run every hour at the beginning of the hour
      watch: false,
      autorestart: false
    }
  ]
};