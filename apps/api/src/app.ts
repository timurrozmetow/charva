import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';

import { type Env } from './env';

/**
 * Builds the Fastify instance.
 *
 * Kept separate from `server.ts` so tests can build an app without binding a port. Phase 3
 * adds helmet, CORS, compression, rate limiting, the request-context plugin, the error
 * envelope and the Zod type provider; this is the boot skeleton those hang off.
 */
export function buildApp(env: Env): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
        : {}),
    },
    trustProxy: true,
  });

  void app.register(sensible);

  app.get('/health', () => ({ status: 'ok' }));

  return app;
}
