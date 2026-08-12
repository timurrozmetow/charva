import { type HTMLAttributes } from 'react';

import { cn } from '../cn';

export interface EyebrowProps extends HTMLAttributes<HTMLElement> {
  as?: 'div' | 'p' | 'span';
}

/**
 * The small tracked-out label above a heading — «Популярные туры», «Saýlanan paket».
 *
 * 11px at weight 700 is not "large text" by WCAG's definition, which is why the sand it is
 * drawn in had to be darkened: at the mockup's `#A9722C` it sits at 3.8:1 against the page.
 * The colour comes from `--c-accent-text`, so on a dark section it becomes the bright sand
 * automatically.
 */
export function Eyebrow({ as: Tag = 'div', className, ...rest }: EyebrowProps) {
  return (
    <Tag className={cn('font-bold uppercase text-eyebrow text-accent-text', className)} {...rest} />
  );
}
