import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../test/app';

/**
 * The properties that must hold for *every* route, checked against the route table Fastify
 * actually built rather than against a list somebody maintains.
 *
 * That distinction is the whole design. A route added in phase 5 or phase 7 joins these checks
 * by existing; it cannot be forgotten into an exemption, and a route missing from a hand-kept
 * inventory would be precisely the route that leaks.
 *
 *   1. Every route declares a response schema — the type provider installs it as the
 *      serialiser, which is what the second check depends on.
 *   2. Nothing under `/umrah` contains anything money-shaped. Decision D-12.
 *   3. `/docs` describes all of it, with a request and a response schema each.
 */

let context: TestApp;
let adminIds: Map<string, number>;

beforeAll(async () => {
  context = await buildTestApp();
  adminIds = await discoverAdminIds(context);
}, 60_000);

afterAll(async () => {
  await context.close();
});

/**
 * The three families of route that answer with bytes rather than JSON.
 *
 * The response-schema rule exists so that a JSON body is produced by a declared shape; there is
 * no JSON here to constrain. `/img/*` returns WebP, `/uploads/*` returns stored files, and
 * `/docs` is Swagger UI's own bundle. They are matched by an explicit predicate rather than a
 * wildcard, so a fourth exemption has to be argued for in a diff instead of appearing quietly.
 */
function servesBytes(url: string): boolean {
  return url === '/docs' || url.startsWith('/docs/') || /\/(img|uploads)\/\*$/.test(url);
}

/**
 * Slugs from the seeds, so a detail route is exercised against a row that exists.
 *
 * Written down rather than read back from the list endpoints: if a route stops returning a
 * known slug, this should fail loudly instead of quietly testing nothing.
 */
const SLUGS: Record<string, string> = {
  '/api/v1/global/tours/:slug': 'klassicheskiy-turkmenistan',
  '/api/v1/global/hotels/:slug': 'garagum-camp',
};

/**
 * The session, for the half of the API that has one.
 *
 * Sent as an owner, so that a 403 from a missing capability cannot be mistaken for a route that
 * answers. Public routes get no header at all — passing one everywhere would hide a route that
 * had quietly become authenticated.
 */
function authFor(url: string): Record<string, string> {
  return url.includes('/admin') ? { authorization: `Bearer ${context.admin.accessToken}` } : {};
}

/**
 * A real id for every `/admin/<resource>/:id`, read out of the table the resource names.
 *
 * Discovered rather than listed, for the same reason the route inventory is: twenty resources
 * would be twenty fixtures to keep in step, and the one that fell out of step would be the one
 * that stopped being tested.
 */
async function discoverAdminIds(app: TestApp): Promise<Map<string, number>> {
  const found = new Map<string, number>();

  for (const route of app.app.registeredRoutes) {
    const match = /^\/api\/v1\/admin\/(\w+)\/:id$/.exec(route.url);
    if (match?.[1] === undefined) continue;

    const [rows] = await app.pool.query('SELECT id FROM ?? ORDER BY id LIMIT 1', [match[1]]);
    const id = (rows as { id: number }[])[0]?.id;
    if (id === undefined) emptyTables.add(match[1]);
    else found.set(route.url, id);
  }

  return found;
}

/**
 * Tables the seeds leave empty, and why that is not an oversight.
 *
 * `tour_media` and `umrah_group_media` reference `media`, and there is not one photograph in
 * the handoff (decision D-45, question Q-1) — a seeded row there would have to point at a file
 * nobody has. `tour_days` is the programme of a tour, and the prototype has no tour detail page
 * to extract one from.
 *
 * The assertion below is a subset check rather than an equality, so seeding any of them later
 * fixes the gap without failing a test, while a *new* empty table has to be explained here.
 */
const EMPTY_BY_DESIGN = new Set(['tour_days', 'tour_media', 'umrah_group_media']);
const emptyTables = new Set<string>();

/** Null when the table behind a detail route is empty — see `EMPTY_BY_DESIGN`. */
function concreteUrl(pattern: string, app: TestApp): string | null {
  if (!pattern.includes(':')) return pattern;

  if (pattern.includes(':id')) {
    const id = adminIds.get(pattern);
    return id === undefined ? null : pattern.replace(':id', String(id));
  }

  const known = SLUGS[pattern];
  if (known !== undefined) return pattern.replace(':slug', known);

  const discovered = app.discoveredSlugs.get(pattern);
  if (discovered === undefined) {
    throw new Error(`No fixture slug for ${pattern}. Add one to SLUGS or discover it.`);
  }
  return pattern.replace(':slug', discovered);
}

describe('every route', () => {
  it('declares a response schema', () => {
    const missing = context.app.registeredRoutes
      .filter((route) => !servesBytes(route.url) && route.responseSchemas === undefined)
      .map((route) => `${route.method} ${route.url}`);

    expect(missing, 'routes with no response schema').toEqual([]);
  });

  it('was registered under the version prefix, apart from the operational ones', () => {
    const stray = context.app.registeredRoutes
      .filter(
        (route) =>
          !route.url.startsWith(context.prefix) &&
          !['/health', '/ready'].includes(route.url) &&
          !route.url.startsWith('/docs'),
      )
      .map((route) => route.url);

    expect(stray, 'routes served from outside /api/v1').toEqual([]);
  });

  it('answers, and answers with the shape it declared', async () => {
    /*
     * A handler returning something its schema does not describe produces a serialisation
     * error, which the error handler turns into a 500 with `code: 'internal'`. So a 200 here is
     * proof that the declared shape and the real one agree — for every route at once.
     */
    for (const route of context.app.registeredRoutes) {
      if (route.method !== 'GET') continue;
      if (servesBytes(route.url)) continue;

      const url = concreteUrl(route.url, context);
      if (url === null) continue;

      const response = await context.app.inject({ method: 'GET', url, headers: authFor(url) });

      expect(response.statusCode, `GET ${url} → ${response.body.slice(0, 300)}`).toBe(200);
    }
  });

  it('leaves only the tables that have nothing to seed untested', () => {
    // Skipping a detail route because its table is empty is a hole in the walk, and a hole
    // nobody wrote down is a route that quietly stops being covered.
    for (const table of emptyTables) {
      expect(EMPTY_BY_DESIGN.has(table), `${table} is empty and nothing explains why`).toBe(true);
    }
  });
});

