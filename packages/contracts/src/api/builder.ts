import { z } from 'zod';

import { BUILDER_STEPS, MODIFIER_TYPES } from '../builder';

import { moneySchema } from './common';

/**
 * The tour builder, across the wire.
 *
 * `GET /builder/config` hands over the rates and the options; the client applies the same pure
 * `quote()` from this package on every click so the estimate moves at once, and a debounced
 * `POST /builder/quote` returns the authoritative number. There is no second implementation for
 * them to disagree with — decision D-11.
 *
 * The request carries option *codes* and nothing else. It never carries a price: a number that
 * arrived from a browser is a number the sender chose, and when a lead is submitted the server
 * recalculates from the database and ignores whatever came with it.
 */

export const builderOptionSchema = z.object({
  /** `hotel_3star`, `nights_7`, `pax_6_10`. ASCII, immutable once referenced — D-10. */
  code: z.string(),
  name: z.string(),
  note: z.string(),
  /** What the option *means* as a number. `7 дней` is seven nights, not seven dollars. */
  numericValue: z.number().int().nullable(),
  /** What it *costs*, in minor units. Only hotel options carry one. */
  priceModifierMinor: z.number().int().nullable(),
  modifierType: z.enum(MODIFIER_TYPES),
  /**
   * Cannot be held together with anything else on its step.
   *
   * Only meaningful on a `multi` step, where it is the answer that means the question does not
   * apply — «Без питания». Choosing it clears the others; choosing another clears it.
   */
  isExclusive: z.boolean(),
});

export const builderStepSchema = z.object({
  code: z.enum(BUILDER_STEPS),
  kind: z.enum(['single', 'multi', 'form']),
  title: z.string(),
  hint: z.string(),
  /** Shorter than the heading, for the step rail down the side. */
  railLabel: z.string(),
  isRequired: z.boolean(),
  options: z.array(builderOptionSchema),
});

export const pricingRulesSchema = z.object({
  baseFeeMinor: z.number().int(),
  cityFeeMinor: z.number().int(),
  activityFeeMinor: z.number().int(),
  /** The three defaults matter as much as the rates: they produce the 1 296 $ shown before
   * a visitor has clicked anything at all. Question Q-10. */
  defaultNights: z.number().int(),
  defaultHotelRateMinor: z.number().int(),
  defaultPax: z.number().int(),
  currency: z.enum(['USD', 'TMT']),
});

export const builderConfigResponse = z.object({
  steps: z.array(builderStepSchema),
  rules: pricingRulesSchema,
});

/**
 * A selection: step code to option code, or codes for the three steps that accept several.
 *
 * `.strict()` on the wrapper and a bounded record inside, so an unknown step is a 400 rather
 * than a silently ignored field that makes a quote look right and price something else.
 */
export const builderSelectionSchema = z.record(
  z.enum(BUILDER_STEPS),
  z.union([z.string().max(60), z.array(z.string().max(60)).max(20)]),
);

export const builderQuoteRequest = z
  .object({
    selection: builderSelectionSchema.default({}),
  })
  .strict();

export const breakdownLineSchema = z.object({
  kind: z.enum(['accommodation', 'cities', 'activities', 'base']),
  /** How many nights, cities or activities. One for the base fee. */
  count: z.number().int(),
  unitMinor: z.number().int(),
  amountMinor: z.number().int(),
});

export const builderQuoteResponse = z.object({
  perPerson: moneySchema,
  total: moneySchema,
  pax: z.number().int(),
  nights: z.number().int(),
  breakdown: z.array(breakdownLineSchema),
  /** Priced steps still on their default. What makes the panel say «предварительно». */
  missingSteps: z.array(z.enum(BUILDER_STEPS)),
  isEstimate: z.boolean(),
});

export type BuilderOptionDto = z.infer<typeof builderOptionSchema>;
export type BuilderStepDto = z.infer<typeof builderStepSchema>;
export type BuilderConfigResponse = z.infer<typeof builderConfigResponse>;
export type BuilderQuoteRequest = z.infer<typeof builderQuoteRequest>;
export type BuilderQuoteResponse = z.infer<typeof builderQuoteResponse>;
export type BreakdownLineDto = z.infer<typeof breakdownLineSchema>;
