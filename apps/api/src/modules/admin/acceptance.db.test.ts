import { like } from 'drizzle-orm';
import { type LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as t from '../../db/schema';
import { buildTestApp, type TestApp } from '../../test/app';

/**
 * What the admin is *for*, checked end to end: an editor changes something, and a visitor sees
 * it.
 *
 * These are the phase-7 acceptance criteria from PLAN.md, and they cross every layer — auth,
 * the CRUD frame, the audit trail, the response cache and the public routes. The unit tests
 * either side of them prove the pieces; only this proves the point.
 *
 * The cache is on here, unlike every other suite. With a sixty-second TTL a create that did not
 * bump the generation would leave the site showing yesterday's catalogue for a minute — the
 * single most confusing failure a CMS can have, and one that a suite with caching turned off
 * cannot see at all.
 */

let context: TestApp;

beforeAll(async () => {
  context = await buildTestApp({ cacheTtlSeconds: 60 });
}, 60_000);

afterAll(async () => {
  // The tour created below carries an English title, and the suites share one schema in
  // sequence — left behind, it is the next suite's fixture. The translation report counts
  // exactly this and read it as somebody having started translating the catalogue.
  await context.app.db.delete(t.tours).where(like(t.tours.slug, 'acceptance-%'));

  await context.close();
});

function asAdmin(
  method: 'POST' | 'PATCH',
  url: string,
  payload: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return context.app.inject({
    method,
    url: `${context.prefix}/admin${url}`,
    headers: { authorization: `Bearer ${context.admin.accessToken}` },
    payload,
  });
}

describe('an editor creates a tour', () => {
  it('and the public catalogue shows it on the next request', async () => {
    const before = await context.app.inject({ url: `${context.prefix}/global/tours?perPage=100` });
    expect(before.statusCode).toBe(200);
    expect(before.body).not.toContain('acceptance-new-tour');

    // Proves the second request really was served from the cache, so the third one below is
    // evidence of invalidation rather than of the cache never having worked.
    const cached = await context.app.inject({ url: `${context.prefix}/global/tours?perPage=100` });
    expect(cached.headers.etag).toBe(before.headers.etag);

    const created = await asAdmin('POST', '/tours', {
      slug: 'acceptance-new-tour',
      title: { ru: 'Новый тур', en: 'New tour' },
      category: 'nature',
      days: 4,
      cities: 1,
      priceFromMinor: 99_000,
      priceCurrency: 'USD',
      isPublished: true,
    });
    expect(created.statusCode, created.body).toBe(201);

    const after = await context.app.inject({ url: `${context.prefix}/global/tours?perPage=100` });
    expect(after.body).toContain('acceptance-new-tour');
    expect(after.headers.etag).not.toBe(before.headers.etag);
  });
});

describe('an editor moves the departure', () => {
  it('and every Umrah date follows it from one row', async () => {
    const trips = await context.app.inject({
      url: `${context.prefix}/admin/umrah_trips?perPage=5`,
      headers: { authorization: `Bearer ${context.admin.accessToken}` },
    });
    const current = trips.json<{
      items: { id: number; departAt: string; returnAt: string; status: string }[];
    }>();
    const trip = current.items.find((item) => item.status === 'open') ?? current.items[0];
    expect(trip).toBeDefined();

    /*
     * Moving only the departure is refused by the database, and arrives as something an editor
     * can read.
     *
     * `umrah_trips_dates_order_chk` is a phase-2 CHECK — the invariant lives where it cannot be
     * broken from a SQL console. What phase 7 adds is the translation: without it this is a 500
     * saying «something went wrong» to somebody whose actual problem is that they moved the
     * departure past the return.
     */
    const oneWay = await asAdmin('PATCH', `/umrah_trips/${String(trip!.id)}`, {
      departAt: new Date(Date.parse(trip!.returnAt) + 86_400_000).toISOString(),
    });
    expect(oneWay.statusCode).toBe(400);
    expect(oneWay.body).toContain('umrah_trips_dates_order_chk');

    // A year out, so it cannot collide with the seeded departure or with «now».
    const shift = 365 * 86_400_000;
    const moved = new Date(Date.parse(trip!.departAt) + shift).toISOString();

    const patched = await asAdmin('PATCH', `/umrah_trips/${String(trip!.id)}`, {
      departAt: moved,
      returnAt: new Date(Date.parse(trip!.returnAt) + shift).toISOString(),
    });
    expect(patched.statusCode, patched.body).toBe(200);

    const day = moved.slice(0, 10);

    for (const route of ['/umrah/trip/current', '/umrah/home', '/choice']) {
      const response = await context.app.inject({ url: `${context.prefix}${route}` });
      expect(response.statusCode, route).toBe(200);
      // One row, three pages, one reload. The prototype had this date hardcoded in three JS
      // files and written out in about eight more.
      expect(response.body, `${route} still shows the old departure`).toContain(day);
    }

    // Put it back, so the suites that follow see the seeded catalogue.
    await asAdmin('PATCH', `/umrah_trips/${String(trip!.id)}`, {
      departAt: trip!.departAt,
      returnAt: trip!.returnAt,
    });
  });
});
