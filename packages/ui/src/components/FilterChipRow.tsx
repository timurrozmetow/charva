import { type ReactNode } from 'react';

import { cn } from '../cn';

import { Chip, type ChipVariant } from './Chip';

export interface FilterOption {
  /**
   * The stable code this filter is keyed by — `desert`, `jidda`, `3star`.
   *
   * Never the visible label: the label is translated and the filter would change meaning
   * between languages. Same rule as the builder's option codes, decision D-10.
   */
  value: string;
  label: ReactNode;
  /** How many rows match. Absent hides the number rather than showing a zero. */
  count?: number;
}

export interface FilterChipRowProps {
  /** Names the group for assistive technology — «Фильтр по теме». */
  label: string;
  options: readonly FilterOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** The «Показано 9 из 32» line at the far end. */
  counter?: ReactNode;
  variant?: ChipVariant;
  className?: string;
}

/**
 * A single-select filter row.
 *
 * Buttons with `aria-pressed`, inside a named group. Not tabs: the thing below is a filtered
 * grid, not a set of panels, and calling it a tablist promises arrow-key semantics that would
 * then have to be built and would surprise anyone who tried them.
 *
 * The options are always passed in from the data — `SELECT DISTINCT` over published rows,
 * decision D-15. That is what structurally fixes the missing «Jidda» chip: the city is in the
 * ziyarat data and the hardcoded chip list in the prototype forgot it, so one of the four
 * cities is unreachable on the live page.
 */
export function FilterChipRow({
  label,
  options,
  value,
  onValueChange,
  counter,
  variant = 'solid',
  className,
}: FilterChipRowProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-8 tab:flex-col tab:items-start tab:gap-4',
        className,
      )}
    >
      <div role="group" aria-label={label} className="flex flex-wrap gap-[10px]">
        {options.map((option) => (
          <Chip
            key={option.value}
            variant={variant}
            active={option.value === value}
            count={option.count}
            onClick={() => {
              onValueChange(option.value);
            }}
          >
            {option.label}
          </Chip>
        ))}
      </div>

      {counter !== undefined && (
        // Polite rather than assertive: the count changes on every chip press, and it is
        // confirmation of what the user just did, not an interruption.
        <p aria-live="polite" className="shrink-0 text-bodySm font-light text-muted">
          {counter}
        </p>
      )}
    </div>
  );
}
