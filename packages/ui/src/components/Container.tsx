import { type HTMLAttributes } from 'react';

import { cn } from '../cn';

/** The block elements a container is ever rendered as. */
export type BlockTag = 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'main';

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  as?: BlockTag;
  /** `island` is the sticky navigation bar, which the design draws 40px narrower. */
  width?: 'content' | 'island';
}

/**
 * The content rail: 1480px wide with a 60px gutter, centred.
 *
 * Every page in the handoff repeats `max-width:1480px; margin:0 auto; padding:0 60px` inline,
 * around forty times. The gutter steps down below 1280 because it cannot not: 60px each side
 * of a 375px phone leaves 255px of content.
 */
export function Container({
  as: Tag = 'div',
  width = 'content',
  className,
  ...rest
}: ContainerProps) {
  return (
    <Tag
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
