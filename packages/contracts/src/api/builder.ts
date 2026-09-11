import { z } from 'zod';

import { BUILDER_STEPS } from '../builder';

/**
 * The tour builder, across the wire.
 *
 * **No money crosses it.** The owner decided on 2026-09-11 that the site does not quote: an
 * operator works the selection out and sends a price back. The rates it would have quoted from
 * are the designer's invention and were never confirmed (Q-10) — the «1 296 $» a visitor met
 * before clicking anything was a made-up number wearing the authority of a total.
 *
 * So this is structural rather than a hidden element, for the same reason D-12 is: a response
 * schema is also the serialiser, and a field that is not in it cannot be added back by a careless
 * `select *`. `GET /builder/config` hands over the options and two counts — how many nights and
 * how many people an unanswered step means — and nothing that could be turned into a price.
 * `POST /builder/quote` is gone with it; it existed to confirm a number nobody is shown.
 *
 * The pure `quote()` in this package stays, and the server still runs it when a lead arrives, so
 * the operator opens an enquiry with the system's own arithmetic beside the selection. That is
 * the one place a figure is still useful, and it is not a place a visitor can reach.
 *
 * The request carries option *codes* and nothing else — the reason D-10 made them stable ASCII.
 */

export const builderOptionSchema = z.object({
  /** `hotel_3star`, `nights_7`, `pax_6_10`. ASCII, immutable once referenced — D-10. */
  code: z.string(),
  name: z.string(),
  note: z.string(),
  /**
   * What the option *means* as a number. `7 дней` is seven nights, not seven dollars.
   *
   * This survives where `priceModifierMinor` does not, and the difference is the whole of D-10:
   * a count is a fact about the trip and a rate is a commercial term. The panel still says «7»
   * beside «Ночей» because that is what the visitor chose, not what it costs.
   */
  numericValue: z.number().int().nullable(),
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

/**
 * What an unanswered step counts as — and nothing else.
 *
 * This is the public remnant of `pricing_rules`. The rates went with the quote: a base fee, a
 * city fee, an activity fee, a default hotel rate and a currency are commercial terms, and a
 * site that does not quote has no business shipping them to every browser that opens the
 * builder. These two are counts, and the panel needs them to say «Ночей 6» before the visitor
 * has reached that step.
 */
export const builderDefaultsSchema = z.object({
  defaultNights: z.number().int(),
  defaultPax: z.number().int(),
});

export const builderConfigResponse = z.object({
  steps: z.array(builderStepSchema),
  defaults: builderDefaultsSchema,
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

export type BuilderOptionDto = z.infer<typeof builderOptionSchema>;
export type BuilderStepDto = z.infer<typeof builderStepSchema>;
export type BuilderConfigResponse = z.infer<typeof builderConfigResponse>;
export type BuilderDefaults = z.infer<typeof builderDefaultsSchema>;
