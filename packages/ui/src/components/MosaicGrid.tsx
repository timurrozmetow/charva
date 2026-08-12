import { type ReactNode } from 'react';

import { cn } from '../cn';
import { mosaic } from '../tokens';

import { type MosaicTile, packMosaic } from './packMosaic';

export interface MosaicItem extends MosaicTile {
  id: string;
  content: ReactNode;
}

export interface MosaicGridProps {
  items: readonly MosaicItem[];
  /** Columns at full width. Narrower screens step down to 3, 2 and 1 on their own. */
  columns?: number;
  className?: string;
}

/**
 * The photograph mosaic — the Global gallery, the homepage strip, the Umrah group grids.
 *
 * The placement is computed rather than authored, so a filtered set still tiles. See
 * `packMosaic` for why first-fit and not something that packs tighter.
 *
 * The step down to three, two and one column below 1280 is done with CSS custom properties
 * rather than by re-running the packer at each breakpoint, because the packer runs in React
 * and CSS is what actually knows the viewport width. The consequence is a compromise worth
 * being explicit about: a tile placed for four columns keeps its computed column line when the
 * grid narrows, so the arrangement below `lap:` is looser than a fresh pack would be. The
 * alternative — measuring the container and re-packing — costs a layout observer and a second
 * render on every resize, on a page that is mostly photographs.
 */
export function MosaicGrid({ items, columns = mosaic.columns, className }: MosaicGridProps) {
  const placed = packMosaic(items, { columns });

  return (
    <div
      className={cn(
        'grid gap-4 auto-rows-mosaic grid-cols-mosaic',
        'lap:grid-cols-3 tab:grid-cols-2 mob:grid-cols-1',
        className,
      )}
    >
      {items.map((item, index) => {
        const tile = placed[index];
        return (
          <div
            key={item.id}
            // Spans are data — an editor's judgement about which photograph deserves the room —
            // so they arrive as inline styles. A Tailwind class per span value would mean
            // generating every combination the catalogue might ever contain.
            style={{
              gridColumn: `span ${String(Math.min(tile?.spanCols ?? 1, columns))}`,
              gridRow: `span ${String(tile?.spanRows ?? 1)}`,
            }}
            className="overflow-hidden rounded-media"
          >
            {item.content}
          </div>
        );
      })}
    </div>
  );
}
