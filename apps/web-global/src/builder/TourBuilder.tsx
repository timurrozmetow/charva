import {
  type BuilderOption,
  type BuilderStep,
  type Lang,
  quote as priceQuote,
} from '@charva/contracts';
import { Skeleton } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { builderConfigQuery, postQuote } from '../api/queries';

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
 * The price comes from `quote()` in `@charva/contracts`, run locally on every click. The
 * debounced `POST /builder/quote` that follows is the authority, and its answer is asserted
 * against the local one rather than displayed instead of it: they are the same function, so a
 * difference is a bug worth knowing about rather than a number to quietly prefer.
 */
export function TourBuilder({ lang, basePath, renderForm }: TourBuilderProps) {
  const config = useQuery(builderConfigQuery(lang));
  const { selection, step, pick, goToStep, answered } = useBuilderSelection(basePath);
  const [confirming, setConfirming] = useState(false);

  /** The flat option list `quote()` wants, derived from the step tree the API sends. */
  const pricingConfig = useMemo(() => {
    const steps = config.data?.steps ?? [];
    const options: BuilderOption[] = steps.flatMap((s) =>
      s.options.map((option) => ({
        code: option.code,
        step: s.code,
        numericValue: option.numericValue,
        priceModifierMinor: option.priceModifierMinor,
        modifierType: option.modifierType,
      })),
    );
    return { options, rules: config.data?.rules };
  }, [config.data]);

  const estimate = useMemo(() => {
    if (pricingConfig.rules === undefined) return null;
    return priceQuote(selection, { options: pricingConfig.options, rules: pricingConfig.rules });
  }, [selection, pricingConfig]);

  /*
   * The authoritative recalculation, debounced.
   *
   * It confirms rather than produces: the panel already shows the right number, because both
   * sides run the same function over the same rates. What this catches is the case that matters
   * — an editor changing a rate in the admin while somebody has the builder open — and a
   * mismatch is logged rather than swallowed, because under D-11 it should be impossible.
   */
  const abortRef = useRef<AbortController>();
  useEffect(() => {
    if (estimate === null) return;

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setConfirming(true);

      postQuote(lang, { selection }, controller.signal)
        .then((authoritative) => {
          if (authoritative.total.minor !== estimate.total.minor) {
            // function has stopped being shared, which is exactly what D-11 rules out.
            console.warn('builder: local estimate disagrees with the server', {
              local: estimate.total.minor,
              server: authoritative.total.minor,
            });
          }
        })
        .catch(() => {
          // A failed confirmation leaves the local estimate standing. It is the same arithmetic
          // over the same rates, and a visitor with a flaky connection should still see a price.
        })
        .finally(() => {
          setConfirming(false);
        });
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [selection, estimate, lang]);

  if (config.isPending || estimate === null || config.data === undefined) {
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

  return (
    <div className="grid grid-cols-builder items-start gap-[30px] lap:grid-cols-[200px_1fr_280px] tab:grid-cols-1">
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

      <BuilderEstimate
        lang={lang}
        quote={estimate}
        config={config.data}
        selection={selection}
        confirming={confirming}
      />
    </div>
  );
}
