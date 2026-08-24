import { type Lang, type Site, SITE_LANGS } from '@charva/contracts';
import { getTableName, sql } from 'drizzle-orm';
import mysql from 'mysql2/promise';

import { loadEnv } from '../env';
import { ADMIN_RESOURCES } from '../modules/admin/crud/resources';

import { createDb, type Database } from './client';

/**
 * How much of the content is actually translated.
 *
 * Risk R-4 in PLAN.md: the translations may simply not arrive. The mitigation written down
 * there is to ship with a language switcher that offers only the languages a site is ready in,
 * and «ready» has to be a number somebody can read rather than an impression.
 *
 * Interface strings are not counted, and cannot be missing: they are typed JSON in the
 * repository (D-23, D-53) and a missing key is a build error. This counts *content* — the rows
 * an editor writes — where a missing translation is a fact about the world rather than a bug.
 *
 * Which columns hold translated text is read from the admin resource registry, so a new
 * localised column joins this report by existing rather than by being added to a list here.
 */

export interface FieldCoverage {
  table: string;
  field: string;
  /** Rows in the table at all. Reported for context, never used as a denominator. */
  rows: number;
  /**
   * Rows where this column has text **in the site's own language**.
   *
   * The denominator, and the correction that made this report worth reading. Counting against
   * every row measured how many optional columns happen to be empty: the first run said Global
   * was 90% Russian, and the missing tenth was `tag` and `note` on rows that simply do not have
   * one. Nothing there is waiting for a translator. What is waiting for a translator is a value
   * that exists in the original and not in the other language, which is exactly this.
   */
  values: number;
  /** Rows whose value for this language is a non-empty string. */
  filled: Partial<Record<Lang, number>>;
}

export interface SiteCoverage {
  site: Site;
  fields: FieldCoverage[];
  /** Percentage per language across every translated value on the site. */
  percent: Partial<Record<Lang, number>>;
}

/** A site is offerable in a language when nine values in ten exist — R-4's threshold. */
export const READY_PERCENT = 90;

export async function collectCoverage(db: Database, site: Site): Promise<SiteCoverage> {
  const langs = SITE_LANGS[site] as readonly Lang[];
  const fields: FieldCoverage[] = [];

  for (const resource of ADMIN_RESOURCES) {
    // Shared tables carry their own `site` column; scoped ones belong to one site by
    // definition. Anything not this site's is somebody else's problem.
    if (resource.site !== null && resource.site !== site) continue;

    const localised = resource.fields.filter((field) => field.kind === 'localized');
    if (localised.length === 0) continue;

    const table = getTableName(resource.table);
    const scoped = resource.site === null && resource.fields.some((field) => field.name === 'site');

    for (const field of localised) {
      const column = sql.raw(`\`${toSnake(field.name)}\``);
      const where = scoped ? sql` WHERE site = ${site}` : sql``;

      const counts = langs.map(
        (lang) =>
          sql`SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(${column}, ${`$."${lang}"`})) > '' THEN 1 ELSE 0 END) AS ${sql.raw(lang)}`,
      );

      const rows = await db.execute(
        sql`SELECT COUNT(*) AS total, ${sql.join(counts, sql`, `)} FROM ${sql.raw(`\`${table}\``)}${where}`,
      );

      const row = (rows as unknown as Record<string, unknown>[][])[0]?.[0];
      if (row === undefined) continue;

      const filled: Partial<Record<Lang, number>> = {};
      for (const lang of langs) filled[lang] = Number(row[lang] ?? 0);

      fields.push({
        table,
        field: field.name,
        rows: Number(row['total'] ?? 0),
        // `SUM()` comes back from mysql2 as a string; `Number` here rather than a `+` further
        // down, where a string would concatenate and the total would be nonsense.
        values: Number(row[langs[0] ?? 'ru'] ?? 0),
        filled,
      });
    }
  }

  const percent: Partial<Record<Lang, number>> = {};
  const total = fields.reduce((sum, field) => sum + field.values, 0);

  for (const lang of langs) {
    const done = fields.reduce((sum, field) => sum + (field.filled[lang] ?? 0), 0);
    percent[lang] = total === 0 ? 0 : Math.round((done / total) * 1000) / 10;
  }

  return { site, fields, percent };
}

/** Which languages a site could honestly be published in today. */
export function readyLanguages(coverage: SiteCoverage): Lang[] {
  return (SITE_LANGS[coverage.site] as readonly Lang[]).filter(
    (lang) => (coverage.percent[lang] ?? 0) >= READY_PERCENT,
  );
}

/**
 * `sortOrder` in TypeScript is `sort_order` in SQL.
 *
 * The mapping is done once by Drizzle's `casing` setting, which is not exposed as a function —
 * so the same rule is applied here, and the report would fail loudly on a column it named
 * wrongly rather than reporting zeroes.
 */
function toSnake(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function bar(value: number): string {
  const filled = Math.round(value / 5);
  return `${'#'.repeat(filled)}${'.'.repeat(20 - filled)}`;
}

if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const env = loadEnv();
  const pool = mysql.createPool({ uri: env.DATABASE_URL, timezone: 'Z', connectionLimit: 2 });
  const db = createDb(pool);

  try {
    for (const site of ['global', 'umrah'] as const) {
      const coverage = await collectCoverage(db, site);
      const ready = readyLanguages(coverage);

      process.stdout.write(`\n${site.toUpperCase()}\n`);

      for (const [lang, value] of Object.entries(coverage.percent)) {
        const mark = value >= READY_PERCENT ? 'ready' : 'not ready';
        process.stdout.write(`  ${lang}  ${bar(value)} ${String(value).padStart(5)}%  ${mark}\n`);
      }

      process.stdout.write(`  offerable today: ${ready.join(', ') || 'none'}\n`);

      // The gaps, worst first — so the answer to «what should a translator do next» is a list
      // rather than a percentage.
      const langs = SITE_LANGS[site] as readonly Lang[];
      const gaps = coverage.fields
        .flatMap((field) =>
          langs.map((lang) => ({
            where: `${field.table}.${field.field}`,
            lang,
            // Against what exists in the original, so an empty optional column is not a task.
            missing: field.values - (field.filled[lang] ?? 0),
          })),
        )
        .filter((gap) => gap.missing > 0)
        .sort((a, b) => b.missing - a.missing)
        // Twelve is enough to answer «what next», and the wrong number when the question is
        // «what is left in total» — which is what somebody sitting down to finish the job asks.
        // `--all` prints every gap.
        .slice(0, process.argv.includes('--all') ? Number.MAX_SAFE_INTEGER : 12);

      if (gaps.length > 0) {
        process.stdout.write('  missing:\n');
        for (const gap of gaps) {
          process.stdout.write(
            `    ${String(gap.missing).padStart(4)} × ${gap.lang}  ${gap.where}\n`,
          );
        }
      }
    }
  } finally {
    await pool.end();
  }
}
