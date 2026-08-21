import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { choicePalette, globalPalette, sand, umrahPalette } from './tokens';

/**
 * The one stylesheet that cannot use the tokens.
 *
 * The loading screen has to paint before anything is fetched, which means it has to be inline in
 * `index.html`, which means its colours are hex literals rather than `var(--c-bg)` — the file
 * that defines those variables is one of the things being waited for. Literals copied out of a
 * palette are literals that drift from it, so this walks the other way: it reads what each
 * `index.html` actually says and holds it against `tokens.ts`.
 *
 * The failure it prevents is not subtle in kind but is very easy to miss in practice — a
 * repainted brand, a splash still on the old cream, and a visible flick of the wrong colour on
 * the first paint of every visit, which is the moment nobody is looking because the page after
 * it is correct.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APPS = join(HERE, '..', '..', '..', 'apps');

const SITES = [
  { app: 'web-global', background: globalPalette.bg },
  { app: 'web-umrah', background: umrahPalette.bg },
  { app: 'web-choice', background: choicePalette.bg },
];

function indexHtml(app: string): string {
  return readFileSync(join(APPS, app, 'index.html'), 'utf8');
}

describe('the loading screen each app paints before its bundle arrives', () => {
  it('is looking at the apps it thinks it is', () => {
    // Without this the suite would pass by finding no files to check.
    expect(existsSync(APPS)).toBe(true);
    for (const site of SITES) {
      expect(existsSync(join(APPS, site.app, 'index.html')), site.app).toBe(true);
    }
  });

  for (const site of SITES) {
    describe(site.app, () => {
      const html = existsSync(join(APPS, site.app, 'index.html')) ? indexHtml(site.app) : '';

      it('exists at all, and is the first element in the body', () => {
        expect(html).toContain('id="boot"');
        // Before `#root`: a cover painted after the thing it covers is not a cover.
        expect(html.indexOf('id="boot"')).toBeLessThan(html.indexOf('id="root"'));
      });

      it('is painted in this site’s own page colour, not a stale copy of it', () => {
        const colours = [...html.matchAll(/background:\s*(#[0-9a-fA-F]{6})/g)].map((match) =>
          (match[1] ?? '').toLowerCase(),
        );

        // Twice: on `html`, so the browser has it before any stylesheet, and on the cover.
        expect(colours).toHaveLength(2);
        for (const colour of colours) expect(colour).toBe(site.background.toLowerCase());
      });

      it('turns the ring in the brand accent', () => {
        expect(html.toLowerCase()).toContain(`border-top-color: ${sand.DEFAULT.toLowerCase()}`);
      });

      it('gives up on its own if the script never arrives', () => {
        // A spinner that turns for ever is worse than an empty page somebody can reload, and
        // this is the only failure where no JavaScript will be running to notice.
        expect(html).toContain('boot-give-up');
      });

      it('stops turning for a visitor who asked for no motion', () => {
        expect(html).toContain('prefers-reduced-motion: reduce');
      });

      it('is taken down by the app, rather than left to the twelve-second failsafe', () => {
        const main = readFileSync(join(APPS, site.app, 'src', 'main.tsx'), 'utf8');
        expect(main).toContain('hideBootSplash()');
      });
    });
  }
});
