import { type HTMLAttributes } from 'react';

import { cn } from '../cn';

/** The block elements a container is ever rendered as. */
export type BlockTag = 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'main';

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: BlockTag;
  /** `island` is the navigation bar, which the design draws 40px narrower. */
  width?: 'content' | 'island';
}

/**
 * The content rail: 1480px wide with a 60px gutter, centred.
 *
 * Every page in the handoff repeats `max-width:1480px; margin:0 auto; padding:0 60px` inline,
 * around forty times. The gutter steps down below 1280 because it cannot not: 60px each side
 * of a 375px phone leaves 255px of content.
 *
 * **A container inside a container is the same container**, and `data-container` is how the
 * stylesheet is told so. `Section` has wrapped its children in one since the commit that
 * introduced it, and sixty-seven places across the two sites wrote `<Section><Container>`
 * anyway — so every one of those pages has been paying the gutter twice. Measured in a browser
 * at 412 pixels: the rail is 372 wide, the second container makes it 332, and a card inside it
 * 330. On a desktop it is 1240 where the design says 1360. Nobody chose 120px gutters; it is
 * what two correct components do when they are stacked.
 *
 * Fixed with one rule rather than sixty-seven deletions, because a deletion fixes the pages
 * that exist and a rule fixes the sixty-eighth. It is also what made the symptom findable at
 * all: the audit reported «image is larger than its container», which was true, and the reason
 * was two gutters rather than anything about the image.
 */
export function Container({
  as: Tag = 'div',
  width = 'content',
  className,
  ...rest
}: ContainerProps) {
  return (
    <Tag
      data-container=""
      className={cn(
        'mx-auto w-full',
        width === 'island' ? 'max-w-island' : 'max-w-container',
        'px-gutter lap:px-10 tab:px-8 mob:px-5',
        className,
      )}
      {...rest}
    />
  );
}
