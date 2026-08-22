import { eq, sql } from 'drizzle-orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX } from '../../app';
import * as t from '../../db/schema';
import { buildTestApp, type TestApp } from '../../test/app';

/**
 * Charva Umrah, and the one row that drives all of it.
 *
 * In the prototypes `2026-09-18T06:00:00Z` is hardcoded in three JavaScript files and the
 * formatted date is typed into eight more, so postponing a departure is a fourteen-file edit
 * that somebody gets wrong. The headline test in this file is the one that moves `depart_at`
 * once and watches every date on every page follow.
 */

let context: TestApp;

beforeAll(async () => {
  context = await buildTestApp();
}, 60_000);

afterEach(async () => {
  // Suites after this one expect the seeded departure exactly as it was.
  await context.pool.query(
    "UPDATE umrah_trips SET depart_at = '2026-09-18 06:00:00', return_at = '2026-09-28 20:00:00', " +
      "signup_closes_at = '2026-09-04 06:00:00', status = 'open', is_current = 1, seats_taken = 33",
  );
});

afterAll(async () => {
  await context.close();
});

async function get<T>(path: string): Promise<T> {
  const response = await context.app.inject({ method: 'GET', url: `${API_PREFIX}${path}` });
  expect(response.statusCode, `${path} → ${response.body.slice(0, 200)}`).toBe(200);
  return response.json<T>();
}

interface TripShape {
  id: number;
  departAt: string;
  returnAt: string;
  seatsTotal: number;
  seatsTaken: number;
  seatsLeft: number;
  seatsPercent: number;
  status: string;
  signupOpen: boolean;
}

describe('the departure', () => {
  it('is one row, and moving it moves every page at once', async () => {
    /*
     * The acceptance criterion this whole design exists for. One UPDATE, one reload, and the
     * countdown, the package page, the programme and the homepage all agree — because there is
     * only one place the date lives.
     */
    const before = await get<{ trip: TripShape }>('/umrah/trip/current');

    await context.app.db
      .update(t.umrahTrips)
      .set({ departAt: '2026-11-05 04:30:00', returnAt: '2026-11-15 18:00:00' })
      .where(eq(t.umrahTrips.id, before.trip.id));

    const paths = ['/umrah/trip/current', '/umrah/home', '/umrah/package', '/umrah/program'];
    for (const path of paths) {
      const body = await get<{ trip: TripShape }>(path);
      expect(body.trip.departAt, path).toBe('2026-11-05T04:30:00.000Z');
      expect(body.trip.returnAt, path).toBe('2026-11-15T18:00:00.000Z');
    }
  });

  it('answers in UTC, so the clock does not shift with the server', async () => {
    // Stored UTC and read with `timezone: 'Z'`. A driver helpfully applying the server's own
    // zone would move every Umrah date by five hours on a machine in Frankfurt.
    const body = await get<{ trip: TripShape }>('/umrah/trip/current');
    expect(body.trip.departAt).toBe('2026-09-18T06:00:00.000Z');
  });

  it('computes the seats bar instead of drawing the literal beside it', async () => {
    // The prototype writes `width: 73%` next to a caption reading 33 / 45, which is 73.33%.
    const body = await get<{ trip: TripShape }>('/umrah/trip/current');

    expect(body.trip.seatsTaken).toBe(33);
    expect(body.trip.seatsTotal).toBe(45);
    expect(body.trip.seatsLeft).toBe(12);
    expect(body.trip.seatsPercent).toBe(73.3);
  });

  it('reports a group in the air rather than clamping the countdown to zeros', async () => {
    // One of the two states nobody drew, and it arrives the first time a group leaves —
    // question Q-4. The prototype has no such state: its countdown reaches «00 дней» and stays.
    await context.pool.query(
      'UPDATE umrah_trips SET depart_at = DATE_SUB(NOW(), INTERVAL 2 DAY), ' +
        'return_at = DATE_ADD(NOW(), INTERVAL 6 DAY)',
    );

    const body = await get<{ trip: TripShape | null }>('/umrah/trip/current');
    expect(body.trip?.status).toBe('departed');
    expect(body.trip?.signupOpen).toBe(false);
  });

  it('says there is none at all when there is none, which happens weeks after launch', async () => {
    await context.pool.query("UPDATE umrah_trips SET status = 'draft', is_current = 0");

    const body = await get<{ trip: TripShape | null; next: TripShape | null }>(
      '/umrah/trip/current',
    );
    expect(body.trip).toBeNull();
    expect(body.next).toBeNull();

    // And the composites survive it rather than failing to render.
    const home = await get<{ trip: TripShape | null; groups: unknown[] }>('/umrah/home');
    expect(home.trip).toBeNull();
    expect(Array.isArray(home.groups)).toBe(true);
  });

  it('closes the list once the closing date passes, with seats still free', async () => {
    await context.pool.query(
      'UPDATE umrah_trips SET signup_closes_at = DATE_SUB(NOW(), INTERVAL 1 DAY), ' +
        'depart_at = DATE_ADD(NOW(), INTERVAL 5 DAY), return_at = DATE_ADD(NOW(), INTERVAL 15 DAY)',
    );

    const body = await get<{ trip: TripShape }>('/umrah/trip/current');
    expect(body.trip.status).toBe('closed');
    expect(body.trip.seatsLeft).toBeGreaterThan(0);
  });
});

