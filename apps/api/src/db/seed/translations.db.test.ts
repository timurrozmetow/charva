import { describe, expect, it } from 'vitest';

import { buildTestApp, type TestApp } from '../../test/app';
import { collectCoverage, READY_PERCENT } from '../i18n-report';

import { seedAll, SEEDED_TABLES } from './seed';
import { ru3, tm2 } from './translations';

/**
 * Every language of both sites is complete, and stays that way.
 *
 * The report has printed this number since phase 8 and nobody had to act on it, because acting
 * on it meant translating three hundred strings. Now that they are translated, the number is
 * worth defending: a string added to the prototypes without an entry in the dictionary drops
 * the percentage, and the only place that shows is a report nobody runs on a Tuesday.
 *
 * The threshold here is 100, not R-4's 90. Ninety is «this language may be published»; a hundred
 * is «nothing was added and forgotten», which is a different question and the one a test can
 * answer. If a genuinely untranslatable string ever appears, this fails and somebody decides —
 * which is the point.
 */

let context: TestApp;

describe('content translations', () => {
  it('cover every value on both sites', async () => {
    context = await buildTestApp();
    try {
      /*
       * Re-seeded first, and that is not tidiness.
       *
       * The suites share one schema and run in file order (`fileParallelism: false`), and some
       * of them create content through the admin API — a tour typed by a test has no translation
       * and never will. Measuring whatever happens to be in the schema made this assertion
       * depend on which files ran before it: 100% alone, 99.7% in the suite. So it measures the
       * seeds, which are the thing the dictionary is about, and leaves the schema seeded, which
       * is the state every other suite expects to find.
       */
      for (const table of SEEDED_TABLES) {
        await context.pool.query(`DELETE FROM \`${table}\``);
      }
      await seedAll(context.app.db);

      for (const site of ['global', 'umrah'] as const) {
        const coverage = await collectCoverage(context.app.db, site);
        for (const [lang, percent] of Object.entries(coverage.percent)) {
          expect(percent, `${site} / ${lang}`).toBe(100);
          expect(percent).toBeGreaterThanOrEqual(READY_PERCENT);
        }
      }
    } finally {
      await context.close();
    }
  }, 60_000);

  it('returns the source untouched when there is no entry, rather than throwing', () => {
    // A seed that stops on a missing translation is a seed nobody can run while the dictionary
    // is being filled in. The gap is reported; it is not an exception.
    expect(ru3('строка, которой нет в словаре')).toEqual({ ru: 'строка, которой нет в словаре' });
    expect(tm2('sözlükde ýok setir')).toEqual({ tm: 'sözlükde ýok setir' });
  });

  it('gives one spelling to a name that appears in several tables', () => {
    // «Ашхабад» is a builder destination, a hotel city, a place, a hero slide and the home town
    // of a reviewer. Keying the dictionary on the string is what makes those one decision.
    expect(ru3('Ашхабад').en).toBe('Ashgabat');
    expect(ru3('Ашхабад').tr).toBe('Aşkabat');
  });
});
