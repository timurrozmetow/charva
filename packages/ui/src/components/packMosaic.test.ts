import { describe, expect, it } from 'vitest';

import { packMosaic, type MosaicTile } from './packMosaic';

/** The gallery page's fourteen tiles, with the spans the design gives them. */
const GALLERY: MosaicTile[] = [
  { spanCols: 2, spanRows: 2 },
  {},
  {},
  { spanCols: 2 },
  {},
  {},
  { spanRows: 2 },
  {},
  { spanCols: 2 },
  {},
  {},
  {},
  { spanCols: 2, spanRows: 2 },
  {},
];

/** The cells one placement occupies, as `row:col` strings. */
function cellsOf(tile: { col: number; row: number; spanCols: number; spanRows: number }): string[] {
  return Array.from({ length: tile.spanRows }, (_, r) =>
    Array.from(
      { length: tile.spanCols },
      (_, c) => `${String(tile.row + r)}:${String(tile.col + c)}`,
    ),
  ).flat();
}

function cells(tiles: readonly MosaicTile[], columns: number): string[] {
  return packMosaic(tiles, { columns }).flatMap(cellsOf);
}

describe('packMosaic', () => {
  it('never overlaps two tiles, at any width', () => {
    for (const columns of [4, 3, 2, 1]) {
      const occupied = cells(GALLERY, columns);
      expect(new Set(occupied).size, `${String(columns)} columns`).toBe(occupied.length);
    }
  });

  it('places every tile as high as it will go', () => {
    // The first-fit guarantee, and the practical fix for the prototype's gaps: no tile is ever
    // left sitting below a position it would have fitted into. First-fit can still leave the
    // odd gap — a wide tile arriving after a tall one — which is the price of the stability
    // the next test is about.
    for (const columns of [4, 3, 2]) {
      const placed = packMosaic(GALLERY, { columns });
      const occupied = new Set<string>();

      for (const tile of placed) {
        if (tile.row > 1) {
          const oneHigher = cellsOf({ ...tile, row: tile.row - 1 });
          expect(
            oneHigher.some((cell) => occupied.has(cell)),
            `a tile at row ${String(tile.row)} could have sat a row higher`,
          ).toBe(true);
        }
        for (const cell of cellsOf(tile)) occupied.add(cell);
      }
    }
  });

  it('wastes little space on the real gallery data', () => {
    // Fourteen tiles with the spans the design gives them, at the width it draws them.
    const placed = packMosaic(GALLERY, { columns: 4 });
    const rows = Math.max(...placed.map((tile) => tile.row + tile.spanRows)) - 1;
    expect(cells(GALLERY, 4).length / (rows * 4)).toBeGreaterThan(0.85);
  });

  it('is stable under a prefix, so "show more" appends instead of reshuffling', () => {
    // Sixteen tiles are already on screen when the visitor presses the button. If their
    // placement changed, every photograph they were looking at would jump.
    const first = packMosaic(GALLERY.slice(0, 8), { columns: 4 });
    const both = packMosaic(GALLERY, { columns: 4 });
    expect(both.slice(0, 8)).toEqual(first);
  });

  it('is stable under filtering, in the sense that the result is still a valid grid', () => {
    const filtered = GALLERY.filter((_, index) => index % 3 === 0);
    const occupied = cells(filtered, 4);
    expect(new Set(occupied).size).toBe(occupied.length);
  });

  it('narrows a span that will not fit rather than overflowing', () => {
    // The same rows have to work at four columns and at one.
    const [tile] = packMosaic([{ spanCols: 3 }], { columns: 2 });
    expect(tile?.spanCols).toBe(2);

    const [single] = packMosaic([{ spanCols: 2, spanRows: 2 }], { columns: 1 });
    expect(single?.spanCols).toBe(1);
    expect(single?.spanRows).toBe(2);
  });

  it('keeps the reading order left to right, top to bottom', () => {
    const placed = packMosaic([{}, {}, {}, {}, {}], { columns: 4 });
    expect(placed.map((tile) => `${String(tile.row)}:${String(tile.col)}`)).toEqual([
      '1:1',
      '1:2',
      '1:3',
      '1:4',
      '2:1',
    ]);
  });

  it('survives the inputs a database will actually hand it', () => {
    // `span_cols` is an editor-entered column, so nothing stops it being 0, negative or 99.
    const placed = packMosaic([{ spanCols: 0 }, { spanCols: -2 }, { spanCols: 99 }], {
      columns: 4,
    });
    expect(placed.every((tile) => tile.spanCols >= 1 && tile.spanCols <= 4)).toBe(true);
    expect(packMosaic([], { columns: 4 })).toEqual([]);
  });
});
