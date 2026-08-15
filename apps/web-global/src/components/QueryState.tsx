import { type Lang } from '@charva/contracts';
import { QueryState as SharedQueryState } from '@charva/ui';
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
 * The shared loading-and-failure component, with this site's words in it.
 *
 * The component itself moved to `packages/ui` when the admin became the third place that needed
 * it. What stays here is the half that cannot move: `packages/ui` knows about no language and
 * reads no copy file, so the labels are supplied at the boundary — the same rule that keeps
 * `renderLink` out of the package (D-33).
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

  return (
    <SharedQueryState
      isPending={isPending}
      isError={isError}
      onRetry={onRetry}
      skeletonCount={skeletonCount}
      skeletonClassName={skeletonClassName}
      labels={{
        loading: copy.common.loading,
        errorTitle: copy.common.errorTitle,
        errorHint: copy.common.errorHint,
        retry: copy.common.retry,
      }}
    >
      {children}
    </SharedQueryState>
  );
}
