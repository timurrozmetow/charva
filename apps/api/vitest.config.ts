import { defineConfig } from 'vitest/config';

/**
 * Two kinds of test, split by filename.
 *
 * `*.db.test.ts` runs against a real MySQL — `charva_test`, reset and migrated once before the
 * suite by `src/db/test-setup.ts`. Not against a mock, and not against SQLite: every rule this
 * phase is about is a MySQL feature. `JSON_SCHEMA_VALID`, a generated column with a UNIQUE key,
 * `STRICT_TRANS_TABLES` truncation and CHECK constraints do not exist in a fake, so a test
 * against one proves nothing about what the database will actually accept.
 *
 * It needs the local services running: `pnpm setup:services`.
 */
export default defineConfig({
  test: {
    globalSetup: ['./src/db/test-setup.ts'],
    // The DB suites share one schema, so they must not run at the same time.
    fileParallelism: false,
    testTimeout: 20_000,
  },
});
