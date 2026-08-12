import mysql from 'mysql2/promise';

import { migrate } from './migrate';
import { reset } from './reset';

/**
 * Prepares `charva_test` once, before any suite runs.
 *
 * The database tests are the only proof that the rules are kept by MySQL rather than by an
 * application layer that can be bypassed, so they run against a real server. That makes the
 * local services a genuine prerequisite, and the message below says so plainly instead of
 * failing with a connection error nobody can act on.
 */
export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ?? 'mysql://root:charva_dev_only@127.0.0.1:3308/charva_test';

export default async function setup(): Promise<void> {
  try {
    const probe = await mysql.createConnection({
      uri: TEST_DATABASE_URL.replace(/\/charva_test$/, '/'),
      connectTimeout: 3000,
    });
    await probe.end();
  } catch (error) {
    throw new Error(
      'The database tests need the local MySQL on 127.0.0.1:3308.\n' +
        'Start it with:  pnpm setup:services\n' +
        `Underlying error: ${String(error)}`,
    );
  }

  await reset({ url: TEST_DATABASE_URL, force: true });
  await migrate(TEST_DATABASE_URL);
}
