import { type AnchorHTMLAttributes, type ElementType, type ReactNode } from 'react';

import { cn } from '../cn';

/**
 * `rule` is the "see all" link at the end of a section header — «Все туры — 32 →» — with a
 * sand underline. `plain` is the smaller «Подробнее →» inside a card.
 */
export type LinkArrowVariant = 'rule' | 'plain';

const VARIANT: Record<LinkArrowVariant, string> = {
  rule: 'text-[13px] font-bold tracking-[0.1em] text-ink border-b border-accent pb-1.5 hover:text-accent-text',
  plain: 'text-[12px] font-black tracking-[0.12em] text-accent-text hover:text-accent',
};

export interface LinkArrowProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: LinkArrowVariant;
  /**
   * A link component to render instead of `<a>`.
   *
   * This package must not know which router an app uses, so the app hands its own `Link` in
   * and every prop below is forwarded to it unchanged.
   */
  as?: ElementType;
  children?: ReactNode;
}

/**
 * A text link with a trailing arrow that nudges on hover.
 *
 * The arrow is a real `→` rather than an icon: unlike the stars, ticks and carets the design
 * types into the markup, the arrows do exist in Stolzl. It is hidden from assistive technology
 * — "Все туры — 32, right arrow" is noise.
 *
 * The nudge is the design's `gap: 14px → 20px` written as a transform, which animates on the
 * compositor instead of relaying out the line on every frame.
 */
export function LinkArrow({
  as: Tag = 'a',
  variant = 'rule',
  className,
  children,
  ...rest
}: LinkArrowProps) {
  return (
    <Tag
      className={cn(
        'group inline-flex shrink-0 items-center gap-2 uppercase no-underline',
        'transition-colors duration-colour',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {children}
      <span
        aria-hidden="true"
        className="transition-transform duration-colour group-hover:translate-x-1.5"
      >
        →
      </span>
    </Tag>
  );
}
