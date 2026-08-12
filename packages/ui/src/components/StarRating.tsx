import { cn } from '../cn';

import { Icon } from './Icon';

export interface StarRatingProps {
  /** 0 to 5. Halves are rendered; anything finer is rounded to the nearest half. */
  value: number;
  /** Star size in px. */
  size?: number;
  className?: string;
  /**
   * Accessible label. The design shows bare stars with no number beside them, so without this
   * a screen reader announces nothing at all.
   */
  label?: string;
}

/**
 * The star rating.
 *
 * The prototypes hardcode the string `★★★★★` for a five and `★★★★☆` for a four, in the markup,
 * next to a separate `rate` field holding the number. Two representations of one fact, and the
 * font has neither glyph. Here the number is the only input and the stars are drawn from it.
 */
export function StarRating({ value, size = 14, className, label }: StarRatingProps) {
  const clamped = Math.max(0, Math.min(5, value));
  const halves = Math.round(clamped * 2);

  return (
    <span
      className={cn('inline-flex items-center gap-[3px] text-accent', className)}
      role="img"
      aria-label={label ?? `${(halves / 2).toFixed(1)} out of 5`}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const filled = halves - index * 2;
        const name = filled >= 2 ? 'star' : filled === 1 ? 'starHalf' : 'star';
        return (
          <Icon
            key={index}
            name={name}
            size={size}
            className={filled <= 0 ? 'opacity-25' : undefined}
          />
        );
      })}
    </span>
  );
}
