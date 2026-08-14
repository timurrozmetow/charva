import { type AdminResourceMeta } from '@charva/contracts';
import { and, desc, eq } from 'drizzle-orm';
import { type LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as t from '../../../db/schema';
import { buildTestApp, problem, type TestApp } from '../../../test/app';

/**
 * The CRUD frame, against the real database.
 *
 * Written against `tours` and `umrah_trips` rather than against all twenty resources, because
 * there is one implementation: a test per entity would be twenty copies of these assertions
 * proving the same code twenty times. What is worth checking per entity — that the registry
 * names columns that exist — is checked for all of them at once by the first test here.
 */

let context: TestApp;

/** An editor scoped to Umrah, and a manager. Both are refusals waiting to happen. */
let umrahEditorToken: string;
let managerToken: string;

beforeAll(async () => {
  context = await buildTestApp();
  umrahEditorToken = context.app.signAccessToken({
    id: 9001,
    role: 'editor',
    siteScope: 'umrah',
  }).token;
  managerToken = context.app.signAccessToken({ id: 9002, role: 'manager', siteScope: null }).token;
}, 60_000);

afterAll(async () => {
  await context.close();
});

function call(
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  options: { payload?: Record<string, unknown>; token?: string } = {},
): Promise<LightMyRequestResponse> {
  const token = options.token ?? context.admin.accessToken;
  return context.app.inject({
    method,
    url: `${context.prefix}/admin${url}`,
    headers: { authorization: `Bearer ${token}` },
    ...(options.payload === undefined ? {} : { payload: options.payload }),
  });
}

async function lastAudit(action: string, entity: string) {
  const [row] = await context.app.db
    .select()
    .from(t.auditLog)
    .where(and(eq(t.auditLog.action, action), eq(t.auditLog.entity, entity)))
    .orderBy(desc(t.auditLog.id))
    .limit(1);
  return row;
}

/** A complete tour, so the create tests are about the frame and not about missing columns. */
function tourPayload(slug: string) {
  return {
    slug,
    title: { ru: 'Проверочный тур', en: 'Test tour' },
    category: 'nature',
    days: 5,
    cities: 2,
    priceFromMinor: 129_600,
    priceCurrency: 'USD',
  };
}

describe('the resource registry', () => {
  it('names only columns that exist, for every resource', async () => {
    // The one check that has to cover all twenty: a typo in the registry — a localized column
    // that is not JSON, a filter on a column that was renamed — would otherwise surface as a
    // 500 the first time somebody opened that screen.
    const response = await call('GET', '/resources');
    expect(response.statusCode, response.body).toBe(200);

    const { resources } = response.json<{ resources: AdminResourceMeta[] }>();
    expect(resources.length).toBeGreaterThan(15);

    for (const resource of resources) {
      const names = new Set(resource.fields.map((field) => field.name));
      for (const name of [...resource.search, ...resource.filters]) {
        expect(names.has(name), `${resource.name} declares ${name}, which is not a column`).toBe(
          true,
        );
      }
      expect(resource.fields.some((field) => field.name === 'id' && field.readOnly)).toBe(true);
    }
  });

  it('reads the field kinds off the tables', async () => {
    const { resources } = (await call('GET', '/resources')).json<{
      resources: AdminResourceMeta[];
    }>();

    const tours = resources.find((resource) => resource.name === 'tours');
    const kind = (name: string) => tours?.fields.find((field) => field.name === name)?.kind;

    expect(kind('title')).toBe('localized');
    expect(kind('priceFromMinor')).toBe('money');
    expect(kind('isPublished')).toBe('boolean');
    expect(kind('priceCurrency')).toBe('enum');
    expect(kind('createdAt')).toBe('timestamp');
    // The departure columns are `DATETIME`, not `TIMESTAMP`: UTC wall clock, formatted in
    // Ashgabat and nowhere else (D-73).
    const trips = resources.find((resource) => resource.name === 'umrah_trips');
    expect(trips?.fields.find((field) => field.name === 'departAt')?.kind).toBe('datetime');
  });
});

describe('the list', () => {
  it('paginates, counts and reports what it did', async () => {
    const response = await call('GET', '/tours?page=1&perPage=3');
    expect(response.statusCode).toBe(200);

    const body = response.json<{ items: unknown[]; meta: { total: number; hasMore: boolean } }>();
    expect(body.items).toHaveLength(3);
    expect(body.meta.total).toBeGreaterThan(3);
    expect(body.meta.hasMore).toBe(true);
  });

  it('searches translated columns through the site default language', async () => {
    const all = (await call('GET', '/tours?perPage=100')).json<{
      items: { slug: string; title: Record<string, string> }[];
    }>();
    const first = all.items[0];
    expect(first).toBeDefined();

    const word = (first!.title['ru'] ?? '').split(' ')[0] ?? '';
    expect(word.length).toBeGreaterThan(2);

    const found = (await call('GET', `/tours?q=${encodeURIComponent(word)}`)).json<{
      items: { slug: string }[];
    }>();

    expect(found.items.map((item) => item.slug)).toContain(first!.slug);
  });

  it('refuses a filter the resource never declared', async () => {
    // `.strict()` on the query: a typo in a filter name is a 400, not a silently ignored
    // parameter that returns the whole table and looks like it worked.
    const response = await call('GET', '/tours?nosuchfilter=1');
    expect(response.statusCode).toBe(400);
  });

  it('leaves a JSON column out of the sort, whatever is asked for', async () => {
    // Ordering by JSON orders by its serialised bytes. The request is answered by the default
    // order rather than refused: it is a hint, and the list still has to appear.
    const response = await call('GET', '/tours?sort=title&dir=desc');
    expect(response.statusCode).toBe(200);
  });
});

describe('writing', () => {
  it('creates, and logs the whole row', async () => {
    const response = await call('POST', '/tours', { payload: tourPayload('crud-created') });
    expect(response.statusCode, response.body).toBe(201);

    const created = response.json<{ id: number; slug: string; isPublished: boolean }>();
    expect(created.slug).toBe('crud-created');
    // Defaults come from the database, not from the form.
    expect(typeof created.isPublished).toBe('boolean');

    const audit = await lastAudit('create', 'tours');
    expect(audit?.entityId).toBe(String(created.id));
    expect((audit?.after as { slug: string }).slug).toBe('crud-created');
  });

  it('logs only what changed', async () => {
    const created = (await call('POST', '/tours', { payload: tourPayload('crud-diffed') })).json<{
      id: number;
    }>();

    await call('PATCH', `/tours/${String(created.id)}`, { payload: { days: 9 } });

    const audit = await lastAudit('update', 'tours');
    expect(audit?.entityId).toBe(String(created.id));
    // Not forty columns, of which one moved: a log nobody reads is a log that answers nothing.
    expect(audit?.before).toEqual({ days: 5 });
    expect(audit?.after).toEqual({ days: 9 });
  });

  it('writes nothing when a save changed nothing', async () => {
    const created = (
      await call('POST', '/tours', { payload: tourPayload('crud-unchanged') })
    ).json<{ id: number }>();

    const before = await lastAudit('update', 'tours');
    await call('PATCH', `/tours/${String(created.id)}`, { payload: { days: 5 } });
    const after = await lastAudit('update', 'tours');

    expect(after?.id).toBe(before?.id);
  });

  it('keeps the whole row in the log when it is deleted', async () => {
    const created = (await call('POST', '/tours', { payload: tourPayload('crud-deleted') })).json<{
      id: number;
    }>();

    expect((await call('DELETE', `/tours/${String(created.id)}`)).statusCode).toBe(200);
    expect((await call('GET', `/tours/${String(created.id)}`)).statusCode).toBe(404);

    const audit = await lastAudit('delete', 'tours');
    // The only surviving record that the row ever existed.
    expect((audit?.before as { slug: string }).slug).toBe('crud-deleted');
  });

  it('turns a taken slug into a 409 the editor can read', async () => {
    await call('POST', '/tours', { payload: tourPayload('crud-duplicate') });
    const second = await call('POST', '/tours', { payload: tourPayload('crud-duplicate') });

    expect(second.statusCode).toBe(409);
    expect(problem(second).error.code).toBe('conflict');
    expect(problem(second).error.details?.[0]?.path).toBe('tours_slug_uq');

    /*
     * And says nothing else.
     *
     * Drizzle's own message is the SQL with the parameters appended, so echoing it would put
     * the row being written into a response body — on `admin_users` that is a password hash.
     */
    expect(JSON.stringify(problem(second))).not.toContain('insert into');
  });

  it('replaces the amenities of a hotel with exactly the set it was sent', async () => {
    // Its own hotel, not a seeded one. Emptying the amenities of a row other suites read is how
    // this suite would break a test three files away — which is exactly what it did once.
    const created = await call('POST', '/hotels', {
      payload: {
        slug: 'crud-amenity-host',
        name: { ru: 'Отель для связки' },
        city: { ru: 'Ашхабад' },
        // Without this the database refuses the row: `hotels_stars_category_chk` says a hotel
        // has three to five stars and a camp has none. The same constraint caught a seed bug in
        // phase 2, and here it reaches the editor as a 400 naming itself.
        stars: 4,
        category: 'hotel',
        priceFromMinor: 80_000,
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const hotelId = created.json<{ id: number }>().id;

    const amenities = (await call('GET', '/amenities?perPage=2')).json<{
      items: { id: number }[];
    }>();
    const ids = amenities.items.map((item) => item.id);
    expect(ids.length).toBe(2);

    const url = `/hotels/${String(hotelId)}/amenities`;
    expect((await call('PUT', url, { payload: { amenityIds: ids } })).statusCode).toBe(200);

    // Unticking the last box has to mean something, which a POST per addition could never say.
    expect((await call('PUT', url, { payload: { amenityIds: [] } })).statusCode).toBe(200);

    const rows = await context.app.db
      .select()
      .from(t.hotelAmenities)
      .where(eq(t.hotelAmenities.hotelId, hotelId));
    expect(rows).toHaveLength(0);

    const response = await call('PUT', url, { payload: { amenityIds: [999_999] } });
    expect(response.statusCode, 'a link to an amenity that does not exist').toBe(400);

    await call('DELETE', `/hotels/${String(hotelId)}`);
  });

  it('refuses a language the site does not speak', async () => {
    // Turkish on an Umrah row. The database would refuse it too — `JSON_SCHEMA_VALID` — but as
    // a 500 nobody can act on. Here it is a 400 naming the key.
    const response = await call('POST', '/ziyarat_places', {
      payload: {
        slug: 'crud-wrong-lang',
        name: { tr: 'Yanlış' },
        city: 'mekge',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('saves a dragged order in one transaction', async () => {
    const items = (await call('GET', '/faqs?perPage=3')).json<{ items: { id: number }[] }>().items;
    expect(items.length).toBeGreaterThan(1);

    const reversed = items.map((item, index) => ({
      id: item.id,
      sortOrder: items.length - index,
    }));

    expect((await call('POST', '/faqs/reorder', { payload: { items: reversed } })).statusCode).toBe(
      200,
    );

    const after = (await call('GET', '/faqs?perPage=3')).json<{ items: { id: number }[] }>();
    expect(after.items[0]?.id).toBe(items[items.length - 1]?.id);
    expect(await lastAudit('reorder', 'faqs')).toBeDefined();
  });
});

describe('who may do it', () => {
  it('refuses a request with no session at all', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${context.prefix}/admin/tours`,
    });
    expect(response.statusCode).toBe(401);
    expect(problem(response).error.code).toBe('unauthorized');
  });

  it('lets a manager read content and not write it', async () => {
    expect((await call('GET', '/tours', { token: managerToken })).statusCode).toBe(200);

    const write = await call('POST', '/tours', {
      payload: tourPayload('crud-manager'),
      token: managerToken,
    });
    expect(write.statusCode).toBe(403);
    expect(problem(write).error.code).toBe('forbidden');
  });

  it('keeps an Umrah editor out of Global', async () => {
    const write = await call('POST', '/tours', {
      payload: tourPayload('crud-scoped'),
      token: umrahEditorToken,
    });
    expect(write.statusCode).toBe(403);
  });

  it('lets the same account write its own site', async () => {
    const response = await call('POST', '/ziyarat_places', {
      payload: { slug: 'crud-scoped-ok', name: { tm: 'Barlag' }, city: 'mekge' },
      token: umrahEditorToken,
    });
    expect(response.statusCode, response.body).toBe(201);
  });

  it('shows a scoped account only its own rows in a shared list', async () => {
    const response = await call('GET', '/content_blocks?perPage=200', { token: umrahEditorToken });
    const { items } = response.json<{ items: { site: string }[] }>();

    expect(items.length).toBeGreaterThan(0);
    // Filtered rather than refused: a list that answers 403 because it contains one row from
    // the other site would be unusable.
    expect([...new Set(items.map((item) => item.site))]).toEqual(['umrah']);
  });
});
