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
  /**
   * How far apart the columns stand.
   *
   * A prop rather than a class the caller passes, because `cn` is clsx: a `gap-10` in
   * `className` would sit beside the default `gap-[22px]` and the stylesheet's order would
   * decide the winner (decision D-90). Two named values, both the handoff's.
   */
  gap?: 'default' | 'wide';
}

/**
 * Written out because Tailwind reads class names out of the source: `grid-cols-${n}` is a
 * string at runtime and a rule that never got generated at build time.
 */
const COLUMNS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

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
export function StatStrip({ items, className, valueClassName, gap = 'default' }: StatStripProps) {
  /*
   * As many columns as there are numbers.
   *
   * It was four regardless, and three of the five strips carry three numbers — so a quarter of
   * the width sat empty on the right while the labels of the other three wrapped mid-phrase:
   * «СРЕДНЯЯ / ОЦЕНКА» over two lines beside a column with nothing in it. Four is the widest
   * strip in the design, not the shape of every strip.
   */
  const columns = COLUMNS[Math.min(Math.max(items.length, 1), 4)] ?? 'grid-cols-4';

  return (
    <dl
      className={cn(
        'm-0 grid tab:grid-cols-2 tab:gap-8 mob:grid-cols-1 mob:gap-6',
        columns,
        /*
         * 22px is what the handoff draws five of its six strips at, and it is 22 rather than 40
         * for a reason: at 40 the columns of a strip sitting in a half-width page header are
         * narrow enough that «Советуют друзьям» breaks across two lines under a number that
         * fits easily. The sixth is the full-width band on Umrah's homepage, drawn at 40.
         */
        gap === 'wide' ? 'gap-10' : 'gap-[22px]',
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
