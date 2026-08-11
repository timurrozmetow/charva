import { type ReactNode } from 'react';

import { cn } from '../cn';

import { Eyebrow } from './Eyebrow';
import { Heading, type HeadingSize } from './Heading';

export interface SectionHeadProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** A lead paragraph under the heading. */
  lead?: ReactNode;
  /** The link at the far end of the row — usually a `LinkArrow`. */
  action?: ReactNode;
  level?: 1 | 2 | 3 | 4;
  size?: HeadingSize;
  className?: string;
  titleClassName?: string;
}

/**
 * Eyebrow, heading and an optional trailing link, baseline-aligned.
 *
 * This exact arrangement opens seventeen sections across the two sites. Below `tab:` the row
 * stacks, because «Все туры — 32 →» beside a 34px heading on a 768px screen leaves the
 * heading about four words wide.
 */
export function SectionHead({
  eyebrow,
  title,
  lead,
  action,
  level = 2,
  size = 'h2Lg',
  className,
  titleClassName,
}: SectionHeadProps) {
  return (
    <div
      className={cn(
        'mb-12 flex items-end justify-between gap-10',
        'tab:mb-8 tab:flex-col tab:items-start tab:gap-5',
        className,
      )}
    >
      <div>
        {eyebrow !== undefined && <Eyebrow className="mb-[18px]">{eyebrow}</Eyebrow>}
        <Heading level={level} size={size} className={cn('max-w-[600px]', titleClassName)}>
          {title}
        </Heading>
        {lead !== undefined && (
          <p className="mt-5 max-w-[560px] font-light text-lead text-body">{lead}</p>
        )}
      </div>
      {action}
    </div>
  );
}
