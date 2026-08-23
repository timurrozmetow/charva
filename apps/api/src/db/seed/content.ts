import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The prototypes' own data, as extracted by `scripts/extract-design-data.mjs`.
 *
 * Read rather than retyped. Several hundred lines of Russian and Turkmen transcribed by hand
 * would carry errors that look like content rather than like bugs, and nobody proofreads a
 * seed file in a language they do not speak.
 *
 * The types below are deliberately loose — this is a transcription of a design tool's output,
 * not a schema — and every field is narrowed by a parser in `parse.ts` on the way into the
 * database. `pnpm design:check` fails if the JSON drifts from the prototypes.
 */

/**
 * Beside the module first, then five levels up.
 *
 * Five levels up is the repository — true while this runs from `apps/api/src/db/seed/` under
 * `tsx`. In the deploy artefact the module is `apps/api/dist/seed.js`, `docs/` was never
 * shipped, and the same path lands somewhere above the release entirely: `node dist/seed.js`
 * on the server failed on ENOENT with the database still empty. The postbuild step copies the
 * file next to the bundle, which is what the first branch finds — the same arrangement the
 * migrations already use.
 */
function resolveContentPath(): URL {
  const besideBundle = new URL('./content.json', import.meta.url);
  if (existsSync(fileURLToPath(besideBundle))) return besideBundle;
  return new URL('../../../../../docs/design/content.json', import.meta.url);
}

export interface DesignContent {
  screenCount: number;
  declarationCount: number;
  imageSlotCount: number;
  screens: Record<string, Record<string, unknown>>;
  imageSlots: Record<string, { id: string; brief: string; shape: string; fit: string }[]>;
}

let cached: DesignContent | undefined;

export function loadContent(): DesignContent {
  cached ??= JSON.parse(readFileSync(fileURLToPath(resolveContentPath()), 'utf8')) as DesignContent;
  return cached;
}

/** One declaration from one screen, or a clear failure naming both. */
export function rows<T>(screen: string, declaration: string): T[] {
  const found = loadContent().screens[screen]?.[declaration];
  if (!Array.isArray(found)) {
    throw new Error(
      `content.json has no array ${screen} / ${declaration}. ` +
        'Run `pnpm design:extract` — the prototypes may have changed.',
    );
  }
  return found as T[];
}

/** Which site and route each prototype belongs to, for `content_slots`. */
export const SCREEN_PAGES: Record<string, { site: 'choice' | 'global' | 'umrah'; page: string }> = {
  'Charva Choice': { site: 'choice', page: 'home' },
  'Charva Travel Global': { site: 'global', page: 'home' },
  'Charva Tours': { site: 'global', page: 'tours' },
  'Charva Builder': { site: 'global', page: 'builder' },
  'Charva Hotels': { site: 'global', page: 'hotels' },
  'Charva Turkmenistan': { site: 'global', page: 'turkmenistan' },
  'Charva Gallery': { site: 'global', page: 'gallery' },
  'Charva Video': { site: 'global', page: 'video' },
  'Charva Reviews': { site: 'global', page: 'reviews' },
  'Charva Contact': { site: 'global', page: 'contact' },
  'Charva Umrah': { site: 'umrah', page: 'home' },
  'Charva Umrah Packages': { site: 'umrah', page: 'paket' },
  'Charva Umrah Route': { site: 'umrah', page: 'ziyarat' },
  'Charva Umrah Program': { site: 'umrah', page: 'maksatnama' },
  'Charva Umrah Media': { site: 'umrah', page: 'suratlar' },
  'Charva Umrah Signup': { site: 'umrah', page: 'yazylmak' },
};

/** Rows in the prototypes that carry a photo brief beside them. */
export interface SlottedRow {
  slot?: string;
  photo?: string;
  [key: string]: unknown;
}
