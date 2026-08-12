import { withDb } from '../client';

import { isEmpty, seedAll, type SeedCounts } from './seed';

/**
 * Fills an empty database with the catalogue the prototypes describe.
 *
 * It refuses a database that already has content. Seeding is not idempotent — every insert
 * would collide with a unique slug or silently double a list — and the recovery is one command
 * (`db:reset && db:migrate && db:seed`), so stopping is both safer and cheaper than guessing
 * what the operator meant.
 */
export async function seed(options: { force?: boolean } = {}): Promise<SeedCounts> {
  return withDb(async (db) => {
    if (!(await isEmpty(db)) && options.force !== true) {
      throw new Error(
        'The database already has content. Seeding twice would duplicate every list.\n' +
          'Start over with:  pnpm --filter @charva/api db:reset && pnpm --filter @charva/api db:migrate && pnpm --filter @charva/api db:seed',
      );
    }
    return seedAll(db);
  });
}

export { isEmpty, seedAll };

if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const counts = await seed({ force: process.argv.includes('--force') });
  const width = Math.max(...Object.keys(counts).map((name) => name.length));
  for (const [table, count] of Object.entries(counts)) {
    process.stdout.write(`${table.padEnd(width)}  ${String(count)}\n`);
  }
}
