import { type BuilderStepDto, type Lang } from '@charva/contracts';
import { Button, Heading } from '@charva/ui';
import { type ReactNode } from 'react';

import { copyFor, fill } from '../i18n';

export interface BuilderPanelProps {
  lang: Lang;
  step: BuilderStepDto;
  stepNumber: number;
  totalSteps: number;
  isChosen: (code: string) => boolean;
  onPick: (code: string) => void;
  onBack: () => void;
  onNext: () => void;
  answered: number;
  answerableCount: number;
  /** The ninth step is a form rather than a grid of options. */
  form?: ReactNode;
}

/**
 * Two columns from 1279 down, not three.
 *
 * This panel is the middle column of a three-column grid, so it is narrower than the page by
 * the rail and the estimate beside it — and both of those shrink later than it does. At 1280
 * the panel is around 630px and three cards fit as drawn. At 1024 the outer grid has already
 * dropped to `200px 1fr 280px`, which leaves the panel 364: take off its own padding and two
 * gaps and each card is 89 wide, of which 49 is text. «Экскурсии по городу» and «Внутренний
 * перелёт» broke into three and four lines, and the panel — which has a `min-h` and six options
 * on every step — grew past it.
 *
 * The breakpoint is the outer grid's, because that is what actually moves: the cards are fine
 * at any width the panel has three columns' worth of room for.
 */
const OPTIONS_GRID = 'grid flex-1 auto-rows-min grid-cols-3 gap-3 lap:grid-cols-2 mob:grid-cols-1';

/**
 * The panel: one step's question and its answers.
 *
 * The options are `role="radio"` or checkboxes depending on the step's kind, inside a named
 * group. The prototype draws them as divs with click handlers and no state at all in the
 * accessibility tree, so a screen-reader user cannot tell which of six is chosen — on nine
 * consecutive screens.
 *
 * A multi-select step really is a set of checkboxes and a single-select really is a radio
 * group; using the right one means the arrow keys, the space bar and the announcements all work
 * without any of it being written here.
 */
export function BuilderPanel({
  lang,
  step,
  stepNumber,
  totalSteps,
  isChosen,
  onPick,
  onBack,
  onNext,
  answered,
  answerableCount,
  form,
}: BuilderPanelProps) {
  const copy = copyFor(lang);
  const multi = step.kind === 'multi';
  const isForm = step.kind === 'form';
  const groupId = `builder-step-${step.code}`;

  return (
    <section
      aria-labelledby={`${groupId}-title`}
      className="flex min-h-[540px] flex-col rounded-panel bg-cream-fill p-9 pb-[30px] mob:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-eyebrow font-bold uppercase text-accent">
          {fill(copy.builder.stepOf, { step: stepNumber, total: totalSteps })}
        </p>
        {!isForm && (
          <p className="text-bodySm text-cream-muted">
            {multi ? copy.builder.hintMulti : copy.builder.hintSingle}
          </p>
        )}
      </div>

      {/* No colour class: the panel only ever renders inside `<Section tone="dark">`, where
          `--c-ink` is already the cream. `text-dark-on` here joined the heading's own
          `text-ink` rather than replacing it and lost to it — it happened to look right
          because the value it lost to was the same colour. */}
      <Heading id={`${groupId}-title`} level={2} size="h3" className="mb-[26px] mt-1.5">
        {step.title}
      </Heading>

      {isForm ? (
        <div className="flex-1">{form}</div>
      ) : (
        <div
          role={multi ? 'group' : 'radiogroup'}
          aria-labelledby={`${groupId}-title`}
          className={OPTIONS_GRID}
        >
          {step.options.map((option) => {
            const on = isChosen(option.code);
            return (
              <button
                key={option.code}
                type="button"
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={on}
                onClick={() => {
                  onPick(option.code);
                }}
                className={[
                  'flex flex-col gap-1.5 rounded-media border p-5 text-left',
                  // The named three are all that ever change here; `transition-all` also put
                  // the panel's own layout on the transition list for nothing. And this is a
                  // chip in everything but name — the press belongs on it for the same reason.
                  'transition-[color,background-color,border-color,transform] duration-press ease-press',
                  'active:scale-[0.98]',
                  on
                    ? 'border-accent bg-tint-strong text-accent'
                    : 'border-line bg-cream-fill text-dark-on hover:border-tint-line',
                ].join(' ')}
              >
                <span className="text-body font-bold">{option.name}</span>
                {option.note !== '' && (
                  <span
                    className={
                      on
                        ? 'text-bodySm font-light text-accent'
                        : 'text-bodySm font-light text-cream-muted'
                    }
                  >
                    {option.note}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <Button variant="ghost" onClick={onBack} disabled={stepNumber === 1}>
          <span aria-hidden="true">←</span> {copy.builder.back}
        </Button>

        {/* Eight, not nine: the form is not a question, and the prototype counts the same way. */}
        <p aria-live="polite" className="text-bodySm text-cream-muted">
          {fill(copy.builder.filled, { filled: answered, total: answerableCount })}
        </p>

        {stepNumber < totalSteps && <Button onClick={onNext}>{copy.builder.next}</Button>}
      </div>
    </section>
  );
}
