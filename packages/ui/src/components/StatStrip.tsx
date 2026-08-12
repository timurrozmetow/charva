import { type ReactNode } from 'react';

import { cn } from '../cn';

export interface StatItem {
  /** The number. Always an aggregate from the API — never a literal typed into the markup. */
  value: ReactNode;
  label: ReactNode;
}

export interface StatStripProps {
  items: readonly StatItem[];
  className?: string;
  /** Class for the numbers. The strip is 28px; other statistic numbers run up to 46. */
  valueClassName?: string;
}

/**
 * A row of headline numbers — «68 групп · 2 840 паломников · 4.8 оценка».
 *
 * A description list, because that is what it is: each label describes its number. The
 * prototypes use a `<div>` of `<span>`s, so the pairing exists only visually and a screen
 * reader reads eight disconnected fragments.
 *
 * The DOM order is label then value, as `<dl>` requires; the display is reversed with
 * `flex-col-reverse` so the number still sits on top.
 *
 * Every one of these numbers is an aggregate — decision D-6. The handoff types «214 отзывов»
 * and «68 групп» into the markup beside nine rows of data.
 */
export function StatStrip({ items, className, valueClassName }: StatStripProps) {
  return (
    <dl
      className={cn(
        'm-0 grid grid-cols-4 gap-10 tab:grid-cols-2 tab:gap-8 mob:grid-cols-1 mob:gap-6',
        className,
      )}
    >
      {items.map((item, index) => (
        <div key={index} className="flex flex-col-reverse gap-2">
          <dt className="font-bold uppercase text-label tracking-[0.14em] text-muted">
            {item.label}
          </dt>
          <dd
            className={cn('m-0 font-medium leading-none text-[28px] text-accent', valueClassName)}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
