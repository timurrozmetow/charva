import { BUILDER_DEFAULTS, BUILDER_STEPS, type BuilderStep, type Lang } from '@charva/contracts';
import { asc, eq } from 'drizzle-orm';

import { type Database } from '../../db/client';
import * as t from '../../db/schema';
import { text } from '../../lib/serialize';

/**
 * The builder's nine steps and their options.
 *
 * This file used to be about rates. It loaded all six rows of `pricing_rules`, assembled the
 * option list `quote()` consumes, priced a selection for `POST /builder/quote` and priced it
 * again when a lead arrived. All of that went on 2026-09-11 and the day after, when the owner
 * took pricing off the site and then out of the enquiry: an operator works a selection out and
 * sends the price back.
 *
 * Two rows of `pricing_rules` are still read, and they are the two that are counts rather than
 * commercial terms — what an unanswered step means in nights and in people. That is the same
 * line D-10 drew between `numeric_value` and `price_modifier_minor`, and it is why the panel
 * can still say «Ночей 6» without a rate leaving the building.
 *
 * Nothing here reads a display string. Options are keyed `hotel_3star` and `nights_7`; the
 * prototype keys its table by `«3 ★»` and `«3–5»` — a real star and an en dash — so renaming an
 * option in the admin would have silently repriced every open quote, back when there were any.
 */

/** The two keys still read out of `pricing_rules`. A union, because it is only ever a type. */
type CountKey = 'default_nights' | 'default_pax';

/**
 * What an unanswered step counts as, from `pricing_rules`, falling back per key.
 *
 * Per key rather than all-or-nothing: a missing row is a gap in configuration, and answering
 * with a documented default is better than refusing to draw the panel. The fallbacks are the
 * constants the contracts package ships, so a fresh database and a seeded one agree.
 */
export async function loadDefaults(db: Database): Promise<{
  defaultNights: number;
  defaultPax: number;
}> {
  const rows = await db.select().from(t.pricingRules);
  const byKey = new Map(rows.map((row) => [row.keyName, row.valueMinor]));

  const value = (key: CountKey, fallback: number): number => byKey.get(key) ?? fallback;

  return {
    defaultNights: value('default_nights', BUILDER_DEFAULTS.defaultNights),
    defaultPax: value('default_pax', BUILDER_DEFAULTS.defaultPax),
  };
}

/** A step code from the database, narrowed to the nine contracts knows about. */
function asStep(code: string): BuilderStep | undefined {
  return (BUILDER_STEPS as readonly string[]).includes(code) ? (code as BuilderStep) : undefined;
}

/** The `/builder/config` response: the steps, their options, and no money at all. */
export async function getConfigForDisplay(db: Database, lang: Lang) {
  const [steps, options, defaults] = await Promise.all([
    db.select().from(t.builderSteps).orderBy(asc(t.builderSteps.sortOrder)),
    db
      .select({
        stepId: t.builderOptions.stepId,
        code: t.builderOptions.code,
        name: t.builderOptions.name,
        note: t.builderOptions.note,
        numericValue: t.builderOptions.numericValue,
        isExclusive: t.builderOptions.isExclusive,
        sortOrder: t.builderOptions.sortOrder,
      })
      .from(t.builderOptions)
      .where(eq(t.builderOptions.isPublished, true))
      .orderBy(asc(t.builderOptions.sortOrder)),
    loadDefaults(db),
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
              isExclusive: option.isExclusive,
            })),
        },
      ];
    }),
    defaults,
  };
}
