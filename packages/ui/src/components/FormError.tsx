import { type ReactNode } from 'react';

import { cn } from '../cn';

export interface FormErrorProps {
  /** Absent means nothing is wrong; the live region stays mounted and empty. */
  children?: ReactNode;
  className?: string;
}

/**
 * The one live region per form.
 *
 * A submission that fails on the server — the rate limit, a network drop, a lead the API
 * rejected — produces no field error to land on, so without this the form appears to do
 * nothing at all when the button is pressed. None of the forms in the handoff have a failure
 * state, because none of them submit.
 *
 * It stays mounted while empty on purpose. A live region inserted into the document at the
 * same moment it gains text is frequently not announced: the browser has to be observing the
 * node before the change to report it.
 */
export function FormError({ children, className }: FormErrorProps) {
  const shown = children !== undefined && children !== false && children !== null;

  return (
    <div role="alert" aria-live="assertive" className={cn(!shown && 'sr-only', className)}>
      {shown && (
        <p className="m-0 rounded-input border border-danger bg-line-soft px-4 py-3 text-bodySm font-medium text-danger">
          {children}
        </p>
      )}
    </div>
  );
}
