import { z } from 'zod';

import { siteSettingsSchema } from './common';
import { contentSlotSchema } from './media';
import { umrahTripSchema } from './umrah';

/**
 * The brand chooser at `charva-travel.com`.
 *
 * Almost everything on that page is copy that lives in the repository as translation files, not
 * content anybody edits — decision D-23. Exactly one thing on it is data: the Umrah departure
 * behind the pulsing badge and its countdown.
 *
 * That single field is also why `CountdownTimer` lives in `packages/ui` rather than in
 * `web-umrah`. The prototypes compute the same number twice, with `Math.ceil` here and
 * `Math.floor` on the Umrah homepage, so the chooser and the site it links to disagree about
 * how many days are left — one of the defects this phase exists to make impossible.
 */
/**
 * The three figures under each half.
 *
 * «32 Маршрута · 46 Отеля · 1 400+ Гостей в год» and «{дни} Дней · 45 Мест · 68 Групп» are
 * literals in the prototype, and the first two of each contradict the nine rows of data behind
 * them. Counted here instead — decision D-6.
 *
 * `guestsPerYear` is the exception the decision allows for: nothing in the database counts
 * visitors, so it is an explicit named override in `settings` rather than a number invented in
 * a component. It is `null` until somebody sets it, and question Q-5 asks whether they want to.
 */
export const choiceStatsSchema = z.object({
  global: z.object({
    tours: z.number().int(),
    hotels: z.number().int(),
    guestsPerYear: z.number().int().nullable(),
  }),
  umrah: z.object({
    /** From the current departure, so it is null between groups. */
    seatsTotal: z.number().int().nullable(),
    groups: z.number().int(),
    pilgrims: z.number().int(),
  }),
});

export const choiceResponse = z.object({
  umrah: z.object({
    trip: umrahTripSchema.nullable(),
  }),
  stats: choiceStatsSchema,
  /** The footer line, which both halves share. */
  contacts: z.object({
    global: siteSettingsSchema.shape.contacts,
    umrah: siteSettingsSchema.shape.contacts,
  }),
  /** The licence number, shown bottom left. Still `TM-1428` — question Q-12. */
  legal: siteSettingsSchema.shape.legal,
  /**
   * The photograph behind each half — `choice-global` and `choice-umrah`.
   *
   * Late, and the reason is worth keeping. The chooser is the one page whose pictures are its
   * entire design, and its two `ImageSlot`s were written with `media={null}` hard-coded while
   * the endpoint returned no slots at all. Both halves therefore drew the branded placeholder
   * for ever: filling `content_slots` in the database could not have changed anything, and the
   * whole path from a photograph to this page did not exist to be broken.
   */
  slots: z.array(contentSlotSchema),
});

/**
 * The inferred type, exported here rather than re-derived at each call site.
 *
 * A consumer writing `z.infer<typeof choiceResponse>` has to depend on zod to name a type it
 * only reads, which puts a runtime package in an SPA's dependency list for the sake of an
 * annotation. Contracts owns the schema, so contracts owns the type.
 */
export type ChoiceResponse = z.infer<typeof choiceResponse>;
export type ChoiceStats = z.infer<typeof choiceStatsSchema>;
