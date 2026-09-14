import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const PAGES_DIR = join(__dirname, 'pages');
const ROUTER = readFileSync(join(__dirname, 'router.tsx'), 'utf8');

/**
 * The split, guarded structurally rather than by weight.
 *
 * `scripts/check-bundle-budget.mjs` fails when the boot bundle passes 200 KB, and that is the
 * number that matters — but it is a ceiling, and this site sits well under it. A
 * page dragged back into the entry by a stray `import { GalleryPage } from './pages/…'` would
 * cost a few kilobytes, pass the budget, and undo the reason the split exists, one page at a
 * time and never visibly.
 *
 * One page is legitimately eager and it is named here rather than pattern-matched, so adding a
 * second is a line in a diff somebody has to defend: `NotFoundPage`, which the root route
 * renders when nothing matched. It has no route of its own to be lazy about, and it is what the
 * shell falls back to.
 */
const EAGER = new Set(['NotFoundPage']);

describe('route splitting', () => {
  it('imports every page lazily, except the ones named here', () => {
    const pages = readdirSync(PAGES_DIR)
      .filter((file) => file.endsWith('.tsx') && !file.includes('.test.'))
      .map((file) => file.replace(/\.tsx$/, ''));

    expect(pages.length).toBeGreaterThan(6);

    for (const page of pages) {
      const eagerImport = new RegExp(`^import \\{[^}]*\\} from '\\./pages/${page}';`, 'm');
      const lazyImport = `import('./pages/${page}')`;

      if (EAGER.has(page)) {
        expect(ROUTER, `${page} is declared eager`).toMatch(eagerImport);
        continue;
      }

      expect(ROUTER, `${page} must not be imported statically`).not.toMatch(eagerImport);
      expect(ROUTER, `${page} must be reached through a dynamic import`).toContain(lazyImport);
    }
  });

  it('keeps the loaders eager, so code and data are fetched together', () => {
    /*
     * The point of splitting is lost if the page's chunk only starts downloading after its
     * data has arrived, or the other way round. The loaders live in the router and reference
     * the query factories directly, which is what puts both requests in the same tick.
     */
    expect(ROUTER).toMatch(/^import \{\n(?:\s+\w+,\n)+\} from '\.\/api\/queries';/m);
    expect(ROUTER).toContain('prefetchQuery');
  });
});
