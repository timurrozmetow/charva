export interface MosaicTile {
  /** Editorial hint: how many columns this photograph would like. Clamped to the grid width. */
  spanCols?: number;
  spanRows?: number;
}

export interface PlacedTile {
  /** 1-based CSS grid line. */
  col: number;
  row: number;
  spanCols: number;
  spanRows: number;
}

export interface PackOptions {
  columns?: number;
}

/**
 * Places tiles into a mosaic, first-fit, in order.
 *
 * The prototypes hardcode `grid-column: span 2` and `grid-row: span 2` per tile, laid out by
 * hand against the unfiltered set of fourteen. Press any filter and the spans no longer tile:
 * the grid is left with holes, and on the Umrah group mosaic a `LAYOUT[i]` lookup runs off the
 * end of its array as soon as a group has more than eight captions.
 *
 * First-fit is not the tightest packing available, and it can still leave the odd gap — a wide
 * tile arriving just after a tall one has nowhere higher to go. What it guarantees is that no
 * tile sits below a position it would have fitted into, which is enough to close the holes the
 * hand-authored spans leave, and it is chosen for a second property that matters more.
 *
 * That property is *prefix stability*. The
 * placement of the first sixteen tiles does not depend on what comes after them, so pressing
 * "show more" appends a row instead of rearranging the photographs the visitor is already
 * looking at. A packer that optimised for fewer gaps would reshuffle the whole grid on every
 * page, which is a worse experience than the gap it saves.
 *
 * The editorial span is a request, not a rule. A tile asking for three columns in a two-column
 * layout gets two — that is what makes the same data work at 4, 3, 2 and 1 columns.
 */
export function packMosaic(
  tiles: readonly MosaicTile[],
  { columns = 4 }: PackOptions = {},
): PlacedTile[] {
  const width = Math.max(1, Math.floor(columns));

  /** How far down each column is filled, as a 1-based row line. */
  const filledTo = new Array<number>(width).fill(1);
  const placed: PlacedTile[] = [];

  for (const tile of tiles) {
    const spanCols = clamp(tile.spanCols ?? 1, 1, width);
    const spanRows = Math.max(1, Math.floor(tile.spanRows ?? 1));

    let bestCol = 0;
    let bestRow = Number.POSITIVE_INFINITY;

    // The highest position any window of `spanCols` consecutive columns can start at. Ties go
    // to the leftmost window, which is what keeps the result stable and readable.
    for (let start = 0; start + spanCols <= width; start += 1) {
      let row = 1;
      for (let offset = 0; offset < spanCols; offset += 1) {
        row = Math.max(row, filledTo[start + offset] ?? 1);
      }
      if (row < bestRow) {
        bestRow = row;
        bestCol = start;
      }
    }

    for (let offset = 0; offset < spanCols; offset += 1) {
      filledTo[bestCol + offset] = bestRow + spanRows;
    }

    placed.push({ col: bestCol + 1, row: bestRow, spanCols, spanRows });
  }

  return placed;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(value), min), max);
}
