import {
  type BuilderConfigResponse,
  type BuilderSelection,
  type Lang,
  type BuilderStep,
  selectionCounts,
} from '@charva/contracts';

import { copyFor } from '../i18n';

export interface BuilderEstimateProps {
  lang: Lang;
  config: BuilderConfigResponse;
  selection: BuilderSelection;
}

/**
 * The summary panel: what has been chosen, and who works out what it costs.
 *
 * It used to carry a live total. The owner decided on 2026-09-11 that the site does not quote —
 * an operator prices the selection and sends it back — and the figure was worth losing on its
 * own merits: the rates behind it are the designer's invention that Q-10 never confirmed, so the
 * «1 296 $» a visitor met before touching anything was a made-up number wearing the authority of
 * a total. It is gone from the wire as well as from here (the config response carries no rates
 * and there is no quote route any more), which is the same reasoning as D-12: a price that is
 * not in a response schema cannot come back by accident.
 *
 * Nights and people stay, because they are counts rather than terms — they are what the visitor
 * said about the trip, and the operator needs them read back.
 *
 * An unanswered step shows «—» rather than the default it is silently using. The default is real
 * — six nights, two people, until those steps are reached — but presenting it as a choice they
 * made would be a lie.
 */
export function BuilderEstimate({ lang, config, selection }: BuilderEstimateProps) {
  const copy = copyFor(lang);
  const labels: Record<string, string> = copy.builder.steps;

  const counts = selectionCounts(
    selection,
    config.steps.flatMap((step) => step.options),
    config.defaults,
  );

  /** Whether the visitor has answered a step at all — as opposed to the form using a default. */
  const answered = (step: BuilderStep): boolean => {
    const chosen = selection[step];
    if (chosen === undefined) return false;
    return typeof chosen === 'string' ? chosen !== '' : chosen.length > 0;
  };

  const nameOf = (code: string) =>
    config.steps.flatMap((step) => step.options).find((option) => option.code === code)?.name ??
    code;

  const rows = config.steps
    .filter((step) => step.kind !== 'form')
    .map((step) => {
      const chosen = selection[step.code];
      const codes = chosen === undefined ? [] : typeof chosen === 'string' ? [chosen] : [...chosen];
      return {
        code: step.code,
        label: labels[step.code] ?? step.railLabel,
        value: codes.length === 0 ? null : codes.map(nameOf).join(', '),
      };
    });

  return (
    <aside
      aria-label={copy.builder.estimate.title}
      className="sticky top-[110px] rounded-panel bg-bg p-[30px_28px] text-ink tab:static"
    >
      <h3 className="text-cardTitle font-medium">{copy.builder.estimate.title}</h3>

      <dl className="mt-5">
        {rows.map((row) => (
          <div
            key={row.code}
            className="flex items-start justify-between gap-4 border-b border-line py-[11px]"
          >
            <dt className="text-bodySm text-muted">{row.label}</dt>
            <dd
              className={
                row.value === null ? 'text-bodySm text-muted' : 'text-bodySm text-right text-ink'
              }
            >
              {row.value ?? copy.builder.estimate.empty}
            </dd>
          </div>
        ))}

        {/*
          Nights and people, and «—» until they have been chosen.

          They used to print the fallback — six nights and two people — on an untouched form,
          two lines below the same two questions answered «—». The paragraph above this function
          says an unanswered step must not present its default as a choice the visitor made; the
          rows below it did exactly that, because `selectionCounts` returns a number either way
          and nothing here asked which kind of number it was.

          The fallback is still real and still used by whoever prices the trip. It is simply not
          something to show a person as though they had said it.
        */}
        <div className="flex items-center justify-between gap-4 border-b border-line py-[11px]">
          <dt className="text-bodySm text-muted">{copy.builder.estimate.nights}</dt>
          <dd className={answered('dates') ? 'text-bodySm text-ink' : 'text-bodySm text-muted'}>
            {answered('dates') ? counts.nights : copy.builder.estimate.empty}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-[11px]">
          <dt className="text-bodySm text-muted">{copy.builder.estimate.pax}</dt>
          <dd className={answered('people') ? 'text-bodySm text-ink' : 'text-bodySm text-muted'}>
            {answered('people') ? counts.pax : copy.builder.estimate.empty}
          </dd>
        </div>
      </dl>

      <p className="mt-5 text-bodySm font-light text-muted">{copy.builder.estimate.priceNote}</p>
    </aside>
  );
}
