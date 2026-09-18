import { type BuilderStep, type Lang } from '@charva/contracts';
import { Skeleton } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode } from 'react';

import { builderConfigQuery } from '../api/queries';

import { BuilderEstimate } from './BuilderEstimate';
import { BuilderPanel } from './BuilderPanel';
import { BuilderRail } from './BuilderRail';
import { ANSWERABLE_STEPS, useBuilderSelection } from './useBuilderSelection';

export interface TourBuilderProps {
  lang: Lang;
  /** Where the URL state is written. `/ru/builder` on its own page, `/ru` when embedded. */
  basePath: string;
  /** The ninth step's form, supplied by whoever mounts the builder. */
  renderForm?: (context: {
    selection: ReturnType<typeof useBuilderSelection>['selection'];
  }) => ReactNode;
}

/**
 * The whole machine.
 *
 * One component, mounted twice: on `/builder` and embedded in the homepage's dark section. The
 * prototype has two copies that have already drifted — the homepage's panel is 520px instead of
 * 540, its heading renders at weight 400 because of a duplicated property, its button text is a
 * different brown, and the last option of step two says something else. Every one of those is a
 * divergence nobody chose.
 *
 * It used to price itself: `quote()` locally on every click, confirmed by a debounced
 * `POST /builder/quote`. Both are gone — the owner decided on 2026-09-11 that the site does not
 * quote, and an operator prices the selection instead. What is left is nine questions and a
 * panel that reads the answers back, which is the part that was ever doing any work: the total
 * came from rates the designer invented and Q-10 never confirmed.
 *
 * The consolation is that a click is now free. Every answer used to schedule a round trip to
 * confirm a figure nobody is shown.
 */
export function TourBuilder({ lang, basePath, renderForm }: TourBuilderProps) {
  const config = useQuery(builderConfigQuery(lang));
  const { selection, step, pick, goToStep, answered } = useBuilderSelection(basePath);

  if (config.isPending || config.data === undefined) {
    return (
      <div className="grid grid-cols-builder gap-[30px] tab:grid-cols-1" aria-busy="true">
        <Skeleton className="h-[420px] rounded-panel" />
        <Skeleton className="h-[540px] rounded-panel" />
        <Skeleton className="h-[420px] rounded-panel" />
      </div>
    );
  }

  const steps = config.data.steps;
  const currentStep = steps[step] ?? steps[0];
  if (currentStep === undefined) return null;

  const exclusiveCodes = new Set(
    currentStep.options.filter((option) => option.isExclusive).map((option) => option.code),
  );

  const isChosen = (code: string) => {
    const chosen = selection[currentStep.code];
    if (chosen === undefined) return false;
    return typeof chosen === 'string' ? chosen === code : chosen.includes(code);
  };

  /*
   * No `items-start` on the grid below, and that is only half of what the summary needed.
   *
   * `position: sticky` travels inside its containing block, which for a grid child is its grid
   * area. `items-start` made the area content-height, so there was nowhere to travel — that much
   * was right. Removing it did not fix the panel though, and an external audit caught it: the
   * panel *is* the grid item, and a grid item stretches to the row, so it became exactly as tall
   * as its area and stayed inert. Measured, not argued: 890px tall in an 890px row.
   *
   * The half that was missing is `self-start` on the panel itself (see `BuilderEstimate`), which
   * stops the stretch while leaving the area full height. Same shape on the tour and hotel pages,
   * where the price panel had the same two-line story.
   *
   * A comment, not a JSX comment: `{/* … *\/}` as the first thing inside `return (` is a parse
   * error, because there is no element yet for it to belong to.
   */
  return (
    <div className="grid grid-cols-builder gap-[30px] lap:grid-cols-[200px_1fr_280px] tab:grid-cols-1">
      <BuilderRail
        lang={lang}
        steps={steps}
        current={step}
        answered={(code) => selection[code as BuilderStep] !== undefined}
        onSelect={goToStep}
      />

      <BuilderPanel
        lang={lang}
        step={currentStep}
        stepNumber={step + 1}
        totalSteps={steps.length}
        isChosen={isChosen}
        onPick={(code) => {
          // Which of this step's answers stand alone comes from the configuration, so a
          // seventh exclusive option needs a row in the admin rather than a deploy.
          pick(currentStep.code, code, exclusiveCodes);
        }}
        onBack={() => {
          goToStep(step - 1);
        }}
        onNext={() => {
          goToStep(step + 1);
        }}
        answered={answered}
        answerableCount={ANSWERABLE_STEPS.length}
        {...(renderForm === undefined ? {} : { form: renderForm({ selection }) })}
      />

      <BuilderEstimate lang={lang} config={config.data} selection={selection} />
    </div>
  );
}
