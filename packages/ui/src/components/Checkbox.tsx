import { type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../cn';

import { Icon } from './Icon';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children: ReactNode;
  /** Validation message, shown under the label. */
  error?: ReactNode;
  /** Class for the wrapping label rather than the input. */
  className?: string;
}

/**
 * A real checkbox.
 *
 * The prototypes draw this as a 17×17 `<span>` with a border and no input behind it, on the
 * consent control of both lead forms — the one field on the site that carries a legal meaning.
 * It cannot be checked, cannot be focused, is not submitted, and reads to a screen reader as
 * nothing at all.
 *
 * Here it is `<input type="checkbox">` with the browser's rendering removed and the design's
 * box drawn in its place. The input keeps the focus, the keyboard, the form value and the
 * semantics; `appearance-none` only takes away the paint.
 *
 * The whole label is the hit area — 17px alone is a third of the 44px minimum — and the box
 * is nudged down to sit on the first line of a consent sentence that wraps.
 */
export function Checkbox({ children, error, className, disabled, ...rest }: CheckboxProps) {
  return (
    <div className="flex flex-col gap-1">
      <label
        className={cn(
          'flex min-h-tap cursor-pointer items-start gap-3 py-2',
          disabled === true && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        <span className="relative mt-[3px] inline-flex shrink-0">
          <input
            type="checkbox"
            disabled={disabled}
            aria-invalid={error !== undefined || undefined}
            className={cn(
              'peer h-[17px] w-[17px] appearance-none rounded-[5px] border border-line-control',
              'bg-field transition-colors duration-colour',
              'checked:border-accent checked:bg-accent',
              'aria-[invalid=true]:border-danger',
              'disabled:cursor-not-allowed',
            )}
            {...rest}
          />
          <Icon
            name="check"
            size={11}
            // Hidden from assistive technology: the input's own checked state is what is
            // announced, and a second "tick" would be the same fact twice.
            className={cn(
              'pointer-events-none absolute inset-0 m-auto text-accent-on opacity-0',
              'transition-opacity duration-option peer-checked:opacity-100',
            )}
          />
        </span>
        <span className="text-bodySm font-light text-body">{children}</span>
      </label>

      {error !== undefined && (
        <p className="pl-[29px] text-[13px] font-medium text-danger">{error}</p>
      )}
    </div>
  );
}
