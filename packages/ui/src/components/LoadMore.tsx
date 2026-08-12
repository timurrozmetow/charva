import { type ReactNode } from 'react';

import { cn } from '../cn';

import { Button } from './Button';

export interface LoadMoreProps {
  /** Fired when the button is pressed. */
  onLoadMore: () => void;
  /** Hides the button when everything is already on screen. */
  hasMore: boolean;
  busy?: boolean;
  children: ReactNode;
  busyLabel?: string;
  /**
   * How many are showing and how many there are, e.g. «Показано 16 из 248».
   *
   * Announced politely after each press, because the new tiles appear below the fold and
   * pressing the button otherwise gives a keyboard or screen-reader user no feedback at all.
   */
  status?: ReactNode;
  className?: string;
}

/**
 * The «Показать ещё» button under a paginated grid.
 *
 * The prototype's version has no handler at all — it is an `<a href="#">` under a gallery of
 * fourteen tiles with a caption claiming 248.
 *
 * A button rather than an infinite scroll on purpose: infinite scroll on a gallery makes the
 * footer unreachable, and the footer is where the contact details are.
 */
export function LoadMore({
  onLoadMore,
  hasMore,
  busy = false,
  children,
  busyLabel,
  status,
  className,
}: LoadMoreProps) {
  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* Mounted even when there is nothing more to load, so the count is announced on the
          press that exhausted the list rather than disappearing with the button. */}
      <p aria-live="polite" className="sr-only">
        {status}
      </p>

      {hasMore && (
        <Button variant="outline" busy={busy} busyLabel={busyLabel} onClick={onLoadMore}>
          {children}
        </Button>
      )}
    </div>
  );
}
