import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX } from '../app';
import * as t from '../db/schema';
import { buildTestApp, problem, type TestApp } from '../test/app';

/**
 * Which language a request is answered in, validated against the set the *specific site* offers.
 *
 * The asymmetry is the whole point and it is why `SITE_LANGS` is a per-site tuple rather than
 * one list: Global is RU / EN / TR and Umrah is TM / RU, so `?lang=tm` is meaningless on one
 * and `?lang=tr` is meaningless on the other. A shared enum could not say that.
 */

interface SettingsShape {
  langs: string[];
  defaultLang: string;
}

let context: TestApp;

beforeAll(async () => {
  context = await buildTestApp();

  // A genuine translation, so the tests below assert resolution rather than a fallback that
  // happens to look right. The seeds are Russian and Turkmen only — question Q-3.
  await context.app.db
    .update(t.tours)
    .set({ title: { ru: 'Классический Туркменистан', en: 'Classic Turkmenistan' } })
    .where(eq(t.tours.slug, 'klassicheskiy-turkmenistan'));
}, 60_000);

afterAll(async () => {
  await context.app.db
    .update(t.tours)
    .set({ title: { ru: 'Классический Туркменистан' } })
    .where(eq(t.tours.slug, 'klassicheskiy-turkmenistan'));
  await context.close();
});

async function tour(query: string): Promise<{ title: string; statusCode: number }> {
  const response = await context.app.inject({
    method: 'GET',
    url: `${API_PREFIX}/global/tours/klassicheskiy-turkmenistan${query}`,
  });
  if (response.statusCode !== 200) return { title: '', statusCode: response.statusCode };
  return { title: response.json<{ title: string }>().title, statusCode: 200 };
}

describe('resolving the language', () => {
  it('answers in the site default when the query carries none', async () => {
    expect((await tour('')).title).toBe('Классический Туркменистан');
  });

  it('answers in the language asked for', async () => {
    expect((await tour('?lang=en')).title).toBe('Classic Turkmenistan');
  });

  it('falls back rather than leaving a heading blank', async () => {
    // Partial translation is the normal state for months, not an error. A visitor seeing the
    // wrong language is a translation bug; a visitor seeing an empty heading is a broken page.
    expect((await tour('?lang=tr')).title).toBe('Classic Turkmenistan');
  });

  it('resolves server-side, so a client is never sent three copies of every sentence', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/global/tours?lang=en`,
    });
    const first = response.json<{ items: { title: unknown }[] }>().items[0];

    expect(typeof first?.title).toBe('string');
  });
});

describe('refusing a language a site does not offer', () => {
  it('turns down Turkmen on Global', async () => {
    /*
     * A 400, not a quiet fall back to Russian.
     *
     * Falling back would answer `?lang=tm` on Global with Russian and look like it had worked,
     * so whatever produced the URL — a router, a link, a sitemap generator — would keep
     * producing it. This is the case the locale plugin exists for.
     */
    const response = await tour('?lang=tm');
    expect(response.statusCode).toBe(400);
  });

  it('turns down Turkish on Umrah', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/umrah/trip/current?lang=tr`,
    });

    expect(response.statusCode).toBe(400);
    const body = problem(response);
    expect(body.error.code).toBe('validation_failed');
    expect(body.error.details?.[0]?.message).toContain('tm, ru');
  });

  it('accepts Turkmen on the chooser, which offers all four', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/choice?lang=tm`,
    });
    expect(response.statusCode).toBe(200);
  });

  it('turns down a language that does not exist at all', async () => {
    expect((await tour('?lang=de')).statusCode).toBe(400);
  });

  it('turns down an empty one, which is a router that interpolated nothing', async () => {
    expect((await tour('?lang=')).statusCode).toBe(400);
  });
});

describe('the default per site', () => {
  it('is Russian on Global and Turkmen on Umrah', async () => {
    const global = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/global/settings`,
    });
    const umrah = await context.app.inject({ method: 'GET', url: `${API_PREFIX}/umrah/settings` });

    expect(global.json<SettingsShape>().defaultLang).toBe('ru');
    expect(global.json<SettingsShape>().langs).toEqual(['ru', 'en', 'tr']);

    expect(umrah.json<SettingsShape>().defaultLang).toBe('tm');
    expect(umrah.json<SettingsShape>().langs).toEqual(['tm', 'ru']);
  });
});
