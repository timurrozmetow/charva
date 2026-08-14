import { type Lang } from '@charva/contracts';
import { Button, EmptyState, Skeleton } from '@charva/ui';
import { type ReactNode } from 'react';

import { copyFor } from '../i18n';

export interface QueryStateProps {
  lang: Lang;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  /** How many placeholder cards to draw while the request is in flight. */
  skeletonCount?: number;
  skeletonClassName?: string;
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
 * Failure offers the retry rather than describing the error. «Не удалось загрузить» plus a
 * button is actionable; a status code is not, and the visitor is on a phone in Ashgabat.
 */
export function QueryState({
  lang,
  isPending,
  isError,
  onRetry,
  skeletonCount = 6,
  skeletonClassName = 'h-[380px] rounded-card',
  children,
}: QueryStateProps) {
  const copy = copyFor(lang);

  if (isError) {
    return (
      <EmptyState
        title={copy.common.errorTitle}
        description={copy.common.errorHint}
        action={<Button onClick={onRetry}>{copy.common.retry}</Button>}
      />
    );
  }

  if (isPending) {
    return (
      <div
        // Announced once, politely: a screen reader should hear «Загружаем» rather than the
        // arrival of eight empty rectangles.
        role="status"
        aria-label={copy.common.loading}
        className="grid grid-cols-3 gap-6 lap:grid-cols-2 mob:grid-cols-1"
      >
        {Array.from({ length: skeletonCount }, (_, index) => (
          <Skeleton key={index} className={skeletonClassName} />
        ))}
      </div>
    );
  }

  return <>{children}</>;
}
