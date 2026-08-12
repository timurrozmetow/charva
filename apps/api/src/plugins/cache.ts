import { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

import { ifNoneMatchSatisfied, ResponseCache } from '../lib/response-cache';

/**
 * Sixty seconds of memory, and an ETag so the second minute costs nothing either.
 *
 * Two savings, and the second is the larger one. The cache spares the database the same nine
 * queries the homepage makes every time somebody arrives; the ETag spares the *network* the
 * response body, which is what matters for an audience on mobile data in Ashgabat. A visitor
 * moving between pages revalidates with a header and gets 304 and no body at all.
 *
 * Stale content is bounded at a minute, and the admin bumping the generation (phase 7) clears
 * it immediately, so an editor never watches a page fail to change.
 */
declare module 'fastify' {
  interface FastifyInstance {
    responseCache: ResponseCache;
  }
  interface FastifyContextConfig {
    /** Opt in per route. Health, docs, images and every POST stay out of it. */
    cache?: boolean;
  }
}

/** Bookkeeping between the two hooks, kept off the request object's public surface. */
const PENDING = new WeakMap<object, string>();

export interface CacheOptions {
  ttlSeconds: number;
}

/**
 * The key is the generation, the method and the URL with its query sorted.
 *
 * Sorting matters: `?page=2&lang=en` and `?lang=en&page=2` are one response and would otherwise
 * be two entries. The language needs no separate term — it is either in the query or it is the
 * site's default, and the site is decided by the path, which is already here.
 */
function cacheKey(cache: ResponseCache, method: string, url: string): string {
  const [path = url, query] = url.split('?');
  const sorted =
    query === undefined
      ? ''
      : [...new URLSearchParams(query).entries()]
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([name, value]) => `${name}=${value}`)
          .join('&');

  return cache.key([method, path, sorted]);
}

export const cachePlugin = fp<CacheOptions>(function cachePlugin(
  app: FastifyInstance,
  options,
  done,
) {
  const ttlMs = options.ttlSeconds * 1000;
  const cache = new ResponseCache(ttlMs);
  const cacheControl = `public, max-age=${String(options.ttlSeconds)}, stale-while-revalidate=300`;

  app.decorate('responseCache', cache);

  if (ttlMs <= 0) {
    done();
    return;
  }

  app.addHook('onRequest', (request, reply, next) => {
    if (request.method !== 'GET' || request.routeOptions.config.cache !== true) {
      next();
      return;
    }

    const key = cacheKey(cache, request.method, request.url);
    const hit = cache.get(key);

    if (hit === undefined) {
      // Remembered so `onSend` stores the body under the same key it was looked up by, even
      // if something along the way rewrote the URL.
      PENDING.set(request, key);
      next();
      return;
    }

    void reply.header('etag', hit.etag).header('cache-control', cacheControl);

    if (ifNoneMatchSatisfied(request.headers['if-none-match'], hit.etag)) {
      void reply.code(304).send();
      return;
    }

    // A string bypasses the response serialiser, which is exactly what we want: these bytes
    // already went through it once, and running fast-json-stringify over a JSON string would
    // produce a quoted string rather than the object it represents.
    void reply.type('application/json; charset=utf-8').send(hit.body);
  });

  app.addHook('onSend', (request, reply, payload, next) => {
    const key = PENDING.get(request);
    if (key === undefined || reply.statusCode !== 200 || typeof payload !== 'string') {
      next(null, payload);
      return;
    }
    PENDING.delete(request);

    const entry = cache.set(key, payload);
    void reply.header('etag', entry.etag).header('cache-control', cacheControl);

    // The very first request can be a revalidation too — a client that already holds this body
    // from before a restart should not be sent it again.
    if (ifNoneMatchSatisfied(request.headers['if-none-match'], entry.etag)) {
      void reply.code(304);
      next(null, '');
      return;
    }

    next(null, payload);
  });

  done();
});
