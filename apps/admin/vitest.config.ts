import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Same split as `packages/ui`: a file's environment is visible in its name.
 *
 * The pure suites here — language negotiation, plural selection — do not need a document, and
 * paying a second of jsdom startup for them would be a second paid on every run forever.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    environmentMatchGlobs: [['**/*.dom.test.tsx', 'jsdom']],
    setupFiles: ['./vitest.setup.ts'],
  },
});
