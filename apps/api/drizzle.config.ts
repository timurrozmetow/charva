import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit generates the base DDL from `src/db/schema`.
 *
 * What it cannot express — `JSON_SCHEMA_VALID` checks, the generated column that limits
 * `umrah_trips` to one current row, and functional indexes over JSON paths — is added by
 * hand in a follow-up migration. Those are in `src/db/migrations`, applied in filename order
 * by `src/db/migrate.ts`, forward only.
 *
 * `casing: 'snake_case'` maps camelCase columns to snake_case SQL once, instead of writing
 * every column name twice and eventually mistyping one.
 */
export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema/index.ts',
  out: './src/db/migrations',
  casing: 'snake_case',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? 'mysql://root@127.0.0.1:3308/charva',
  },
  verbose: true,
  strict: true,
});
