import { buildApp } from './app';
import { loadEnv } from './env';

const env = loadEnv();
const app = await buildApp(env);

/**
 * SIGTERM is what PM2 and systemd send.
 *
 * Without this, a deploy cuts off whatever was in flight — including a lead somebody was in the
 * middle of submitting. `app.close()` stops accepting, drains what is open and closes the pool
 * through the `onClose` hook.
 */
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.log.info({ signal }, 'shutting down');
    void app.close().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}

try {
  await app.listen({ host: env.API_HOST, port: env.API_PORT });
} catch (error) {
  app.log.fatal(error, 'failed to start');
  process.exit(1);
}
