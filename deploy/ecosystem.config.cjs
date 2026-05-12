// PM2 ecosystem config for WenShan API server
// Usage: pm2 start deploy/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'wenshan-api',
      script: 'server/prodServer.ts',
      interpreter: 'npx',
      interpreter_args: 'tsx',
      cwd: process.cwd(),
      env: {
        NODE_ENV: 'production',
        PORT: '3001',
      },
      // ── Process management ──
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '300M',
      // ── Logs ──
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'logs/wenshan-error.log',
      out_file: 'logs/wenshan-out.log',
      merge_logs: true,
      // ── Restart behavior ──
      max_restarts: 10,
      restart_delay: 5000,
      kill_timeout: 10000,
    },
  ],
}
