import {
  type BuilderConfig,
  type BuilderOption,
  type BuilderSelection,
  BUILDER_STEPS,
  type BuilderStep,
  type Currency,
  DEFAULT_PRICING_RULES,
  type Lang,
  type PricingRules,
  quote,
} from '@charva/contracts';
import { asc, eq } from 'drizzle-orm';

import { type Database } from '../../db/client';
import * as t from '../../db/schema';
import { text } from '../../lib/serialize';

/**
 * The builder's rates, and the one function that turns them into a price.
 *
 * `quote()` is imported from `@charva/contracts` rather than written here, and the browser
 * imports the identical function. That is decision D-11 and it is the whole reason the client
 * may compute an estimate at all: it does not have a second implementation to disagree with.
 * The instant estimate and the authoritative answer differ only in *when* they run.
 *
 * Nothing here reads a display string. The rates are keyed by `hotel_3star` and `nights_7`;
 * the prototype keys its table by `«3 ★»` and `«3–5»` — with a real star and an en dash — so
 * renaming an option in the admin would silently reprice every open quote (D-10).
 */

/** The keys `pricing_rules` is expected to hold. A union, because it is only ever a type. */
type RuleKey =
  | 'base_fee'
  | 'city_fee'
  | 'activity_fee'
  | 'default_nights'
  | 'default_hotel_rate'
  | 'default_pax';

/**
 * Loads the rates from `pricing_rules`, falling back per key.
 *
 * Per key rather than all-or-nothing: a missing row is a gap in configuration, and answering
 * with a documented default is better than either refusing to price anything or quietly
 * treating the fee as zero. The defaults are the same constants the contracts package ships,
 * so a fresh database and a seeded one produce the same 1 296 $.
 */
export async function loadRules(db: Database, currency: Currency = 'USD'): Promise<PricingRules> {
  const rows = await db.select().from(t.pricingRules);
  const byKey = new Map(rows.map((row) => [row.keyName, row.valueMinor]));

  const value = (key: RuleKey, fallback: number): number => byKey.get(key) ?? fallback;

  return {
    baseFeeMinor: value('base_fee', DEFAULT_PRICING_RULES.baseFeeMinor),
    cityFeeMinor: value('city_fee', DEFAULT_PRICING_RULES.cityFeeMinor),
    activityFeeMinor: value('activity_fee', DEFAULT_PRICING_RULES.activityFeeMinor),
    defaultNights: value('default_nights', DEFAULT_PRICING_RULES.defaultNights),
    defaultHotelRateMinor: value('default_hotel_rate', DEFAULT_PRICING_RULES.defaultHotelRateMinor),
    defaultPax: value('default_pax', DEFAULT_PRICING_RULES.defaultPax),
    currency,
  };
}

/** A step code from the database, narrowed to the nine contracts knows about. */
function asStep(code: string): BuilderStep | undefined {
  return (BUILDER_STEPS as readonly string[]).includes(code) ? (code as BuilderStep) : undefined;
}

/**
 * Every option, with the step it belongs to.
 *
 * This is what `quote()` consumes, and it is loaded for pricing as well as for the config
 * endpoint — the server never trusts the option list a client says it used.
 */
export async function loadOptions(db: Database): Promise<BuilderOption[]> {
  const rows = await db
    .select({
      code: t.builderOptions.code,
      stepCode: t.builderSteps.code,
      numericValue: t.builderOptions.numericValue,
      priceModifierMinor: t.builderOptions.priceModifierMinor,
      modifierType: t.builderOptions.modifierType,
    })
    .from(t.builderOptions)
    .innerJoin(t.builderSteps, eq(t.builderSteps.id, t.builderOptions.stepId))
    .where(eq(t.builderOptions.isPublished, true));

  return rows.flatMap((row) => {
    const step = asStep(row.stepCode);
    // A step code the contracts package does not know is a schema drift, not a runtime choice:
    // dropping the option is the safe half of that, and the pricing test would notice.
    if (step === undefined) return [];
    return [
      {
        code: row.code,
        step,
        numericValue: row.numericValue,
        priceModifierMinor: row.priceModifierMinor,
        modifierType: row.modifierType,
      },
    ];
  });
}

export async function loadConfig(db: Database, currency: Currency = 'USD'): Promise<BuilderConfig> {
  const [options, rules] = await Promise.all([loadOptions(db), loadRules(db, currency)]);
  return { options, rules };
}

/** The `/builder/config` response: the same data, plus everything needed to draw the steps. */
export async function getConfigForDisplay(db: Database, lang: Lang) {
  const [steps, options, rules] = await Promise.all([
    db.select().from(t.builderSteps).orderBy(asc(t.builderSteps.sortOrder)),
    db
      .select({
        stepId: t.builderOptions.stepId,
        code: t.builderOptions.code,
        name: t.builderOptions.name,
        note: t.builderOptions.note,
        numericValue: t.builderOptions.numericValue,
        priceModifierMinor: t.builderOptions.priceModifierMinor,
        modifierType: t.builderOptions.modifierType,
        sortOrder: t.builderOptions.sortOrder,
      })
      .from(t.builderOptions)
      .where(eq(t.builderOptions.isPublished, true))
      .orderBy(asc(t.builderOptions.sortOrder)),
    loadRules(db),
  ]);

  return {
    steps: steps.flatMap((step) => {
      const code = asStep(step.code);
      if (code === undefined) return [];
      return [
        {
          code,
          kind: step.kind,
          title: text(step.title, lang),
          hint: text(step.hint, lang),
          railLabel: text(step.railLabel, lang),
          isRequired: step.isRequired,
          options: options
            .filter((option) => option.stepId === step.id)
            .map((option) => ({
              code: option.code,
              name: text(option.name, lang),
              note: text(option.note, lang),
              numericValue: option.numericValue,
              priceModifierMinor: option.priceModifierMinor,
              modifierType: option.modifierType,
            })),
        },
      ];
    }),
    rules,
  };
}

/**
 * The authoritative price.
 *
 * Called by `POST /builder/quote` and, separately, when a lead is submitted — at which point the
 * result is stored in `leads.quote_snapshot` and whatever the browser sent is ignored. A lead is
 * a commercial commitment; a number that arrived from a client is a number the sender chose.
 */
export async function priceSelection(db: Database, selection: BuilderSelection) {
  const result = quote(selection, await loadConfig(db));

  // `Quote` holds readonly arrays, because nothing downstream of the formula should edit a
  // priced breakdown. The wire shape is plain JSON, so they are copied rather than cast.
  return {
    ...result,
    breakdown: [...result.breakdown],
    missingSteps: [...result.missingSteps],
  };
}
