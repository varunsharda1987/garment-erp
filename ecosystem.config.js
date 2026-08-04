/**
 * PM2 Ecosystem Configuration for Garment ERP
 *
 * Two apps:
 *   - garment-erp-api: Backend API on port 5000
 *   - garment-erp-web: Static server on port 3000 (serves frontend + proxies /api)
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'garment-erp-api',
      cwd: './backend',
      script: 'dist/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      autorestart: true,
      max_restarts: 10,
      // An EADDRINUSE crash-loop exits in 1-3s; with the default min_uptime (1s) those count
      // as "stable" restarts and the loop grinds forever. 10s makes them unstable, so
      // max_restarts trips the app to errored (the fleet watchdog then reaps + alerts).
      min_uptime: 10000,
      // Space loop retries out (100ms doubling to ~15s) instead of hammering every 3s.
      exp_backoff_restart_delay: 100,
      max_memory_restart: '1G',
      kill_timeout: 8000,
      // Windows can't deliver SIGINT/SIGTERM to a Node child, so PM2 sends IPC message instead
      shutdown_with_message: true,
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      merge_logs: true,
    },
    {
      name: 'garment-erp-web',
      cwd: './server',
      script: 'static-server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        API_TARGET: 'http://localhost:5000',
      },
      autorestart: true,
      max_restarts: 10,
      min_uptime: 10000,
      exp_backoff_restart_delay: 100,
    },
    {
      name: 'garment-erp-watcher',
      cwd: './server',
      script: 'dev-watcher.js',
      autorestart: true,
      max_restarts: 3,
      // Watcher is optional - if it fails, don't keep retrying
      min_uptime: 5000,
    },
  ],
};
