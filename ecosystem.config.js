module.exports = {
  apps: [
    {
      name: 'golden-tap-backend',
      script: 'dist/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      error_file: 'logs/pm2-error.log',
      out_file: 'logs/pm2-out.log',
      log_file: 'logs/pm2-combined.log',
      time: true,
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3001,
      },
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      restart_delay: 3000,
      autorestart: true,
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
    },
  ],
};
