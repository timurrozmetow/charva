import { defineConfig } from 'vitest/config';

/**
 * Two environments in one run.
 *
 * Most of this package's tests are pure — contrast arithmetic, the Tailwind preset, the
 * countdown maths — and jsdom would cost a second of startup for nothing. Only the component
 * suites need a document, so only `*.dom.test.tsx` gets one.
 *
 * The naming is deliberate: a file's environment is visible from its name in a diff, rather
 * than living in a glob here that nobody reads.
 */
export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['**/*.dom.test.tsx', 'jsdom']],
    setupFiles: ['./vitest.setup.ts'],
  },
});
