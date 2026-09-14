import { withDb } from './client';
import { seedJournal } from './seed/journal';

/**
 * The journal, against a database that already has content.
 *
 * `db:seed` refuses a non-empty database (D-43) and rightly so, but the articles have to reach
 * the live site somehow, and the live site is the one place that is never empty. `seedJournal`
 * is idempotent by slug — it inserts what is missing, fills a row the design left with a title
 * and no text, and leaves anything an editor has written alone — so running it twice costs a
 * query and changes nothing.
 *
 *   pnpm --filter @charva/api db:journal
 *   node dist/journal-apply.js          # on the server, where the bundle is
 */
async function main(): Promise<void> {
  await withDb(async (db) => {
    const written = await seedJournal(db);
    process.stdout.write(`${String(written)} articles written\n`);
  });
}

await main();