describe('the homepage slider', () => {
  it('carries the slide the ziyarat places could never hold', async () => {
    /*
     * «Topar» is the proof this list needed a table of its own.
     *
     * The hero used to be the first three rows of `ziyarat_places`, and the design's third slide
     * is a photograph of a group in ihram — not a place, not in that table, and therefore never
     * shown: the third *place* silently stood in for it. Nothing failed, nothing warned, and the
     * only way to see it was to hold the screen against the design.
     */
    const home = await get<{
      slides: { id: number; title: string; brief: string; media: unknown }[];
      ziyarat: { name: string }[];
    }>('/umrah/home');

    expect(home.slides.map((slide) => slide.title)).toEqual(['Mekge', 'Medine', 'Topar']);
    expect(home.ziyarat.map((place) => place.name)).not.toContain('Topar');

    for (const slide of home.slides) {
      expect(slide.brief.length, slide.title).toBeGreaterThan(0);
    }
  });
});

describe('ziyarat', () => {
  it('offers a chip for every city in the data, including Jidda', async () => {
    /*
     * Decision D-15 doing something concrete. The prototype hardcodes three chips and the data
     * has four cities, so every place in Jidda is unreachable by any filter that exists.
     */
    const body = await get<{
      items: { city: string }[];
      facets: { cities: { code: string; count: number }[] };
    }>('/umrah/ziyarat');

    const codes = body.facets.cities.map((facet) => facet.code).sort();
    expect(codes).toEqual(['bedir', 'jidda', 'medine', 'mekge']);

    for (const facet of body.facets.cities) {
      const filtered = await get<{ items: unknown[] }>(`/umrah/ziyarat?city=${facet.code}`);
      expect(filtered.items, facet.code).toHaveLength(facet.count);
    }
  });

  it('shows nearby places from the same city on a detail page', async () => {
    const list = await get<{ items: { slug: string; city: string }[] }>('/umrah/ziyarat');
    const first = list.items[0];

    const body = await get<{ place: { slug: string }; nearby: { city: string }[] }>(
      `/umrah/ziyarat/${String(first?.slug)}`,
    );

    expect(body.place.slug).toBe(first?.slug);
    for (const place of body.nearby) expect(place.city).toBe(first?.city);
  });
});

