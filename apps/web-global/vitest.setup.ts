import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * jsdom has no `matchMedia`, and this site asks for one.
 *
 * `usePrefersReducedMotion` calls it when the carousel mounts, and without it the homepage
 * throws into the router's error boundary and every assertion below reads «Something went
 * wrong!» instead of the page. Defined once here rather than stubbed per test — it is a gap in
 * the environment, not a fixture.
 *
 * Assigned directly rather than through `vi.stubGlobal`, because the page tests call
 * `vi.unstubAllGlobals()` to release their `fetch` stub and would take this with it.
 *
 * Guarded, because the pure suites in this package run in the `node` environment where there
 * is no `window` at all — an unguarded assignment there fails every file before it starts.
 *
 * `matches: false` is the honest default: no reduced-motion preference. A test that wants the
 * other answer overrides it for itself.
 */
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

afterEach(() => {
  cleanup();
});
