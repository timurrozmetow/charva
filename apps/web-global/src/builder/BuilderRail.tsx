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
 * The tick is an icon rather than the literal `✓` the prototype types: Golos has no such glyph
 * and the browser substitutes a system font, so the mark looks different on every platform
 * (D-26).
 */
export function BuilderRail({ lang, steps, current, answered, onSelect }: BuilderRailProps) {
  const copy = copyFor(lang);
  const labels: Record<string, string> = copy.builder.steps;

  return (
    <nav aria-label={copy.builder.railLabel}>
      {/*
        Below 1024 the rail lies down and becomes a progress strip.

        Nine labelled rows are 487px tall, and the grid is a single column at that width, so on
        a 360px phone the first question began at y=1375 — measured, not guessed: nearly two
        screens of step names before the thing the visitor came to do. A tablet at 820 was no
        better, which is why this is `tab:` and not `mob:`.

        The names are not lost, they are `sr-only`: the panel beside this already says «Шаг 1 из
        9 — Куда хотите поехать?», so on a narrow screen the rail's job is how far along you are
        and how to jump, and that is what a numbered strip says. A screen reader still hears
        every name, because the strip is the same nine buttons.
      */}
      <ol
        className={[
          'flex list-none flex-col gap-0.5 rounded-panel border border-line bg-cream-fill p-3.5',
          'tab:flex-row tab:gap-2 tab:overflow-x-auto tab:p-2',
        ].join(' ')}
      >
        {steps.map((step, index) => {
          const active = index === current;
          const done = answered(step.code) && !active;

          return (
            <li key={step.code} className="tab:shrink-0">
              <button
                type="button"
                onClick={() => {
                  onSelect(index);
                }}
                aria-current={active ? 'step' : undefined}
                className={[
                  'flex w-full items-center gap-3 rounded-sm px-3.5 py-3 text-left text-chip font-semibold',
                  // 25px circle plus ten each side is a 45px target, which is what the strip
                  // is once the name stops taking width.
                  'tab:w-auto tab:gap-0 tab:rounded-full tab:p-2.5',
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
                <span className="tab:sr-only">{labels[step.code] ?? step.railLabel}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
