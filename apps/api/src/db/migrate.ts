import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import mysql from 'mysql2/promise';

import { loadEnv } from '../env';

/**
 * Forward-only migrations.
 *
 * No `down`. A rollback that has to be written before anyone knows what went wrong is a
 * rollback nobody tests, and a production incident is not the moment to discover that. Going
 * back means writing a new migration that goes forward to the previous state, deliberately.
 *
 * Drizzle Kit's own runner is not used because the second migration is hand-written SQL —
 * `JSON_SCHEMA_VALID` checks, a generated column and functional indexes are outside what the
 * generator can express — and a runner that applies both kinds of file identically is simpler
 * than two mechanisms.
 */

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

/** Drizzle Kit writes this between statements, and hand-written files follow the convention. */
const BREAKPOINT = '--> statement-breakpoint';

export interface MigrationFile {
  name: string;
  statements: string[];
}

export function readMigrations(dir: string = migrationsDir): MigrationFile[] {
  return (
    readdirSync(dir)
      .filter((file) => file.endsWith('.sql'))
      // Lexicographic order is the application order, which is why the files are numbered.
      .sort()
      .map((file) => ({
        name: file.replace(/\.sql$/, ''),
        statements: readFileSync(join(dir, file), 'utf8')
          .split(BREAKPOINT)
          .map((statement) => stripComments(statement).trim())
          .filter((statement) => statement.length > 0),
      }))
  );
}

/**
 * Removes `--` comment lines.
 *
 * They are the bulk of `0001_constraints.sql` and MySQL accepts them, but a statement that is
 * *only* comments would otherwise be sent as an empty query and rejected.
 */
function stripComments(sql: string): string {
  return sql
    .split('\n')
    .filter((line) => !line.trimStart().startsWith('--'))
    .join('\n');
}

async function ensureLedger(connection: mysql.Connection): Promise<void> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(190) NOT NULL,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (name)
    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci
  `);
}

export interface MigrateResult {
  applied: string[];
  alreadyApplied: string[];
}

export async function migrate(url?: string): Promise<MigrateResult> {
  const env = loadEnv();
  const connection = await mysql.createConnection({
    uri: url ?? env.DATABASE_URL,
    multipleStatements: false,
    timezone: 'Z',
  });

  try {
    await ensureLedger(connection);

    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT name FROM schema_migrations',
    );
    const done = new Set(rows.map((row) => String(row['name'])));

    const applied: string[] = [];
    const alreadyApplied: string[] = [];

    for (const migration of readMigrations()) {
      if (done.has(migration.name)) {
        alreadyApplied.push(migration.name);
        continue;
      }

      // No transaction around the batch. MySQL commits DDL implicitly, so a wrapper would give
      // the false impression that a failure halfway leaves nothing behind. What actually
      // protects us is that each file is small and every statement is idempotent to re-derive.
      for (const statement of migration.statements) {
        try {
          await connection.query(statement);
        } catch (error) {
          throw new Error(
            `Migration ${migration.name} failed on:\n${statement.slice(0, 400)}\n\n${String(error)}`,
          );
        }
      }

      await connection.query('INSERT INTO schema_migrations (name) VALUES (?)', [migration.name]);
      applied.push(migration.name);
    }

    return { applied, alreadyApplied };
  } finally {
    await connection.end();
  }
}

// Run directly: `pnpm --filter @charva/api db:migrate`.
if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const result = await migrate();
  if (result.applied.length === 0) {
    process.stdout.write(`nothing to apply (${String(result.alreadyApplied.length)} already in)\n`);
  } else {
    for (const name of result.applied) process.stdout.write(`applied ${name}\n`);
  }
}
