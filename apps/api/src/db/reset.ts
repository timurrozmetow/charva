import mysql from 'mysql2/promise';

import { loadEnv } from '../env';

/**
 * Drops the schema and recreates it empty.
 *
 * This machine carries seven other databases belonging to three other projects — `bakar`,
 * `directorhub`, `logo_control`, `silkgrain` and their test twins. A `DROP DATABASE` pointed
 * at the wrong one by a stale `DATABASE_URL` is not recoverable from a mistyped command, so
 * the name is checked against `DATABASE_NAME_PREFIX` before anything is dropped, and refusing
 * is the default.
 */

export interface ResetOptions {
  url?: string;
  /** Set by the test harness, which resets `charva_test` between suites. */
  force?: boolean;
}

export function schemaNameFrom(url: string): string {
  const path = new URL(url).pathname;
  return decodeURIComponent(path.replace(/^\//, ''));
}

export function assertResettable(schema: string, prefix: string): void {
  if (schema === '') {
    throw new Error('DATABASE_URL names no schema — refusing to drop anything.');
  }
  if (!schema.startsWith(prefix)) {
    throw new Error(
      `Refusing to drop "${schema}": it does not start with "${prefix}". ` +
        'Seven other schemas on this machine belong to other projects.',
    );
  }
}

export async function reset(options: ResetOptions = {}): Promise<string> {
  const env = loadEnv();
  const url = options.url ?? env.DATABASE_URL;
  const schema = schemaNameFrom(url);

  assertResettable(schema, env.DATABASE_NAME_PREFIX);

  if (env.NODE_ENV === 'production' && options.force !== true) {
    throw new Error('Refusing to reset a production database.');
  }

  // Connect without a schema — the one being dropped cannot be the current one.
  const server = new URL(url);
  server.pathname = '/';

  const connection = await mysql.createConnection({ uri: server.toString(), timezone: 'Z' });
  try {
    await connection.query(`DROP DATABASE IF EXISTS \`${schema}\``);
    await connection.query(
      `CREATE DATABASE \`${schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    return schema;
  } finally {
    await connection.end();
  }
}

if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const schema = await reset();
  process.stdout.write(`dropped and recreated ${schema}\n`);
}