describe('groups that have travelled', () => {
  it('counts photographs and clips rather than storing the number', async () => {
    /*
     * The prototype stores `videos: 4` beside three clips and `photos: 38` beside eight
     * captions. A `COUNT(*)` cannot drift, because there is nothing for it to drift from.
     */
    const body = await get<{
      items: { slug: string; photoCount: number; videoCount: number }[];
    }>('/umrah/groups');

    for (const group of body.items) {
      const [rows] = await context.pool.query(
        'SELECT kind, COUNT(*) AS n FROM umrah_group_media m ' +
          'JOIN umrah_groups g ON g.id = m.group_id WHERE g.slug = ? GROUP BY kind',
        [group.slug],
      );
      const counts = new Map(
        (rows as { kind: string; n: number }[]).map((row) => [row.kind, row.n]),
      );

      expect(group.photoCount, group.slug).toBe(counts.get('photo') ?? 0);
      expect(group.videoCount, group.slug).toBe(counts.get('video') ?? 0);
    }
  });

  it('returns every photograph on a detail page, not the first eight', async () => {
    // The prototype builds its lightbox from a hardcoded array of eight captions and cannot
    // open the rest, whatever its own counter claims.
    const list = await get<{ items: { slug: string; photoCount: number }[] }>('/umrah/groups');
    const group = list.items[0];

    const detail = await get<{ photos: unknown[]; videos: unknown[] }>(
      `/umrah/groups/${String(group?.slug)}`,
    );
    expect(detail.photos).toHaveLength(group?.photoCount ?? -1);
  });

  it('totals the archive from the rows', async () => {
    const body = await get<{ stats: { groups: number; pilgrims: number } }>('/umrah/groups');
    const [rows] = await context.pool.query(
      // `groups` is a reserved word in MySQL 8, so the alias is not it.
      'SELECT COUNT(*) AS group_count, COALESCE(SUM(pilgrims_count), 0) AS pilgrims ' +
        'FROM umrah_groups WHERE is_published = 1',
    );
    const actual = (rows as { group_count: number; pilgrims: number }[])[0];

    expect(body.stats.groups).toBe(Number(actual?.group_count));
    expect(body.stats.pilgrims).toBe(Number(actual?.pilgrims));
  });
});

describe('the package', () => {
  it('brings the four lists that used to want four tables', async () => {
    // Decision D-17: one `content_blocks` table, one CRUD screen, four `block_code` values.
    const body = await get<{
      items: unknown[];
      conditions: unknown[];
      included: unknown[];
      signupOrder: unknown[];
    }>('/umrah/package');

    expect(body.items.length).toBeGreaterThan(0);
    expect(body.conditions.length).toBeGreaterThan(0);
    expect(body.included.length).toBeGreaterThan(0);
    expect(body.signupOrder.length).toBeGreaterThan(0);
  });

  it('has no second or third tier anywhere in it', async () => {
    /*
     * Decision D-9. The prototype ships a filled `packagesUnused` array carrying `8 575 TMT`,
     * on a site whose own README says there is one package and no prices. «Оставим на всякий
     * случай» is exactly how a price ends up on a page.
     */
    const raw = JSON.stringify(await get<unknown>('/umrah/package'));

    expect(raw).not.toMatch(/8\s*575/);
    expect(raw.toLowerCase()).not.toContain('vip');
  });
});

describe('the programme', () => {
  it('has ten days and the daily routine', async () => {
    const body = await get<{ days: { dayNumber: number }[]; routine: unknown[] }>('/umrah/program');

    expect(body.days).toHaveLength(10);
    expect(body.days.map((day) => day.dayNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(body.routine.length).toBeGreaterThan(0);
  });
});

describe('the Turkmen content', () => {
  it('answers in Turkmen by default, without being asked', async () => {
    const body = await get<{ days: { title: string }[] }>('/umrah/program');
    const titles = body.days.map((day) => day.title).join(' ');

    // The Umrah pages are written for a Turkmen-reading audience and `tm` is the site default,
    // so an unasked request must not come back in Russian.
    expect(titles.length).toBeGreaterThan(0);
    expect(titles).not.toMatch(/^[А-Яа-яЁё\s]+$/);
  });

  it('falls back to Russian for a field with no Turkmen, rather than leaving it blank', async () => {
    await context.app.db
      .update(t.umrahTrips)
      .set({ hotelMekka: { ru: 'Отель в Мекке' } })
      .where(sql`1 = 1`);

    const body = await get<{ trip: { hotelMekka: string } }>('/umrah/trip/current');
    expect(body.trip.hotelMekka).toBe('Отель в Мекке');
  });
});
