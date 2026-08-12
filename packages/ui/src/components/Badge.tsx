import { type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '../cn';

/**
 * `tint` is the sand status pill — «Boş ýer: 12 · 38 gün galdy», the open-signup badge on
 * Choice. `scrim` is the pill that sits on a photograph: a tag, a city, a video duration.
 */
export type BadgeVariant = 'tint' | 'scrim';

const VARIANT: Record<BadgeVariant, string> = {
  tint: 'border-tint-line bg-tint-strong text-accent-active',
  scrim: 'border-transparent bg-scrim text-dark-on',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /**
   * Show the pulsing dot that means "this is live right now".
   *
   * It stops after one cycle under `prefers-reduced-motion` — the global rule in styles.css
   * caps the iteration count — which is the correct outcome: a dot that pulses forever beside
   * text is a documented migraine trigger, and the badge still reads without it.
   */
  live?: boolean;
  children?: ReactNode;
}

export function Badge({
  variant = 'tint',
  live = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[11px] rounded-full border px-5 py-3',
        'font-black uppercase text-label',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {live && (
        <span
          aria-hidden="true"
          className="h-[7px] w-[7px] shrink-0 rounded-full bg-accent animate-pulse"
        />
      )}
      {children}
    </span>
  );
}
