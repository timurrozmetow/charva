import { type Site } from './constants';

/**
 * The overlay a homepage lays over its photograph, and the one design value the server draws.
 *
 * Every colour in this project lives in `packages/ui/src/tokens.ts` and nowhere else (D-27), and
 * that stayed true while only the browser painted. It stopped being enough when the shell began
 * putting the hero into the loading splash: that markup is rendered by the API, before any
 * stylesheet exists, so it cannot say `var(--c-scrim-rgb)` and cannot use a Tailwind class. The
 * choice was a second copy of three opacities and two colours in the API, or one definition both
 * sides read — and this repository has a long list of decisions about which of those to pick.
 *
 * So the numbers are here, in the package both ends already import, and `tokens.ts` reads them
 * back rather than restating them. `packages/ui` bundles contracts, so the browser pays nothing
 * for the move.
 *
 * The gradient is written against a base passed in, because the stylesheet wants one rule for
 * two sites (`var(--c-scrim-rgb)`, redirected per theme) and the server wants the literal for
 * the site it is rendering. One function, two callers, no drift.
 */

/** The base of each site's photo scrims, as an `r, g, b` triple. */
export const SCRIM_RGB = {
  global: '38, 27, 18',
  umrah: '14, 23, 20',
  // The chooser has no hero photograph and no splash image; its glass is a different value.
  choice: '20, 14, 10',
} as const satisfies Record<Site, string>;

/**
 * Bottom, middle and top opacity: opaque enough to read a headline over, clear enough at the top
 * to still see what was photographed.
 */
export const HERO_SCRIM_STOPS = [0.94, 0.5, 0.34] as const;

/**
 * Umrah's hero runs at 105° rather than vertically.
 *
 * The one genuine difference between the two overlays, which is why the direction is a parameter
 * and the stops are not: a change to the stops has to move both.
 */
export const HERO_SCRIM_DIRECTION = {
  global: 'to top',
  umrah: '105deg',
  choice: 'to top',
} as const satisfies Record<Site, string>;

export function heroScrimCss(rgb: string, direction = 'to top'): string {
  const [bottom, mid, top] = HERO_SCRIM_STOPS;
  return (
    `linear-gradient(${direction}, rgba(${rgb}, ${String(bottom)}) 0%, ` +
    `rgba(${rgb}, ${String(mid)}) 46%, ` +
    `rgba(${rgb}, ${String(top)}) 100%)`
  );
}
