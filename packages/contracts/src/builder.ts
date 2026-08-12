import { type Currency, money, type Money, multiplyMoney } from './money';

/**
 * The tour builder's price.
 *
 * One implementation, two callers — decision D-11. `GET /builder/config` hands the client the
 * rates, the client runs this on every click so the estimate moves at once, and a debounced
 * `POST /builder/quote` runs the same function on the server for the authoritative number.
 * They cannot disagree, because there is no second implementation to disagree with.
 *
 * When a lead is submitted the server recalculates from the database and ignores whatever the
 * client sent, so this being shared does not make it trusted.
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

/** Steps a quote needs before it stops being a guess. */
export const PRICED_STEPS = ['dest', 'dates', 'hotel', 'activities', 'people'] as const;

/**
 * How a rate is applied.
 *
 * `per_night` multiplies by the number of nights, `per_item` by how many were chosen, `flat`
 * is added once, `none` means the option has no price at all — food, transport and guide are
 * questions for the manager, not line items.
 */
export const MODIFIER_TYPES = ['per_night', 'per_item', 'flat', 'none'] as const;
export type ModifierType = (typeof MODIFIER_TYPES)[number];

export interface BuilderOption {
  /** `hotel_3star`, `nights_7`, `pax_6_10`. ASCII, immutable once referenced — D-10. */
  code: string;
  step: BuilderStep;
  /**
   * What the option *means* as a number: nights for `dates`, people for `people`.
   *
   * Separate from the price on purpose. README §7 puts both in one `price_modifier` column,
   * where `7 дней` becomes a price of seven — the mistake D-10 exists to prevent.
   */
  numericValue: number | null;
  /** Minor units. Only hotel options carry one. */
  priceModifierMinor: number | null;
  modifierType: ModifierType;
}

/**
 * The rates, from `pricing_rules`.
 *
 * Every one of these is editable from the admin without a deploy, which matters because they
 * are the designer's invention and nobody has yet confirmed they are commercially real —
 * question Q-10. The defaults matter as much as the rates: they are what produces the
 * `1 296 $` a visitor sees before touching anything.
 */
export interface PricingRules {
  baseFeeMinor: number;
  cityFeeMinor: number;
  activityFeeMinor: number;
  defaultNights: number;
  defaultHotelRateMinor: number;
  defaultPax: number;
  currency: Currency;
}

export const DEFAULT_PRICING_RULES: PricingRules = {
  /** 180 $ — organisation, transfers, paperwork. */
  baseFeeMinor: 18_000,
  /** 60 $ for each city added. */
  cityFeeMinor: 6_000,
  /** 45 $ for each activity added. */
  activityFeeMinor: 4_500,
  /** Six nights, the length assumed before the visitor says otherwise. */
  defaultNights: 6,
  /** 78 $ a night — the four-star rate. */
  defaultHotelRateMinor: 7_800,
  defaultPax: 2,
  currency: 'USD',
};

export interface BuilderConfig {
  options: readonly BuilderOption[];
  rules: PricingRules;
}

/** What the visitor has chosen, by step code. A multi-step holds an array. */
export type BuilderSelection = Partial<Record<BuilderStep, string | readonly string[]>>;

export type BreakdownKind = 'accommodation' | 'cities' | 'activities' | 'base';

export interface BreakdownLine {
  kind: BreakdownKind;
  /** How many of the thing — nights, cities, activities. One for the base fee. */
  count: number;
  /** The rate each one costs, in minor units. */
  unitMinor: number;
  amountMinor: number;
}

export interface Quote {
  perPerson: Money;
  total: Money;
  pax: number;
  nights: number;
  breakdown: readonly BreakdownLine[];
  /** Priced steps the visitor has not answered yet. */
  missingSteps: readonly BuilderStep[];
  /** True while anything in `missingSteps` is still using a default. */
  isEstimate: boolean;
}

function chosen(selection: BuilderSelection, step: BuilderStep): string[] {
  const value = selection[step];
  if (value === undefined) return [];
  return typeof value === 'string' ? [value] : [...value];
}

function findOption(config: BuilderConfig, code: string | undefined): BuilderOption | undefined {
  if (code === undefined) return undefined;
  return config.options.find((option) => option.code === code);
}

/**
 * Prices a selection.
 *
 * Integer arithmetic throughout, so the same selection produces byte-identical output every
 * time and on both sides of the wire.
 */
export function quote(selection: BuilderSelection, config: BuilderConfig): Quote {
  const { rules } = config;

  const nights =
    findOption(config, chosen(selection, 'dates')[0])?.numericValue ?? rules.defaultNights;
  const pax = findOption(config, chosen(selection, 'people')[0])?.numericValue ?? rules.defaultPax;
  const hotelRate =
    findOption(config, chosen(selection, 'hotel')[0])?.priceModifierMinor ??
    rules.defaultHotelRateMinor;

  const cities = chosen(selection, 'dest').length;
  const activities = chosen(selection, 'activities').length;

  const breakdown: BreakdownLine[] = [
    {
      kind: 'accommodation',
      count: nights,
      unitMinor: hotelRate,
      amountMinor: nights * hotelRate,
    },
    {
      kind: 'cities',
      count: cities,
      unitMinor: rules.cityFeeMinor,
      amountMinor: cities * rules.cityFeeMinor,
    },
    {
      kind: 'activities',
      count: activities,
      unitMinor: rules.activityFeeMinor,
      amountMinor: activities * rules.activityFeeMinor,
    },
    { kind: 'base', count: 1, unitMinor: rules.baseFeeMinor, amountMinor: rules.baseFeeMinor },
  ];

  const perPersonMinor = breakdown.reduce((sum, line) => sum + line.amountMinor, 0);
  const perPerson = money(perPersonMinor, rules.currency);

  const missingSteps = PRICED_STEPS.filter((step) => chosen(selection, step).length === 0);

  return {
    perPerson,
    total: multiplyMoney(perPerson, pax),
    pax,
    nights,
    breakdown,
    missingSteps,
    isEstimate: missingSteps.length > 0,
  };
}
