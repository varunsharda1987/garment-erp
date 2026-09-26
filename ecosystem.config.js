/**
 * PM2 Ecosystem Configuration for Garment ERP
 *
 * Three apps:
 *   - garment-erp-api:      Backend API on port 5000
 *   - garment-erp-web:      Static server on port 3000 (serves frontend + proxies /api)
 *   - garment-erp-deployer: ships each commit on main, one deploy at a time (scripts/ship/)
 *
 * The PM2 daemon is SHARED with other businesses: never `pm2 stop all` / `restart all` /
 * `reload all` / `kill`. Name the app (`--only garment-erp-deployer`), and restart the api/web
 * only through C:\Users\NEW\ops\pm2-safe-restart.js.
 *
 * Usage:
 *   pm2 start ecosystem.config.js --only garment-erp-deployer
 *   pm2 logs garment-erp-api
 *   npm run ship:status
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
    // The ONLY thing that puts code live. Replaced garment-erp-watcher (2026-09-26), which rebuilt
    // and restarted the live app on every file SAVE in this shared folder — so every Claude
    // terminal's half-typed edits went live within seconds. See scripts/ship/deployer.js.
    {
      name: 'garment-erp-deployer',
      cwd: '.',
      script: 'scripts/ship/deployer.js',
      autorestart: true,
      max_restarts: 5,
      min_uptime: 10000,
      // A deploy stops/starts the api and web through pm2-safe-restart; give it time to finish
      // the current step if PM2 ever stops the deployer itself.
      kill_timeout: 8000,
    },
  ],
};
