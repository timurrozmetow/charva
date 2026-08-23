import compress from '@fastify/compress';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { type Pool } from 'mysql2/promise';
import { z } from 'zod';

import { createDb, createPool, type Database } from './db/client';
import { type Env } from './env';
import { createMailer, type Mailer } from './lib/mailer';
import { adminRoutes } from './modules/admin/routes';
import { builderRoutes } from './modules/builder/routes';
import { choiceRoutes } from './modules/choice/routes';
import { globalRoutes } from './modules/global/routes';
import { leadRoutes } from './modules/leads/routes';
import { mediaRoutes } from './modules/media/routes';
import { shellRoutes } from './modules/shell/routes';
import { umrahRoutes } from './modules/umrah/routes';
import { adminAuthPlugin } from './plugins/admin-auth';
import { cachePlugin } from './plugins/cache';
import { errorHandler } from './plugins/error-handler';
import { decorateLocale } from './plugins/locale';

/**
 * The public API.
 *
 * Everything a visitor of any of the three sites reads goes through here, and one rule shapes
 * the whole file: **every route declares a response schema**. That is not tidiness. The Zod type
 * provider installs those schemas as the serialiser, so a field nobody declared cannot reach a
 * browser — which is how the ban on Umrah prices stops being a convention somebody eventually
 * forgets and becomes a property of the wire (decision D-12).
 *
 * Built separately from `server.ts` so tests can construct an app without binding a port.
 */

/** The version prefix. Every route below lives under it; nothing is served from the root. */
export const API_PREFIX = '/api/v1';

/**
 * What was actually registered, as opposed to what anyone remembers registering.
 *
 * `routes.contract.db.test.ts` walks this to assert that every route declares a response schema
 * — the property the whole D-12 mechanism rests on. An inventory maintained by hand would list
 * whatever somebody last remembered to add to it, which is the one thing that must not happen
 * here: a route missing from the list is exactly the route that leaks.
 */
export interface RegisteredRoute {
  method: string;
  url: string;
  /** Absent means this route's body is not serialised from a declared shape. */
  responseSchemas: string[] | undefined;
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
    pool: Pool;
    env: Env;
    mailer: Mailer;
    registeredRoutes: RegisteredRoute[];
  }
}

export interface BuildOptions {
  /** Supplied by tests, which share one pool across a suite rather than opening ten. */
  pool?: Pool;
  /** Supplied by tests that want to assert what would have been sent, without sending it. */
  mailer?: Mailer;
}

