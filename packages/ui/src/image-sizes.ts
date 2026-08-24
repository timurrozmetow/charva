import { mosaic } from './tokens';

/**
 * What to tell the browser about how wide a photograph will actually be drawn.
 *
 * `srcSet` alone decides nothing. It offers seven widths; `sizes` is what the browser uses to
 * pick between them, and with no `sizes` the specification says to assume `100vw` — the element
 * fills the window. Every photograph on both sites was making that claim, including the 44px
 * avatar on a review card. Measured against the live server, one image is 361 KB at 1600px and
 * 53 KB at 640px, so a row of three tour cards was fetching about 1.1 MB to draw three 436px
 * thumbnails. That cost nothing while the slots were empty and started costing on the day 116
 * photographs landed in them.
 *
 * These are deliberately coarse. `sizes` does not have to be the exact rendered width — it only
 * has to land in the right bucket of `IMAGE_WIDTHS`, and being a few `vw` generous is free
 * while being short is not: an under-declared size fetches an image with too few pixels and
 * draws it soft, which is the one failure here a reader can actually see. Every value below
 * rounds up.
 *
 * They live in one module rather than at the call sites because they describe the *layouts*,
 * and a layout is shared: eight card grids across two sites step 3 -> 2 -> 1 at the same two
 * breakpoints. Written out at each call they would drift from the grid the day somebody changes
 * a column count, and the symptom — a slightly soft photograph on one page — is not one anybody
 * traces back.
 *
 * The rail is 1480px wide with a 60px gutter, so content maxes out at 1360px; the breakpoints
 * are `mob` 767, `tab` 1023 and `lap` 1279 from `tokens.ts`.
 */
export const imageSizes = {
  /** Edge to edge: the two homepage heroes, which are the window. */
  full: '100vw',

  /**
   * One half of the chooser. 59vw rather than 50: a hovered half grows to `flex-grow: 1.45`,
   * and the photograph is what widens (the text column is pinned). Below the tablet breakpoint
   * the halves stack and each takes the whole width.
   */
  splitHalf: '(max-width: 1023px) 100vw, 59vw',

  /** A photograph spanning the content rail: the hero of a tour or hotel detail page. */
  rail: '(max-width: 1479px) 100vw, 1360px',

  /**
   * The card grids — tours, hotels, articles, places, ziyarat, group videos. Every one of them
   * is `grid-cols-3 lap:grid-cols-2 mob:grid-cols-1`, so one string serves all of them.
   */
  cardGrid: '(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 33vw',

  /**
   * One side of a two-column section. The design uses `1fr 1.05fr` and `1.35fr 1fr` in
   * different places — 51% and 57% of the rail — and both land in the same candidate at every
   * width, so they share a number rather than each having one that has to be maintained.
   */
  halfPanel: '(max-width: 1023px) 100vw, 58vw',

  /** The review card's author avatar, which is `size-11` and never anything else. */
  avatar: '44px',
} as const;

/**
 * A photograph inside a centred column of prose — the article and ziyarat detail pages, which
 * cap at 760px and 860px respectively.
 *
 * Below the cap the column is the viewport minus the container's gutters, so `100vw` over-
 * declares by the gutter and that is the safe direction.
 */
export function proseSizes(maxWidthPx: number): string {
  return `(max-width: ${String(maxWidthPx)}px) 100vw, ${String(maxWidthPx)}px`;
}

/**
 * A tile in the photograph mosaic, which is the one grid where the width is not the same for
 * every item: an editor can mark a tile to span two columns, and `MosaicGrid` steps the column
 * count down 4 -> 3 -> 2 -> 1 as the window narrows.
 *
 * The span has to be passed in because the tile's content is a `ReactNode` the caller builds —
 * `MosaicGrid` cannot reach inside it to say how wide it made the cell. Both call sites are
 * already mapping over items that carry `spanCols`, so this costs them one argument.
 */
export function mosaicTileSizes(spanCols = 1): string {
  const span = Math.min(Math.max(Math.trunc(spanCols), 1), mosaic.columns);

  // A wide tile is two of four at full width, two of three at `lap`, and the whole row below
  // that — at two columns a span of two is everything, and at one column everything again.
  if (span >= 2) return '(max-width: 1023px) 100vw, (max-width: 1279px) 67vw, 50vw';

  return '(max-width: 767px) 100vw, (max-width: 1023px) 50vw, (max-width: 1279px) 33vw, 25vw';
}
