/**
 * PM2, one process, fork mode.
 *
 * `instances: 1` and `exec_mode: 'fork'` are decision D-7 and not a starting point to grow out
 * of. The response cache and all three rate limiters live inside the process, so two workers
 * would mean two caches disagreeing about what was published and every limit doubled — five
 * lead submissions per ten minutes would silently become ten. The day a second instance is
 * genuinely needed, Redis comes first and this file changes second, in that order.
 *
 * CommonJS because PM2 reads its config with `require`, and this package is ESM.
 */
module.exports = {
  apps: [
    {
      name: 'charva-api',
      // The release directory is a symlink, and PM2 resolves it once at start. That is what
      // makes a deploy atomic: the new release is built and linked, then the process restarts
      // and picks up the new target. `pm2 reload` would not — see deploy.sh.
      cwd: '/opt/charva/current/apps/api',
      script: 'dist/server.js',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',

      env: {
        NODE_ENV: 'production',
      },

      /*
       * Restart on memory, because sharp is the one thing here that can grow without a leak.
       * Resizing a 20 MB upload allocates in a native heap Node's GC does not see, and a run
       * of large images leaves the process resident far above its idle footprint. 600 MB is
       * well above normal and well below anything a small VPS would start swapping at.
       */
      max_memory_restart: '600M',

      // A crash loop should stop looking like a working server. Ten fast restarts and PM2
      // gives up, which is what makes the uptime check fire instead of flapping for hours.
      max_restarts: 10,
      min_uptime: '20s',
      restart_delay: 2000,

      // Timestamped, and merged rather than split per instance — there is one instance.
      out_file: '/opt/charva/shared/logs/api-out.log',
      error_file: '/opt/charva/shared/logs/api-error.log',
      merge_logs: true,
      time: true,

      // The API closes its pool and finishes in-flight requests on SIGINT. Give it room, and
      // wait for its own signal rather than guessing from the process being up.
      kill_timeout: 10_000,
      wait_ready: false,
      listen_timeout: 10_000,
    },
  ],
};
