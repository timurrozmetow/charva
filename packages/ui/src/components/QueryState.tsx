import { type ReactNode } from 'react';

import { cn } from '../cn';

import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export interface QueryStateLabels {
  loading: string;
  errorTitle: string;
  errorHint: string;
  retry: string;
}

export interface QueryStateProps {
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Supplied by the app: this package knows about no language and reads no copy file (D-33). */
  labels: QueryStateLabels;
  /** How many placeholder cards to draw while the request is in flight. */
  skeletonCount?: number;
  skeletonClassName?: string;
  /** The shape the skeletons are laid out in, so a list and a grid can both look right. */
  gridClassName?: string;
  children: ReactNode;
}

/**
 * Loading and failure, drawn the same way everywhere.
 *
 * The handoff has neither state: every page renders as though its data were already there, so
 * there is nothing to copy and both are designed. Two rules follow from that.
 *
 * Loading is skeletons at the real proportions rather than a spinner. A spinner says «wait» and
 * a skeleton says «this is what is coming», and on a connection that may take three seconds the
 * difference is whether the page looks broken.
 *
 * Failure offers the retry rather than describing the error. A sentence plus a button is
 * actionable; a status code is not, and the visitor is on a phone in Ashgabat.
 *
 * It lives here rather than in an app because the third copy of it was about to be written —
 * which is the point at which a shared component costs less than the copies do.
 */
export function QueryState({
  isPending,
  isError,
  onRetry,
  labels,
  skeletonCount = 6,
  skeletonClassName = 'h-[380px] rounded-card',
  gridClassName = 'grid grid-cols-3 gap-6 lap:grid-cols-2 mob:grid-cols-1',
  children,
}: QueryStateProps) {
  if (isError) {
    return (
      <EmptyState
        title={labels.errorTitle}
        description={labels.errorHint}
        action={<Button onClick={onRetry}>{labels.retry}</Button>}
      />
    );
  }

  if (isPending) {
    return (
      <div
        // Announced once, politely: a screen reader should hear «Загружаем» rather than the
        // arrival of eight empty rectangles.
        role="status"
        aria-label={labels.loading}
        className={cn(gridClassName)}
      >
        {Array.from({ length: skeletonCount }, (_, index) => (
          <Skeleton key={index} className={skeletonClassName} />
        ))}
      </div>
    );
  }

  return <>{children}</>;
}
