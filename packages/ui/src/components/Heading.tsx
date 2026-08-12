import { type HTMLAttributes } from 'react';

import { cn } from '../cn';

export type HeadingSize = 'hero' | 'h1' | 'h2Lg' | 'h2' | 'h2Sm' | 'h3' | 'card';
export type HeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'div' | 'span';

/**
 * Size against the design's type scale, with the steps below 1280 written here rather than
 * left to each page. The design is fixed-width at 1280 and above, so every value at those
 * widths is the mockup's; the narrower steps are ours.
 *
 * `hero` carries no breakpoint classes because its size is a `clamp()` in the theme — see
 * `heroScale` in tokens.ts. It is the one type role where the three sites genuinely differ.
 */
const SIZE: Record<HeadingSize, string> = {
  hero: 'text-hero',
  h1: 'text-h1 lap:text-[54px] tab:text-[44px] mob:text-[34px]',
  h2Lg: 'text-h2Lg lap:text-h2 tab:text-[34px] mob:text-[28px]',
  h2: 'text-h2 tab:text-[34px] mob:text-[28px]',
  h2Sm: 'text-h2Sm tab:text-[30px] mob:text-[26px]',
  h3: 'text-h3 tab:text-[28px] mob:text-[24px]',
  card: 'text-cardTitle mob:text-[21px]',
};

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  /**
   * Where this heading sits in the document outline. Deliberately independent of `size`: a
   * card title that looks small is still an `h3` if that is what the page structure says, and
   * a visually huge line inside a card is not an `h1` just because it is big.
   */
  level?: 1 | 2 | 3 | 4;
  size?: HeadingSize;
  /** Escape hatch for a line that must look like a heading and stay out of the outline. */
  as?: HeadingTag;
}

export function Heading({ level = 2, size = 'h2', as, className, ...rest }: HeadingProps) {
  const Tag: HeadingTag = as ?? (`h${String(level)}` as HeadingTag);

  return (
    <Tag
      className={cn(
        // Weight 500 throughout — every heading in the handoff is Stolzl Medium.
        'm-0 font-medium text-ink text-pretty',
        SIZE[size],
        className,
      )}
      {...rest}
    />
  );
}
