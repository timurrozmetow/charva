import {
  bigint,
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/mysql-core';

import { type LocalizedColumn } from './shared';

/**
 * The tour builder's nine steps, their options and the rates.
 *
 * All three are editable from the admin without a deploy, which matters because the numbers
 * are the designer's invention and question Q-10 asks the owner to confirm they are
 * commercially real. The formula that consumes them lives in `@charva/contracts` and is
 * imported by both the client and the server — decision D-11.
 */

export const builderSteps = mysqlTable(
  'builder_steps',
  {
    id: int().autoincrement().primaryKey(),
    /** Matches `BuilderStep` in contracts: `dest`, `dates`, `hotel`, … , `final`. */
    code: varchar({ length: 40 }).notNull(),
    kind: mysqlEnum(['single', 'multi', 'form']).notNull().default('single'),
    title: json().$type<LocalizedColumn>().notNull(),
    /** «можно выбрать несколько» — the line under the heading. */
    hint: json().$type<LocalizedColumn>(),
    /** The label on the step rail, which is shorter than the heading. */
    railLabel: json().$type<LocalizedColumn>(),
    isRequired: boolean().notNull().default(false),
    sortOrder: int().notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [unique('builder_steps_code_uq').on(table.code)],
);

/**
 * One answer to one step.
 *
 * `numericValue` and `priceModifierMinor` are separate columns, and that separation is the
 * whole of decision D-10. The handoff's proposal has a single `price_modifier`, into which
 * «7 дней» has to go as a price of seven.
 *
 * `code` is ASCII and immutable once anything references it — a quote, a lead, a URL. The
 * prototype keys its rate table by the display strings `3 ★` and `3–5`, so translating a
 * label silently reprices the tour.
 */
export const builderOptions = mysqlTable(
  'builder_options',
  {
    id: int().autoincrement().primaryKey(),
    stepId: int().notNull(),
    code: varchar({ length: 60 }).notNull(),
    name: json().$type<LocalizedColumn>().notNull(),
    /** The small grey line under the option's name — «Ночь в Каракумах». */
    note: json().$type<LocalizedColumn>(),
    /** What the option *means*: nights for `dates`, people for `people`. Null otherwise. */
    numericValue: int(),
    /** What it *costs*, in minor units. Only hotel options carry one. */
    priceModifierMinor: bigint({ mode: 'number' }),
    modifierType: mysqlEnum(['per_night', 'per_item', 'flat', 'none']).notNull().default('none'),
    isPublished: boolean().notNull().default(true),
    sortOrder: int().notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [
    unique('builder_options_code_uq').on(table.code),
    index('builder_options_step_idx').on(table.stepId, table.sortOrder),
  ],
);

/**
 * The rates and the defaults.
 *
 * The defaults matter as much as the rates: `default_nights`, `default_hotel_rate_minor` and
 * `default_pax` are what produce the 1 296 $ every visitor sees before their first click.
 */
export const pricingRules = mysqlTable(
  'pricing_rules',
  {
    id: int().autoincrement().primaryKey(),
    /** `base_fee`, `city_fee`, `activity_fee`, `default_nights`, … */
    keyName: varchar({ length: 60 }).notNull(),
    valueMinor: bigint({ mode: 'number' }).notNull(),
    /** `minor` for money, `count` for a plain number. Says how to read `valueMinor`. */
    unit: mysqlEnum(['minor', 'count']).notNull().default('minor'),
    currency: mysqlEnum(['USD', 'TMT']).notNull().default('USD'),
    note: varchar({ length: 255 }),
    updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  },
  (table) => [unique('pricing_rules_key_uq').on(table.keyName)],
);

export const builderTables = { builderSteps, builderOptions, pricingRules };
