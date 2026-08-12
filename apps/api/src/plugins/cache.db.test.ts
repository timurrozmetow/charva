import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX } from '../app';
import { buildTestApp, type TestApp } from '../test/app';

/**
 * Sixty seconds of memory and an ETag — and the second saving is the larger one.
 *
 * The cache spares the database the nine queries the homepage makes; the ETag spares the
 * *network* the body, which is what matters for an audience on mobile data. A visitor moving
 * between pages revalidates with a header and gets 304 and nothing else.
 */

let context: TestApp;

beforeAll(async () => {
  // The only suite that runs with the cache on. Everywhere else it is off, so a fixture edit
  // takes effect immediately rather than a minute later.
  context = await buildTestApp({ cacheTtlSeconds: 60 });
}, 60_000);

afterAll(async () => {
  await context.close();
});

const TOURS = `${API_PREFIX}/global/tours`;

describe('a cached route', () => {
  it('returns exactly the same bytes the second time', async () => {
    // The entry holds the serialised body rather than the object it came from, so this is
    // identity rather than equivalence — and the response schema stays the only serialiser on
    // the path, which is what decision D-12 rests on.
    const first = await context.app.inject({ method: 'GET', url: TOURS });
    const second = await context.app.inject({ method: 'GET', url: TOURS });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.body).toBe(first.body);
  });

  it('carries a strong ETag and a cache-control header', async () => {
    const response = await context.app.inject({ method: 'GET', url: TOURS });

    expect(response.headers.etag).toMatch(/^"[\w-]{27}"$/);
    expect(response.headers['cache-control']).toBe(
      'public, max-age=60, stale-while-revalidate=300',
    );
  });

  it('answers a revalidation with 304 and no body at all', async () => {
    const first = await context.app.inject({ method: 'GET', url: TOURS });
    const etag = first.headers.etag!;

    const revalidated = await context.app.inject({
      method: 'GET',
      url: TOURS,
      headers: { 'if-none-match': etag },
    });

    expect(revalidated.statusCode).toBe(304);
    expect(revalidated.body).toBe('');
  });

  it('gives different queries different entries', async () => {
    const page1 = await context.app.inject({ method: 'GET', url: `${TOURS}?page=1&perPage=2` });
    const page2 = await context.app.inject({ method: 'GET', url: `${TOURS}?page=2&perPage=2` });

    expect(page1.headers.etag).not.toBe(page2.headers.etag);
  });

  it('treats a reordered query as the same request', async () => {
    // `?page=1&lang=ru` and `?lang=ru&page=1` are one response; without sorting they would be
    // two entries holding identical bytes.
    const a = await context.app.inject({ method: 'GET', url: `${TOURS}?page=1&lang=ru` });
    const b = await context.app.inject({ method: 'GET', url: `${TOURS}?lang=ru&page=1` });

    expect(b.headers.etag).toBe(a.headers.etag);
  });

  it('gives each language its own entry', async () => {
    /*
     * By entry, not by tag.
     *
     * The seeds carry Russian only, so an English request falls back through `pickLocale` to
     * the same words and hashes to the same ETag — which is correct, and would make a
     * tag comparison here assert nothing. What must be true is that the two are cached
     * *separately*, so the day a Turkish translation lands one language cannot serve another's
     * copy. `locale.db.test.ts` proves the content side with a real translation.
     */
    context.app.responseCache.invalidate();

    await context.app.inject({ method: 'GET', url: `${TOURS}?lang=ru` });
    expect(context.app.responseCache.size).toBe(1);

    await context.app.inject({ method: 'GET', url: `${TOURS}?lang=en` });
    expect(context.app.responseCache.size).toBe(2);
  });
});

describe('invalidation', () => {
  it('drops everything when the generation moves', async () => {
    /*
     * The counter is what the admin will bump on every write in phase 7. Nothing in phase 3
     * writes content — a lead does not change a page — so this test is the mechanism's only
     * caller for now, which is the point: it is finished and proven before the code that
     * depends on it exists.
     */
    const before = await context.app.inject({ method: 'GET', url: TOURS });
    expect(context.app.responseCache.size).toBeGreaterThan(0);

    context.app.responseCache.invalidate();
    expect(context.app.responseCache.size).toBe(0);

    const after = await context.app.inject({ method: 'GET', url: TOURS });
    // Same data, so the same bytes and the same tag — what changed is that it was recomputed.
    expect(after.body).toBe(before.body);
  });

  it('shows an edit immediately after the generation moves', async () => {
    await context.app.inject({ method: 'GET', url: TOURS });

    await context.pool.query(
      "UPDATE tours SET title = JSON_SET(title, '$.ru', 'Совершенно другое название') " +
        'ORDER BY id LIMIT 1',
    );

    const stale = await context.app.inject({ method: 'GET', url: TOURS });
    expect(stale.body).not.toContain('Совершенно другое название');

    context.app.responseCache.invalidate();

    const fresh = await context.app.inject({ method: 'GET', url: TOURS });
    expect(fresh.body).toContain('Совершенно другое название');

    await context.pool.query(
      "UPDATE tours SET title = JSON_SET(title, '$.ru', 'Классический Туркменистан') " +
        "WHERE slug = 'klassicheskiy-turkmenistan'",
    );
    context.app.responseCache.invalidate();
  });
});

describe('what stays out of it', () => {
  it('does not cache a POST', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: `${context.prefix}/global/builder/quote`,
      payload: {},
    });

    expect(response.headers.etag).toBeUndefined();
  });

  it('does not cache the health probes', async () => {
    // A cached readiness probe is a probe that keeps saying yes for a minute after it stopped
    // being true, which is exactly the minute a deploy would proceed through.
    const response = await context.app.inject({ method: 'GET', url: '/ready' });
    expect(response.headers.etag).toBeUndefined();
  });
});
