import { type HTMLAttributes } from 'react';

import { cn } from '../cn';

export interface DividerProps extends HTMLAttributes<HTMLElement> {
  orientation?: 'horizontal' | 'vertical';
}

/**
 * A hairline rule.
 *
 * The colour comes from `--c-border-rgb`, which a dark section flips to the brand cream, so
 * the same component draws a brown rule on the tours page and a cream one in the footer.
 *
 * The vertical form is the 1×26px rule between the logo and the menu in the navigation
 * island. It gets an explicit height from the caller — `className="h-[26px]"` — because a
 * separator with no height is invisible and `h-full` only works inside a flex row.
 */
export function Divider({ orientation = 'horizontal', className, ...rest }: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <span
        role="separator"
        aria-orientation="vertical"
        className={cn('inline-block w-px shrink-0 self-stretch bg-line-field', className)}
        {...rest}
      />
    );
  }

  return (
    <hr className={cn('m-0 w-full border-0 border-t border-line-rule', className)} {...rest} />
  );
}
