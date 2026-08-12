import { type ReactNode } from 'react';

import { cn } from '../cn';

export interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  /** Usually a button clearing the filter that emptied the grid. */
  action?: ReactNode;
  className?: string;
}

/**
 * Nothing matched.
 *
 * The prototypes cannot reach this state: their filters run over nine hardcoded rows and every
 * chip has at least one match, so an empty grid never happens. With a real catalogue and an
 * editor who has unpublished something, it happens on the first day.
 *
 * `role="status"` because it appears in response to something the user just did — pressing a
 * filter — and they need to be told that the answer is "none" rather than left looking at a
 * blank rectangle.
 */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center gap-4 rounded-panel border border-line bg-surface px-8 py-16 text-center',
        className,
      )}
    >
      <p className="m-0 text-cardTitle font-medium text-ink">{title}</p>
      {description !== undefined && (
        <p className="m-0 max-w-[420px] text-body font-light text-body">{description}</p>
      )}
      {action}
    </div>
  );
}
