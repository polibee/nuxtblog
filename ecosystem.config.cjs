module.exports = {
  apps: [{
    name: 'nuxtblog',
    script: '.output/server/index.mjs',
    instances: process.env.PM2_INSTANCES || 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    listen_timeout: 10000,
    kill_timeout: 5000,
    env_production: {
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: 3000
    }
  }]
}
