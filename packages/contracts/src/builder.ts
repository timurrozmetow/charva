/**
 * The tour builder.
 *
 * It used to price. `GET /builder/config` handed the client the rates, the client ran `quote()`
 * on every click so a total moved at once, and a debounced `POST /builder/quote` ran the same
 * function on the server for the authoritative answer — one implementation, two callers, which
 * was decision D-11.
 *
 * The owner removed pricing from the site on 2026-09-11, and from the enquiry the day after: an
 * operator works a selection out and sends a price back. The formula went with it rather than
 * being left switched off, because a rate table with no caller reads to the next person as
 * something the site still does.
 *
 * What made it worth removing rather than fixing is that the rates were never real. They are the
 * designer's invention and question Q-10 has never been answered, so the «1 296 $» a visitor met
 * before clicking anything, and the figure an operator was later handed beside the enquiry, were
 * the same made-up number wearing two different kinds of authority.
 *
 * What survives is the part that describes the trip rather than what it costs: which steps there
 * are, what may be answered more than once, and how many nights and people a selection means.
 */

/** The nine steps, in the order the rail shows them. Stable codes, never display strings. */
export const BUILDER_STEPS = [
  'dest',
  'dates',
  'hotel',
  'food',
  'transport',
  'activities',
  'people',
  'guide',
  'final',
] as const;

export type BuilderStep = (typeof BUILDER_STEPS)[number];

/** Steps that accept more than one answer. */
export const MULTI_STEPS = ['dest', 'food', 'activities'] as const;

/**
 * What an unanswered step counts as.
 *
 * All that is left of `pricing_rules` in code. The six rows it had — a base fee, a city fee, an
 * activity fee, a default hotel rate, a currency and these two — are down to the pair that are
 * counts rather than commercial terms, which is exactly the line D-10 drew when it separated
 * `numeric_value` from `price_modifier_minor`: «7 дней» is seven nights, never seven dollars.
 *
 * Six and two, because the panel says «Ночей 6 · Человек 2» before the visitor reaches those
 * steps and saying nothing there would be worse than saying what is assumed.
 */
export const BUILDER_DEFAULTS = {
  defaultNights: 6,
  defaultPax: 2,
} as const;

/**
 * What the visitor has chosen: a step code to one option code, or to several on a `multi` step.
 *
 * `readonly string[]`, because nothing downstream should edit a selection in place — it is the
 * thing that goes in the URL (D-58) and into the enquiry, and both want it as it was made.
 */
export type BuilderSelection = Partial<Record<BuilderStep, string | readonly string[]>>;

function chosen(selection: BuilderSelection, step: BuilderStep): string[] {
  const value = selection[step];
  if (value === undefined) return [];
  return typeof value === 'string' ? [value] : [...value];
}

/**
 * How many nights and how many people a selection means.
 *
 * The one thing the panel still computes. It takes a code and what that code counts as, and
 * deliberately not a `BuilderOption` with a rate on it — there is no such type any more, and
 * asking for one would have meant the browser needing a field the server no longer sends.
 */
export function selectionCounts(
  selection: BuilderSelection,
  options: readonly { code: string; numericValue: number | null }[],
  defaults: { defaultNights: number; defaultPax: number } = BUILDER_DEFAULTS,
): { nights: number; pax: number } {
  const value = (step: BuilderStep, fallback: number) => {
    const code = chosen(selection, step)[0];
    if (code === undefined) return fallback;
    return options.find((option) => option.code === code)?.numericValue ?? fallback;
  };

  return {
    nights: value('dates', defaults.defaultNights),
    pax: value('people', defaults.defaultPax),
  };
}
