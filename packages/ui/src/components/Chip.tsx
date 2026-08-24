import { type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../cn';

/**
 * `solid` is a filter or a tab: selected means the dark brand fill. `tint` is a choice within
 * a form — the «Интересует» topics, the Umrah room type — where selected means a sand wash
 * with a sand border.
 *
 * Both appear on both sites with the same two shapes and different literals, which is what
 * the theme variables are for.
 */
export type ChipVariant = 'solid' | 'tint';

const IDLE = 'border-line-chip bg-transparent text-nav hover:border-line-strong';

const ACTIVE: Record<ChipVariant, string> = {
  solid: 'border-dark-alt bg-dark-alt text-dark-on',
  tint: 'border-accent bg-tint text-accent-active',
};

export interface ChipStyleProps {
  variant?: ChipVariant | undefined;
  active?: boolean | undefined;
  className?: string | undefined;
}

/**
 * The class list on its own, so the same pill can be a `<button>` in a filter row, a `<label>`
 * wrapping a radio in a form, and a router `<Link>` in a breadcrumb without three copies of
 * the styling.
 */
export function chipClass({
  variant = 'solid',
  active = false,
  className,
}: ChipStyleProps = {}): string {
  return cn(
    'inline-flex min-h-tap select-none items-center justify-center gap-2 rounded-full border',
    'px-5 py-[11px] text-chip font-medium',
    // Named properties and a press state, for the reasons written out in `Button.tsx`. A filter
    // chip is tapped more often than anything else on a listing page and had the least to say
    // about it: on a phone the grid below simply changed, with nothing marking the cause.
    'transition-[color,background-color,border-color,transform] duration-press ease-press',
    'active:scale-[0.97]',
    'disabled:pointer-events-none disabled:opacity-45',
    active ? ACTIVE[variant] : IDLE,
    className,
  );
}

export interface ChipProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>, ChipStyleProps {
  children?: ReactNode;
  /** The count the filter rows show after the label — «Пустыня 3». */
  count?: number | undefined;
}

/**
 * A filter or tab pill.
 *
 * Rendered as a real `<button>` with `aria-pressed`. Every one of these in the prototypes is a
 * `<div onClick>`: unreachable by keyboard, invisible to assistive technology, and with no way
 * to tell which one is on.
 */
export function Chip({ variant, active = false, className, children, count, ...rest }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={chipClass({ variant, active, className })}
      {...rest}
    >
      {children}
      {count !== undefined && (
        <span className={cn('text-[11px] font-bold', active ? 'opacity-70' : 'text-muted')}>
          {count}
        </span>
      )}
    </button>
  );
}
