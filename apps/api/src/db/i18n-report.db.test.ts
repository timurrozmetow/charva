import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../test/app';

import { collectCoverage, READY_PERCENT, readyLanguages } from './i18n-report';

/**
 * The translation report, against the seeded catalogue.
 *
 * Risk R-4 says the translations may not arrive and the mitigation is to publish only the
 * languages a site is actually ready in. That decision needs a number, and a number nobody
 * checks is a number that quietly measures the wrong thing — which is what happened on the
 * first run of this report, and is why the denominator has a test of its own below.
 */

let context: TestApp;

beforeAll(async () => {
  context = await buildTestApp();
}, 60_000);

afterAll(async () => {
  await context.close();
});

describe('coverage', () => {
  it('finds the site complete in its own language', async () => {
    const global = await collectCoverage(context.app.db, 'global');
    const umrah = await collectCoverage(context.app.db, 'umrah');

    // The seeds are Russian on Global and Turkmen on Umrah, which is the whole content today.
    expect(global.percent.ru).toBe(100);
    expect(umrah.percent.tm).toBe(100);
  });

  it('reports every language of the catalogue as written', async () => {
    const global = await collectCoverage(context.app.db, 'global');

    /*
     * The inverse of the assertion that stood here, and inverted rather than deleted.
     *
     * It read `toBeLessThan(20)` and was the honest measurement of question Q-3 for two phases:
     * the prototypes are Russian, the room types arrived translated by migration, the owner's own
     * tour carries three languages, and everything else was Russian only. The owner asked for the
     * rest on 2026-08-23, and `seed/translations.ts` is that answer.
     *
     * Kept as a bound rather than replaced by an equality: `translations.db.test.ts` owns the
     * «exactly 100%» claim against a freshly seeded schema, and this file measures whatever the
     * schema holds — which by the time it runs may include a tour some other suite typed in.
     */
    expect(global.percent.en).toBeGreaterThanOrEqual(READY_PERCENT);
    expect(global.percent.tr).toBeGreaterThanOrEqual(READY_PERCENT);

    const catalogue = global.fields.find((field) => field.table === 'tours');
    expect(catalogue).toBeDefined();
    for (const lang of ['en', 'tr'] as const) {
      expect(catalogue!.filled[lang], lang).toBeGreaterThan(0);
    }
  });

  it('does not count an empty optional column as an untranslated one', async () => {
    /*
     * The correction this report needed.
     *
     * Counting against every row measured how many optional columns happen to be empty: the
     * first run called Global 90% Russian, and the missing tenth was `tag` and `note` on rows
     * that do not have one. Nothing there is waiting for a translator.
     */
    const global = await collectCoverage(context.app.db, 'global');
    const optional = global.fields.find((field) => field.values < field.rows);

    expect(
      optional,
      'no field has an empty optional value; the check proves nothing',
    ).toBeDefined();
    expect(optional!.filled.ru).toBe(optional!.values);
  });

  it('never counts more values than there are rows', async () => {
    for (const site of ['global', 'umrah'] as const) {
      const coverage = await collectCoverage(context.app.db, site);
      expect(coverage.fields.length).toBeGreaterThan(5);

      for (const field of coverage.fields) {
        expect(field.values, `${field.table}.${field.field}`).toBeLessThanOrEqual(field.rows);
      }
    }
  });

  it('reads translated columns off the admin registry, so it covers both sites', async () => {
    const umrah = await collectCoverage(context.app.db, 'umrah');
    const tables = new Set(umrah.fields.map((field) => field.table));

    expect(tables).toContain('ziyarat_places');
    expect(tables).toContain('umrah_program_days');
    // Shared table, filtered by its own `site` column rather than reported for both sites.
    expect(tables).toContain('content_blocks');
    expect(tables).not.toContain('tours');
  });
});

describe('what may be published', () => {
  it('offers every language the content is actually in', async () => {
    // Was `['ru']`, and that was the truth until the dictionary was written. All three now, and
    // Umrah's two — which is what «offerable today» is for: it answers from the database rather
    // than from what somebody intended.
    const global = await collectCoverage(context.app.db, 'global');
    expect(readyLanguages(global)).toEqual(['ru', 'en', 'tr']);

    const umrah = await collectCoverage(context.app.db, 'umrah');
    expect(readyLanguages(umrah)).toEqual(['tm', 'ru']);
  });

  it('holds the threshold at nine values in ten', () => {
    const almost = {
      site: 'global' as const,
      fields: [],
      percent: { ru: 100, en: READY_PERCENT - 0.1, tr: READY_PERCENT },
    };

    // A language at 89.9% is one where a visitor meets an untranslated page roughly every
    // tenth click, which is worse than not offering it: it reads as a broken site rather than
    // an unfinished one.
    expect(readyLanguages(almost)).toEqual(['ru', 'tr']);
  });
});
