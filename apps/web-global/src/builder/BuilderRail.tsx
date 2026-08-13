import { type BuilderStepDto, type Lang } from '@charva/contracts';
import { Icon } from '@charva/ui';

import { copyFor } from '../i18n';

export interface BuilderRailProps {
  lang: Lang;
  steps: readonly BuilderStepDto[];
  current: number;
  answered: (code: string) => boolean;
  onSelect: (index: number) => void;
}

/**
 * The step rail.
 *
 * Every step is reachable at any time and always has been — the prototype allows it too, and
 * that is the right call for a form nobody is obliged to finish: a visitor who only wants to
 * know what a fourteen-day trip costs should be able to answer step two and read the estimate.
 *
 * Buttons in a list, not `<div onClick>`. The prototype's rows are divs with click handlers, so
 * none of the nine is reachable by keyboard at all — on the page the design calls its key
 * feature.
 *
 * The tick is an icon rather than the literal `✓` the prototype types: Stolzl has no such glyph
 * and the browser substitutes a system font, so the mark looks different on every platform
 * (D-26).
 */
export function BuilderRail({ lang, steps, current, answered, onSelect }: BuilderRailProps) {
  const copy = copyFor(lang);
  const labels: Record<string, string> = copy.builder.steps;

  return (
    <nav aria-label={copy.builder.railLabel}>
      <ol className="flex list-none flex-col gap-0.5 rounded-panel border border-line bg-cream-fill p-3.5">
        {steps.map((step, index) => {
          const active = index === current;
          const done = answered(step.code) && !active;

          return (
            <li key={step.code}>
              <button
                type="button"
                onClick={() => {
                  onSelect(index);
                }}
                aria-current={active ? 'step' : undefined}
                className={[
                  'flex w-full items-center gap-3 rounded-sm px-3.5 py-3 text-left text-chip font-semibold',
                  'transition-colors duration-option',
                  active ? 'bg-tint-strong text-dark-on' : 'text-cream-muted hover:bg-cream-fill',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'flex size-[25px] shrink-0 items-center justify-center rounded-full text-label font-black',
                    active
                      ? 'bg-accent text-accent-on'
                      : done
                        ? 'bg-tint text-accent'
                        : 'bg-cream-fill text-cream-muted',
                  ].join(' ')}
                >
                  {done ? <Icon name="check" size={12} /> : index + 1}
                </span>
                {labels[step.code] ?? step.railLabel}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
