module.exports = {
  apps: [
    {
      name: 'findmydonor-backend',
      script: 'dist/server.cjs',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        APP_URL: 'https://findmydonor.online',
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: '350M',
      kill_timeout: 5000,
      listen_timeout: 10000
    },
    {
      name: 'findmydonor-admin',
      script: 'dist/admin-server.cjs',
      env: {
        NODE_ENV: 'production',
        ADMIN_PORT: 6000,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: '200M',
      kill_timeout: 5000,
      listen_timeout: 10000
    },
    {
      // Serves the pre-built Vite frontend on port 3001 using a tiny express static file server
      name: 'findmydonor-frontend',
      script: 'serve-frontend.cjs',
      env: {
        NODE_ENV: 'production',
        FRONTEND_PORT: 3001,
      },
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: '100M',
    }
  ]
}
