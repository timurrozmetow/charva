import {
  type BuilderConfigResponse,
  type BuilderSelection,
  formatMoney,
  type Lang,
  type Quote,
} from '@charva/contracts';

import { copyFor } from '../i18n';

export interface BuilderEstimateProps {
  lang: Lang;
  quote: Quote;
  config: BuilderConfigResponse;
  selection: BuilderSelection;
  /** True while the debounced confirmation is in flight. The number does not move; it settles. */
  confirming: boolean;
}

/**
 * The estimate panel.
 *
 * The number in it is produced by `quote()` from `@charva/contracts` — the same pure function
 * the server runs — so it moves the instant an option is clicked rather than after a round
 * trip, and it cannot disagree with the authoritative answer because there is no second
 * implementation to disagree with (D-11).
 *
 * An unanswered step shows «—» rather than the default it is silently using. The default is
 * real — six nights at the four-star rate is what produces the 1 296 $ a visitor sees before
 * touching anything — but presenting it as a choice they made would be a lie, so the line is
 * blank and the note under the total says the figure is provisional.
 */
export function BuilderEstimate({
  lang,
  quote,
  config,
  selection,
  confirming,
}: BuilderEstimateProps) {
  const copy = copyFor(lang);
  const labels: Record<string, string> = copy.builder.steps;

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

        <div className="flex items-center justify-between gap-4 border-b border-line py-[11px]">
          <dt className="text-bodySm text-muted">{copy.builder.estimate.nights}</dt>
          <dd className="text-bodySm text-ink">{quote.nights}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-line py-[11px]">
          <dt className="text-bodySm text-muted">{copy.builder.estimate.pax}</dt>
          <dd className="text-bodySm text-ink">{quote.pax}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-[11px]">
          <dt className="text-bodySm text-muted">{copy.builder.estimate.perPerson}</dt>
          <dd className="text-bodySm text-ink">{formatMoney(quote.perPerson)}</dd>
        </div>
      </dl>

      <p className="mt-4 text-bodySm text-muted">{copy.builder.estimate.total}</p>
      <p
        // Announced on change, so a screen-reader user hears the new total after choosing an
        // option instead of having to go looking for it.
        aria-live="polite"
        aria-busy={confirming}
        className="text-h2Sm font-medium text-ink"
      >
        {formatMoney(quote.total)}
      </p>

      <p className="mt-4 text-bodySm font-light text-muted">
        {quote.isEstimate ? copy.builder.estimate.estimateNote : copy.builder.estimate.finalNote}
      </p>
    </aside>
  );
}
