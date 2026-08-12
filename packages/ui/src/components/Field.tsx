import { createContext, useContext, useId, type ReactNode } from 'react';

import { cn } from '../cn';

export interface FieldState {
  /** The control's id, matching the label's `htmlFor`. */
  id: string;
  /** Ids of the hint and error text, for the control's `aria-describedby`. */
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldState | null>(null);

/**
 * Read by `Input`, `Textarea` and `Select`.
 *
 * A control outside a `Field` gets `null` and falls back to its own props, so the primitives
 * still work on their own — the search bar on the Global homepage is a bare input with no
 * label of its own.
 */
export function useField(): FieldState | null {
  return useContext(FieldContext);
}

export interface FieldProps {
  label: ReactNode;
  /** Guidance shown under the control and read out as the control's description. */
  hint?: ReactNode;
  /** The validation message. Present means the control is invalid. */
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
  /** Visually hides the label without removing it. */
  hideLabel?: boolean;
}

/**
 * A labelled form control.
 *
 * The design draws these labels as `<span>`s — 11px, 700, uppercase, tracked out — with no
 * `for` and no `id` anywhere in the package. A screen reader lands on the phone field of the
 * Umrah signup form and announces "edit text", nothing more. Here the label is a real
 * `<label>`, the ids are generated, and the control reads its own wiring out of context
 * rather than having six attributes threaded to it by hand at every call site.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  children,
  className,
  hideLabel = false,
}: FieldProps) {
  const base = useId();
  const id = `${base}-control`;
  const hintId = `${base}-hint`;
  const errorId = `${base}-error`;

  const described = [hint !== undefined && hintId, error !== undefined && errorId]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label
        htmlFor={id}
        className={cn('font-bold uppercase text-label text-muted', hideLabel && 'sr-only')}
      >
        {label}
        {required && (
          // Decoration: `required` on the control is what assistive technology reads.
          <span aria-hidden="true" className="ml-1 text-accent-text">
            *
          </span>
        )}
      </label>

      <FieldContext.Provider
        value={{
          id,
          describedBy: described === '' ? undefined : described,
          invalid: error !== undefined,
          required,
        }}
      >
        {children}
      </FieldContext.Provider>

      {hint !== undefined && (
        <p id={hintId} className="text-bodySm font-light text-muted">
          {hint}
        </p>
      )}

      {error !== undefined && (
        // No `role="alert"` here. On a failed submit with six invalid fields that is six
        // simultaneous announcements; the message is reached through `aria-describedby` when
        // focus moves to the field, and `FormError` carries the one live region per form.
        <p id={errorId} className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
