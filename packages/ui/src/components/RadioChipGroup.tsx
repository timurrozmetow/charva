import { type ReactNode, useId } from 'react';

import { cn } from '../cn';

import { chipClass, type ChipVariant } from './Chip';

export interface RadioChipOption {
  /** Submitted and stored. A stable ASCII code, never the visible label. */
  value: string;
  label: ReactNode;
}

export interface RadioChipGroupProps {
  name: string;
  options: readonly RadioChipOption[];
  /** Controlled value. Leave undefined and pass `defaultValue` for an uncontrolled group. */
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  /** The question these chips answer. Always rendered; hide it visually if the design has no room. */
  legend: ReactNode;
  hideLegend?: boolean;
  variant?: ChipVariant | undefined;
  required?: boolean | undefined;
  error?: ReactNode;
  className?: string;
}

/**
 * A single choice made of pills — the «Интересует» topics, the Umrah room type, the tabs that
 * switch a lead's kind.
 *
 * Radio inputs rather than buttons, because that is what this is: one answer out of several,
 * submitted with the form. The prototypes use `<div onClick>` with a colour swap, which means
 * no keyboard, no arrow keys, no form value and nothing announced. A native radio group gives
 * all four for free, including the arrow-key behaviour that would otherwise have to be written
 * and tested by hand.
 *
 * The inputs are visually hidden but still focusable, so the focus ring is drawn on the pill
 * through `peer-focus-visible`. `sr-only` alone would leave a keyboard user unable to see
 * where they are.
 */
export function RadioChipGroup({
  name,
  options,
  value,
  defaultValue,
  onValueChange,
  legend,
  hideLegend = false,
  variant = 'tint',
  required = false,
  error,
  className,
}: RadioChipGroupProps) {
  const errorId = useId();
  const controlled = value !== undefined;

  return (
    <fieldset
      className={cn('m-0 border-0 p-0', className)}
      aria-invalid={error !== undefined || undefined}
      aria-describedby={error !== undefined ? errorId : undefined}
      aria-required={required || undefined}
    >
      <legend
        className={cn('mb-3 font-bold uppercase text-label text-muted', hideLegend && 'sr-only')}
      >
        {legend}
      </legend>

      <div className="flex flex-wrap gap-[10px]">
        {options.map((option) => {
          const checked = controlled ? value === option.value : undefined;
          return (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                name={name}
                value={option.value}
                className="peer sr-only"
                {...(controlled
                  ? { checked, onChange: () => onValueChange?.(option.value) }
                  : {
                      defaultChecked: defaultValue === option.value,
                      onChange: () => onValueChange?.(option.value),
                    })}
              />
              <span
                className={chipClass({
                  variant,
                  // Uncontrolled groups paint from `:checked` instead, which is why both the
                  // class and the CSS selector exist here.
                  active: checked ?? false,
                  className: cn(
                    'peer-focus-visible:outline peer-focus-visible:outline-2',
                    'peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
                    variant === 'tint'
                      ? 'peer-checked:border-accent peer-checked:bg-tint peer-checked:text-accent-active'
                      : 'peer-checked:border-dark-alt peer-checked:bg-dark-alt peer-checked:text-dark-on',
                  ),
                })}
              >
                {option.label}
              </span>
            </label>
          );
        })}
      </div>

      {error !== undefined && (
        <p id={errorId} className="mt-2 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
