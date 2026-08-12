import { describe, expect, it } from 'vitest';

import { etagOf, ifNoneMatchSatisfied, ResponseCache } from './response-cache';

describe('the response cache', () => {
  it('returns what it was given, byte for byte', () => {
    const cache = new ResponseCache(60_000);
    const key = cache.key(['GET', '/global/tours', 'page=1']);

    cache.set(key, '{"items":[]}');
    expect(cache.get(key)?.body).toBe('{"items":[]}');
  });

  it('forgets an entry once its time is up', () => {
    const cache = new ResponseCache(60_000);
    const key = cache.key(['GET', '/global/home', '']);

    cache.set(key, '{}', 1_000);
    expect(cache.get(key, 60_000)).toBeDefined();
    expect(cache.get(key, 61_001)).toBeUndefined();
  });

  it('makes everything unreachable when the generation moves', () => {
    /*
     * Invalidation by counter rather than by working out which entries an edit touched.
     * Getting that wrong shows up as an editor's change not appearing on the site, which is the
     * most confusing failure a CMS has; a counter cannot be wrong about it.
     */
    const cache = new ResponseCache(60_000);
    const before = cache.key(['GET', '/global/tours', '']);
    cache.set(before, '{"old":true}');

    cache.invalidate();

    const after = cache.key(['GET', '/global/tours', '']);
    expect(after).not.toBe(before);
    expect(cache.get(after)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('will not grow without bound when a crawler walks the pages', () => {
    const cache = new ResponseCache(60_000, 10);
    for (let page = 0; page < 50; page += 1) {
      cache.set(cache.key(['GET', '/global/gallery', `page=${String(page)}`]), '{}');
    }
    expect(cache.size).toBeLessThanOrEqual(10);
  });
});

describe('etags', () => {
  it('are the same for the same bytes and different for different ones', () => {
    expect(etagOf('{"a":1}')).toBe(etagOf('{"a":1}'));
    expect(etagOf('{"a":1}')).not.toBe(etagOf('{"a":2}'));
  });

  it('are strong, because they are a hash rather than a guess', () => {
    expect(etagOf('{}')).toMatch(/^"[\w-]{27}"$/);
  });

  it('match a list, a weak form and a star, all of which real caches send', () => {
    const etag = etagOf('{}');
    expect(ifNoneMatchSatisfied(etag, etag)).toBe(true);
    expect(ifNoneMatchSatisfied(`"other", ${etag}`, etag)).toBe(true);
    expect(ifNoneMatchSatisfied(`W/${etag}`, etag)).toBe(true);
    expect(ifNoneMatchSatisfied('*', etag)).toBe(true);
    expect(ifNoneMatchSatisfied('"something-else"', etag)).toBe(false);
    expect(ifNoneMatchSatisfied(undefined, etag)).toBe(false);
  });
});
