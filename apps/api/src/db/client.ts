import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';

import { loadEnv } from '../env';

import * as schema from './schema';

export type Database = MySql2Database<typeof schema>;

/**
 * The connection pool.
 *
 * `supportBigNumbers` with `bigNumberStrings: false` is deliberate: money is stored in BIGINT
 * minor units, and the largest value this system will ever hold — a hundred-thousand-dollar
 * tour in cents — is ten million, comfortably inside a JavaScript integer. Turning the strings
 * off keeps the arithmetic in `@charva/contracts` working on numbers rather than on strings
 * that look like numbers.
 *
 * `timezone: 'Z'` matters more than it looks. Departure times are stored in UTC and the
 * countdown is computed from them; a driver that helpfully applies the server's local zone
 * would shift every Umrah date by five hours.
 */
export function createPool(url?: string): mysql.Pool {
  const env = loadEnv();
  return mysql.createPool({
    uri: url ?? env.DATABASE_URL,
    connectionLimit: env.DATABASE_POOL_SIZE,
    timezone: 'Z',
    supportBigNumbers: true,
    bigNumberStrings: false,
    charset: 'utf8mb4_unicode_ci',
    // Rejects a truncated string or an out-of-range number instead of silently storing a
    // shortened one. The same mode the migrations and the compose file declare.
    multipleStatements: false,
  });
}

export function createDb(pool: mysql.Pool): Database {
  return drizzle(pool, { schema, mode: 'default', casing: 'snake_case' });
}

/** For scripts: a pool, a database and one call that closes both. */
export async function withDb<T>(
  run: (db: Database, pool: mysql.Pool) => Promise<T>,
  url?: string,
): Promise<T> {
  const pool = createPool(url);
  try {
    return await run(createDb(pool), pool);
  } finally {
    await pool.end();
  }
}

export { schema };
