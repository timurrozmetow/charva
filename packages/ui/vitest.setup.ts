import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Vitest does not unmount between tests on its own, so without this a component that attaches
 * a document-level listener — every overlay in this package will — keeps it for the rest of
 * the file and the next test sees events it never fired.
 */
afterEach(() => {
  cleanup();
});
