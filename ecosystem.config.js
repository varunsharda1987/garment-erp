/**
 * PM2 Ecosystem Configuration
 *
 * PM2 is a production process manager for Node.js applications
 * with built-in load balancer, auto-restart, and monitoring.
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --env production
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'garment-erp-backend',
      script: './backend/dist/server.js',
      cwd: './backend',
      instances: 2, // Number of instances (0 = CPU cores, 1 = single instance, 2+ = cluster mode)
      exec_mode: 'cluster', // cluster or fork
      watch: false, // Watch for file changes (disable in production)
      max_memory_restart: '1G', // Restart if memory usage exceeds 1GB
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      error_file: './backend/logs/pm2-error.log',
      out_file: './backend/logs/pm2-out.log',
      log_file: './backend/logs/pm2-combined.log',
      time: true, // Prefix logs with timestamp
      merge_logs: true, // Merge logs from all instances
      autorestart: true, // Auto restart on crash
      max_restarts: 10, // Max number of unstable restarts
      min_uptime: '10s', // Min uptime to consider app stable
      restart_delay: 4000, // Delay between restarts (ms)
      kill_timeout: 5000, // Time to wait for graceful shutdown
      listen_timeout: 3000, // Time to wait for app to be ready

      // Advanced features
      exp_backoff_restart_delay: 100, // Exponential backoff restart delay

      // Graceful shutdown
      shutdown_with_message: true,

      // Source map support
      source_map_support: true,

      // Instance variables
      instance_var: 'INSTANCE_ID',
    },
  ],

  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/varunsharda1987/garment-erp.git',
      path: '/var/www/garment-erp',
      'post-deploy': 'cd backend && npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'echo "Setting up server..."',
    },
  },
};
