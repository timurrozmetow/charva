import { sql } from 'drizzle-orm';

import { loadEnv } from '../env';

import { createDb, createPool } from './client';
import { ru3, tm2 } from './seed/translations';

/**
 * Fills the missing languages on a database that is already seeded.
 *
 * `db:seed` refuses a non-empty database and is right to (D-43), and content that has to survive
 * a rebuild belongs in the seeds rather than in a migration (D-123) — so the seeds carry the
 * translations, and this exists for the one database the seeds can no longer reach: the live one,
 * which was filled before the dictionary was written.
 *
 * **It only fills gaps.** A value that already exists in a language is left exactly as it is, in
 * every case, without comparison. Anything else would let a run of this script overwrite what an
 * editor typed in the panel — the one kind of content nobody can get back — and «it only differs
 * from the dictionary» is not a reason to believe the dictionary.
 *
 * Run once per deploy that adds translations:
 *
 *     node dist/backfill-translations.js          on the server
 *     pnpm --filter @charva/api db:translations   from the repository
 */

/** Every localized column, and which language the seeds wrote it in. */
const COLUMNS: { table: string; column: string; from: 'ru' | 'tm'; site?: string }[] = [
  { table: 'tours', column: 'title', from: 'ru' },
  { table: 'tours', column: 'summary', from: 'ru' },
  { table: 'tours', column: 'tag', from: 'ru' },
  { table: 'hotels', column: 'name', from: 'ru' },
  { table: 'hotels', column: 'summary', from: 'ru' },
  { table: 'hotels', column: 'city', from: 'ru' },
  { table: 'amenities', column: 'name', from: 'ru' },
  { table: 'articles', column: 'title', from: 'ru' },
  { table: 'articles', column: 'summary', from: 'ru' },
  { table: 'articles', column: 'tag', from: 'ru' },
  { table: 'gallery_items', column: 'caption', from: 'ru' },
  { table: 'videos', column: 'title', from: 'ru' },
  { table: 'reviews', column: 'author_city', from: 'ru' },
  { table: 'reviews', column: 'body', from: 'ru' },
  { table: 'reviews', column: 'tour_title', from: 'ru' },
  { table: 'faqs', column: 'question', from: 'ru', site: 'global' },
  { table: 'faqs', column: 'answer', from: 'ru', site: 'global' },
  { table: 'places_to_see', column: 'name', from: 'ru' },
  { table: 'places_to_see', column: 'region', from: 'ru' },
  { table: 'places_to_see', column: 'description', from: 'ru' },
  { table: 'builder_steps', column: 'title', from: 'ru' },
  { table: 'builder_steps', column: 'hint', from: 'ru' },
  { table: 'builder_steps', column: 'rail_label', from: 'ru' },
  { table: 'builder_options', column: 'name', from: 'ru' },
  { table: 'builder_options', column: 'note', from: 'ru' },
  { table: 'content_blocks', column: 'key_text', from: 'ru', site: 'global' },
  { table: 'content_blocks', column: 'value_text', from: 'ru', site: 'global' },
  { table: 'content_blocks', column: 'note', from: 'ru', site: 'global' },
  { table: 'hero_slides', column: 'title', from: 'ru', site: 'global' },

  { table: 'content_blocks', column: 'key_text', from: 'tm', site: 'umrah' },
  { table: 'content_blocks', column: 'value_text', from: 'tm', site: 'umrah' },
  { table: 'content_blocks', column: 'note', from: 'tm', site: 'umrah' },
  { table: 'hero_slides', column: 'title', from: 'tm', site: 'umrah' },
  { table: 'umrah_program_days', column: 'title', from: 'tm' },
  { table: 'umrah_program_days', column: 'description', from: 'tm' },
  { table: 'umrah_program_days', column: 'city', from: 'tm' },
  { table: 'ziyarat_places', column: 'name', from: 'tm' },
  { table: 'ziyarat_places', column: 'description', from: 'tm' },
  { table: 'ziyarat_places', column: 'duration_label', from: 'tm' },
  { table: 'umrah_groups', column: 'label', from: 'tm' },
  { table: 'umrah_groups', column: 'short_label', from: 'tm' },
  { table: 'umrah_groups', column: 'description', from: 'tm' },
  { table: 'umrah_trips', column: 'hotel_mekka', from: 'tm' },
  { table: 'umrah_trips', column: 'hotel_medina', from: 'tm' },
];

async function main(): Promise<void> {
  const env = loadEnv();
  const pool = createPool();
  const db = createDb(pool);

  let filled = 0;
  let untranslated = 0;

  try {
    for (const target of COLUMNS) {
      const where = target.site === undefined ? sql`` : sql` AND site = ${target.site}`;

      const result = await db.execute(
        sql`SELECT id, JSON_UNQUOTE(JSON_EXTRACT(${sql.raw(`\`${target.column}\``)}, ${`$."${target.from}"`})) AS source
            FROM ${sql.raw(`\`${target.table}\``)}
            WHERE ${sql.raw(`\`${target.column}\``)} IS NOT NULL${where}`,
      );

      const rows = (result as unknown as { id: number; source: string | null }[][])[0] ?? [];

      for (const row of rows) {
        if (row.source === null || row.source === '') continue;

        const translated = target.from === 'ru' ? ru3(row.source) : tm2(row.source);
        const pairs = Object.entries(translated).filter(
          ([lang, value]) => lang !== target.from && typeof value === 'string' && value !== '',
        );

        if (pairs.length === 0) {
          untranslated += 1;
          continue;
        }

        // `JSON_SET` with `COALESCE`-like guard: only writes a path that is currently absent, so
        // an editor's own wording survives a re-run. Built as one statement per row because the
        // set of missing languages differs per row and MySQL has no «merge if absent» for JSON.
        for (const [lang, value] of pairs) {
          const update = await db.execute(
            sql`UPDATE ${sql.raw(`\`${target.table}\``)}
                SET ${sql.raw(`\`${target.column}\``)} = JSON_SET(${sql.raw(`\`${target.column}\``)}, ${`$."${lang}"`}, ${value})
                WHERE id = ${row.id}
                  AND JSON_UNQUOTE(JSON_EXTRACT(${sql.raw(`\`${target.column}\``)}, ${`$."${lang}"`})) IS NULL`,
          );

          // What the database actually changed, not what was offered to it. On a second run
          // every path already exists and the guard matches nothing — «444 values written» when
          // none were is the sort of number that gets believed later.
          const affected = (update as unknown as { affectedRows?: number }[])[0]?.affectedRows ?? 0;
          filled += affected;
        }
      }
    }

    process.stdout.write(
      `translations: ${String(filled)} values touched, ${String(untranslated)} with no entry in the dictionary\n`,
    );
    if (untranslated > 0) {
      process.stdout.write(
        '  run `pnpm --filter @charva/api i18n:report -- --all` to see what is still missing\n',
      );
    }
    process.stdout.write(`  database: ${env.DATABASE_URL.replace(/:[^:@]*@/, ':***@')}\n`);
  } finally {
    await pool.end();
  }
}

await main();