describe('the Umrah price ban', () => {
  it('proves the row it is hiding really does carry a price', async () => {
    // Without this, the walk below would pass just as happily on a database with nothing to leak.
    const [rows] = await context.pool.query('SELECT price_minor FROM umrah_trips LIMIT 1');
    const price = (rows as { price_minor: number }[])[0]?.price_minor;

    expect(price, 'the seeded departure should carry the 8 575 TMT the prototype prints').toBe(
      857_500,
    );
  });

  it('finds nothing money-shaped anywhere under /umrah', async () => {
    const routes = context.app.registeredRoutes.filter(
      (route) =>
        route.method === 'GET' &&
        route.url.includes('/umrah') &&
        // The admin is the one place the pilgrimage's price may be read, because it is the one
        // place it can be written. The ban is on the public wire, and the wire is what the
        // response schemas out there describe — see the test below, which proves it is there.
        !route.url.startsWith(`${context.prefix}/admin`),
    );

    expect(routes.length, 'no Umrah routes were found to check').toBeGreaterThan(5);

    for (const route of routes) {
      const url = concreteUrl(route.url, context);
      // Public Umrah routes all have rows behind them; `null` here would be a new gap.
      expect(url, `${route.url} has nothing to exercise it against`).not.toBeNull();

      const response = await context.app.inject({ method: 'GET', url: url! });
      expect(response.statusCode, url!).toBe(200);

      const offenders = findMoney(response.json<unknown>());
      expect(offenders, `${url!} leaked: ${offenders.join(', ')}`).toEqual([]);
    }
  });

  it('finds nothing on the chooser either, which shows the same departure', async () => {
    const response = await context.app.inject({ method: 'GET', url: `${context.prefix}/choice` });

    expect(response.statusCode).toBe(200);
    expect(findMoney(response.json<unknown>())).toEqual([]);
  });

  it('does hand the price to an editor, who has to be able to change it', async () => {
    // The counterpart of the walk above. A price that exists in the column and reaches nobody
    // at all is not a ban, it is a lost feature — and phase 7 is where somebody edits it.
    const response = await context.app.inject({
      method: 'GET',
      url: `${context.prefix}/admin/umrah_trips`,
      headers: { authorization: `Bearer ${context.admin.accessToken}` },
    });

    expect(response.statusCode).toBe(200);
    expect(findMoney(response.json<unknown>()).length).toBeGreaterThan(0);
  });

  it('still returns money on Global, where prices are the point', async () => {
    // The check above is only meaningful if the detector would have fired. This is that proof.
    const response = await context.app.inject({
      method: 'GET',
      url: `${context.prefix}/global/tours`,
    });

    expect(findMoney(response.json<unknown>()).length).toBeGreaterThan(0);
  });
});

describe('the generated documentation', () => {
  it('describes every route, with a response for each', () => {
    const document = context.app.swagger() as {
      paths: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
    };

    const documented = Object.entries(document.paths).flatMap(([path, operations]) =>
      Object.keys(operations).map((method) => `${method.toUpperCase()} ${path}`),
    );

    // Every registered route, in the shape swagger writes it: prefix stripped by `servers`,
    // `:slug` written `{slug}`.
    for (const route of context.app.registeredRoutes) {
      if (servesBytes(route.url)) continue;
      const documentedUrl = route.url
        .replace(context.prefix, '')
        .replace(/:(\w+)/g, '{$1}')
        .replace('/*', '/{*}');

      expect(documented, `${route.method} ${route.url} is missing from /docs`).toContain(
        `${route.method} ${documentedUrl === '' ? '/' : documentedUrl}`,
      );
    }
  });

  it('serves the interactive page', async () => {
    const response = await context.app.inject({ method: 'GET', url: '/docs' });
    expect([200, 302]).toContain(response.statusCode);
  });
});

/**
 * Anything money-shaped, by key or by value.
 *
 * By key catches `priceMinor` and `price_currency`. By value catches a total somebody helpfully
 * formatted into a string on the way out — `8 575 TMT` — which a key check alone would miss.
 */
const MONEY_KEY = /price|cost|amount|minor|currency|\btmt\b|manat|baha|\bfee\b/i;
const MONEY_VALUE = /\d[\d\s\u00A0\u202F]*\s*(TMT|manat|\$|USD|манат)/i;

function findMoney(value: unknown, path = '$'): string[] {
  if (typeof value === 'string') {
    return MONEY_VALUE.test(value) ? [`${path} = ${JSON.stringify(value)}`] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findMoney(item, `${path}[${String(index)}]`));
  }
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) =>
      MONEY_KEY.test(key) ? [`${path}.${key}`] : findMoney(child, `${path}.${key}`),
    );
  }
  return [];
}
