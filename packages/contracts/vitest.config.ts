import { defineConfig } from 'vitest/config';

/**
 * Two environments in one run, on the same convention `packages/ui` uses.
 *
 * Almost everything here is pure — schemas, money, the plural rules, the head strings — and
 * jsdom would cost a second of startup for nothing. `applyDocumentHead` is the exception: it is
 * the browser half of the wire format, like `client.ts`, and the defect it exists to prevent
 * lives in the document rather than in a return value.
 */
export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [['**/*.dom.test.ts', 'jsdom']],
  },
});
