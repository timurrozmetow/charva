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

  it('reports the languages nobody has written yet as all but empty', async () => {
    const global = await collectCoverage(context.app.db, 'global');

    /*
     * Question Q-3, and the number is a fact rather than an approximation.
     *
     * Neither is zero any more, for two unrelated reasons. The nine room types — «Люкс»,
     * «Suite», «Suit» — ship translated from the migration that creates them, because nine words
     * of hotel vocabulary is not the translation work Q-3 is about. And the first real tour
     * arrived from the owner as an English tour sheet, so it is the one row in the catalogue
     * that is bilingual by origin rather than by translation.
     *
     * Everything else an operator has written is still Russian only, which is what a percentage
     * this far below the publication threshold says.
     */
    expect(global.percent.en).toBeLessThan(20);
    expect(global.percent.tr).toBeLessThan(5);

    const catalogue = global.fields.find((field) => field.table === 'tours');
    expect(catalogue).toBeDefined();
    // Bounded on both sides on purpose: at zero the real tour has lost its English, and at
    // `values` somebody has bulk-filled the column and the report has stopped measuring Q-3.
    expect(catalogue!.filled.en).toBeGreaterThan(0);
    expect(catalogue!.filled.en).toBeLessThan(catalogue!.values);
    expect(catalogue!.filled.tr).toBe(0);
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
  it('offers only the language the content is actually in', async () => {
    const global = await collectCoverage(context.app.db, 'global');
    expect(readyLanguages(global)).toEqual(['ru']);
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
