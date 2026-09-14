import { withDb } from './client';
import { seedJournal } from './seed/journal';
import { countUmrahFaq, seedUmrahFaq } from './seed/umrah-faq';

/**
 * The content that has to reach a database which already has content.
 *
 * `db:seed` refuses a non-empty database (D-43) and rightly so — it is not idempotent, and the
 * live one is the one place that is never empty. Everything called here is idempotent instead:
 * it adds what is missing, fills what the design left blank, and never overwrites text somebody
 * has since edited in the admin.
 *
 * Safe to run twice. Running it costs a few queries and changes nothing when there is nothing
 * to change.
 *
 *   pnpm --filter @charva/api db:content
 *   node dist/apply-content.js          # on the server, where the bundle is
 */
async function main(): Promise<void> {
  await withDb(async (db) => {
    const articles = await seedJournal(db);
    process.stdout.write(`${String(articles)} articles written\n`);

    const faq = await seedUmrahFaq(db);
    process.stdout.write(
      `${String(faq)} Umrah questions added, ${String(await countUmrahFaq(db))} published\n`,
    );
  });
}

await main();
