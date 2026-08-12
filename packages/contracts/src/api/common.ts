import { z, type ZodTypeAny } from 'zod';

import { type Site, SITE_LANGS } from '../constants';
import { CURRENCIES } from '../money';

/**
 * The pieces every module's schemas are built from.
 *
 * These live in `packages/contracts` rather than in the API because they have two consumers:
 * `fastify-type-provider-zod` uses them on the server as validator *and serialiser*, and the
 * three SPAs use the inferred types and `zodResolver` on the client. Two hand-written copies of
 * one shape is how a client and a server come to disagree about a field name.
 */

/**
 * The language query, narrowed to what one site offers.
 *
 * Per site rather than one shared enum, because the sets genuinely differ: Umrah is never
 * Turkish, Global is never Turkmen. This is what puts the right four values in `/docs` for each
 * route instead of a union nobody can act on.
 */
export function langQueryFor(site: Site) {
  return z.object({
    lang: z.enum(SITE_LANGS[site] as unknown as [string, ...string[]]).optional(),
  });
}

/** `/tours/:slug`. Slugs are ASCII and immutable — decision D-40. */
export const slugParams = z.object({
  slug: z.string().min(1).max(160),
});

/**
 * Money on the wire: an integer and a currency, never a formatted string.
 *
 * Formatting is a rendering decision that depends on the reader's language — `1 296 $` for a
 * Russian reader, and the thousands separator is a non-breaking space. `formatMoney` is the
 * only place that happens, and it happens in the browser.
 */
export const moneySchema = z.object({
  minor: z.number().int(),
  currency: z.enum(CURRENCIES),
});

export const pageMetaSchema = z.object({
  page: z.number().int(),
  perPage: z.number().int(),
  /** So «Показано 16 из 248» is a fact rather than the literal the prototype prints — D-6. */
  total: z.number().int(),
  totalPages: z.number().int(),
  hasMore: z.boolean(),
});

export function paginated<T extends ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item), meta: pageMetaSchema });
}

/**
 * A filter chip, counted.
 *
 * Built from `SELECT DISTINCT` over published rows rather than hardcoded — decision D-15. That
 * is what structurally fixes the missing `Jidda` chip on the ziyarat page, where the city is in
 * the data and the chip list is a literal, and it guarantees no chip ever leads to an empty
 * grid, because a chip only exists if rows exist behind it.
 */
export const facetSchema = z.object({
  /** Stable ASCII, never the translated label — the same rule as the builder's codes (D-10). */
  code: z.string(),
  label: z.string(),
  count: z.number().int(),
});

export type Facet = z.infer<typeof facetSchema>;

/** An ordered pair from `content_blocks` — the seven small lists D-17 collapsed into one table. */
export const contentBlockSchema = z.object({
  id: z.number().int(),
  key: z.string(),
  value: z.string(),
  note: z.string(),
  icon: z.string().nullable(),
});

export type ContentBlockItem = z.infer<typeof contentBlockSchema>;

/** Contacts, socials and the licence number, from `settings`. */
export const siteSettingsSchema = z.object({
  contacts: z.object({
    phone: z.string(),
    whatsapp: z.string(),
    email: z.string(),
    hours: z.string(),
    address: z.string(),
  }),
  socials: z.object({
    instagram: z.string(),
    telegram: z.string(),
    whatsapp: z.string(),
    youtube: z.string(),
  }),
  legal: z.object({
    license: z.string(),
    /** True while the values are the prototype's placeholders — question Q-12. */
    unconfirmed: z.boolean(),
  }),
  langs: z.array(z.string()),
  defaultLang: z.string(),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const faqSchema = z.object({
  id: z.number().int(),
  question: z.string(),
  answer: z.string(),
});