export async function buildApp(env: Env, options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === 'development'
        ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss' } } }
        : {}),
      /** Never log a passport number, a phone or a token, whatever else changes. */
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.passportNumber',
          'req.body.phone',
          'req.body.formToken',
        ],
        remove: true,
      },
    },
    // nginx terminates TLS and forwards; without this every visitor's address is 127.0.0.1,
    // which would make the per-address rate limit a single global one.
    trustProxy: true,
    // A stable id per request, echoed in every error envelope. It is what ties a failure
    // somebody reports over the phone to a line in the log.
    requestIdHeader: 'x-request-id',
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  const registeredRoutes: RegisteredRoute[] = [];
  app.decorate('registeredRoutes', registeredRoutes);
  app.addHook('onRoute', (route) => {
    if (route.method === 'HEAD' || route.method === 'OPTIONS') return;
    const response = (route.schema as { response?: Record<string, unknown> } | undefined)?.response;
    registeredRoutes.push({
      method: Array.isArray(route.method) ? route.method.join(',') : route.method,
      url: route.url,
      responseSchemas: response === undefined ? undefined : Object.keys(response),
    });
  });

  const pool = options.pool ?? createPool();
  app.decorate('pool', pool);
  app.decorate('db', createDb(pool));
  app.decorate('env', env);

  // Off unless SMTP is fully configured, and off in tests unless a test configures it: the
  // suite must never open a socket to Gmail, and `createMailer` returning a null object is how
  // that is guaranteed rather than remembered.
  const mailer = options.mailer ?? createMailer(env, app.log);
  app.decorate('mailer', mailer);

  // The pool is this app's to close only when this app opened it.
  if (options.pool === undefined) {
    app.addHook('onClose', async () => {
      await pool.end();
    });
  }

  if (options.mailer === undefined) {
    app.addHook('onClose', async () => {
      await mailer.close();
    });
  }

  await app.register(sensible);
  await app.register(errorHandler);
  await app.register(helmet, {
    // The API serves JSON and images to three other origins; a default CSP here would apply to
    // `/docs` and to nothing else that matters, and would block its own bundle.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  /*
   * CORS by allowlist, never `*`.
   *
   * The admin host sends a session cookie, and a wildcard origin is incompatible with
   * credentials in every browser — so the wildcard would have to be removed later anyway, at the
   * point where getting it wrong logs somebody out in production. An empty allowlist means
   * same-origin only, which is what a misconfigured deploy should do rather than open up.
   */
  await app.register(cors, {
    origin: env.CORS_ORIGINS.length === 0 ? false : env.CORS_ORIGINS,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86_400,
  });

  await app.register(compress, {
    // Below this, the compressed body plus its headers is bigger than what it replaced.
    threshold: 1024,
    encodings: ['br', 'gzip', 'deflate'],
  });

  /*
   * The read ceiling.
   *
   * Deliberately generous: it exists to stop a scraper walking the catalogue, not to inconvenience
   * a visitor opening six tabs. The form endpoints set their own, much tighter, limit — that is
   * anti-spam layer one and it lives with the routes it defends.
   */
  await app.register(rateLimit, {
    global: true,
    max: env.READ_RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    // In-process, like the cache, and correct for exactly the reason D-7 gives: one PM2 fork.
    // Cluster mode would give each worker its own counter and multiply every limit by four.
    keyGenerator: (request) => request.ip,
    addHeadersOnExceeding: { 'x-ratelimit-remaining': true },
  });

  await app.register(cachePlugin, { ttlSeconds: env.CACHE_TTL_SECONDS });
  await app.register(adminAuthPlugin);
  decorateLocale(app);

  await registerDocs(app);
  registerHealth(app);

  await app.register(mediaRoutes, { prefix: API_PREFIX });
  await app.register(choiceRoutes, { prefix: API_PREFIX });
  await app.register(globalRoutes, { prefix: `${API_PREFIX}/global` });
  await app.register(builderRoutes, { prefix: `${API_PREFIX}/global/builder` });
  await app.register(umrahRoutes, { prefix: `${API_PREFIX}/umrah` });
  await app.register(leadRoutes, { prefix: API_PREFIX });
  await app.register(adminRoutes, { prefix: `${API_PREFIX}/admin` });
  await app.register(shellRoutes, { prefix: API_PREFIX });

  await app.ready();
  return app;
}

/**
 * OpenAPI from the same Zod schemas that validate and serialise.
 *
 * Generated rather than written, so the documentation cannot describe a route that no longer
 * behaves that way — which is the only failure mode hand-written API docs really have.
 */
async function registerDocs(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Charva Travel API',
        description:
          'Public read API for charva-travel.com, global.charva-travel.com and ' +
          'umra.charva-travel.com, plus the two lead forms. Every route declares a response ' +
          'schema; the schema is the serialiser, which is what keeps Umrah prices off the wire.',
        version: '1.0.0',
      },
      servers: [{ url: API_PREFIX }],
      tags: [
        { name: 'global', description: 'Charva Travel Global — the tour catalogue' },
        { name: 'umrah', description: 'Charva Umrah — the pilgrimage. No prices, ever.' },
        { name: 'builder', description: 'The tour builder: rates in, quote out' },
        { name: 'forms', description: 'Leads and signups, and the token that guards them' },
        { name: 'media', description: 'Images, resized on demand' },
        { name: 'admin', description: 'Behind the login. Same origin as the admin SPA (D-20)' },
        { name: 'shell', description: 'The SPA shell, head rendered for crawlers (D-4)' },
        { name: 'ops', description: 'Liveness and readiness' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, { routePrefix: '/docs' });
}

/**
 * Liveness and readiness, which are different questions.
 *
 * `/health` asks whether the process is running and answers without touching anything, because
 * a health check that depends on the database restarts the API when the database hiccups.
 * `/ready` asks whether it can actually serve, so it does touch the database — that is the one
 * the load balancer and the deploy script wait on.
 */
function registerHealth(app: FastifyInstance): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    '/health',
    {
      schema: {
        tags: ['ops'],
        summary: 'Liveness. Touches nothing.',
        response: { 200: z.object({ status: z.literal('ok'), uptimeSeconds: z.number() }) },
      },
    },
    () => ({ status: 'ok' as const, uptimeSeconds: Math.round(process.uptime()) }),
  );

  typed.get(
    '/ready',
    {
      schema: {
        tags: ['ops'],
        summary: 'Readiness. Round-trips the database.',
        response: {
          200: z.object({ status: z.literal('ready'), database: z.literal('up') }),
          503: z.object({ status: z.literal('unready'), database: z.literal('down') }),
        },
      },
    },
    async (_request, reply) => {
      try {
        await app.pool.query('SELECT 1');
        return { status: 'ready' as const, database: 'up' as const };
      } catch (error) {
        app.log.error({ err: error }, 'readiness probe failed');
        return reply.code(503).send({ status: 'unready' as const, database: 'down' as const });
      }
    },
  );
}
