import { z } from 'zod';

/**
 * The shapes a photograph takes on the wire.
 *
 * The URL builders that used to sit above these moved to `media-urls.ts` and are re-exported
 * here, so nothing that imports them had to change. The split is not tidiness: this module has
 * top-level `z.object()` calls, which a bundler cannot prove are free of side effects, so every
 * page that wanted `imageUrl` — which is every page, for every `srcSet` — pulled the whole Zod
 * runtime into the first download. The builders have no dependencies at all now.
 */

export * from './media-urls';

export const mediaRefSchema = z.object({
  /** `/uploads/2026/07/a3f9….webp`. `Img` rewrites it to `/img/…?w=` for the srcSet. */
  url: z.string(),
  /** Intrinsic size, so the layout can reserve the space and the page does not jump. */
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  /** Already resolved into the requested language. Empty string means decorative. */
  alt: z.string(),
  /** A few hundred bytes of inline preview, shown blurred until the real pixels arrive. */
  lqip: z.string().nullable(),
  /** Subject position, 0–1 from the top left. Stored 0–1000 to stay an integer. */
  focalX: z.number().nullable(),
  focalY: z.number().nullable(),
});

export type MediaRef = z.infer<typeof mediaRefSchema>;

/**
 * A position a photograph belongs in, whether or not one exists — decision D-21.
 *
 * The handoff contains no photographs at all: 174 rows of Russian art direction and nothing to
 * show. Sending the brief with the page is what lets `ImageSlot` draw a branded rectangle at
 * the right proportions instead of the page collapsing, and what turns the gap into a checklist
 * rather than an absence. Question Q-1.
 */
export const contentSlotSchema = z.object({
  slotKey: z.string(),
  brief: z.string(),
  recommendedWidth: z.number().int().nullable(),
  recommendedHeight: z.number().int().nullable(),
  media: mediaRefSchema.nullable(),
});

export type ContentSlot = z.infer<typeof contentSlotSchema>;

/**
 * One slide of the homepage slider: a photograph, and the word printed over it.
 *
 * Both are on this shape because both belong to the slide. The version this replaced sent
 * neither — the homepage took its captions from the places on `/turkmenistan` and its pictures
 * from whichever of two sources happened to be filled, so «change the caption of slide two» was
 * an operation on a different page and «upload the photograph» was a coin toss.
 *
 * `brief` rides along for the same reason `contentSlotSchema` carries one: while `media` is null
 * the page still draws the frame at its real proportions and says what belongs in it.
 */
export const heroSlideSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  brief: z.string(),
  media: mediaRefSchema.nullable(),
});

export type HeroSlide = z.infer<typeof heroSlideSchema>;

/**
 * One borrowed photograph, as the credits page names it.
 *
 * Every image on the site today came from Wikimedia Commons, and the licences they carry — CC BY
 * and CC BY-SA, mostly — require the author to be named where the work is published. This is that
 * naming: what the file is called there, who took it, under what licence, and a link back.
 *
 * Only `source = 'stock'` rows appear. A photograph the operator took needs no credit to anybody,
 * and listing it would say the opposite of the truth.
 */
export const creditSchema = z.object({
  id: z.number().int(),
  author: z.string(),
  license: z.string(),
  /** The Commons description page, or null when the import recorded no link. */
  sourceUrl: z.string().nullable(),
});

export type Credit = z.infer<typeof creditSchema>;

export const creditsResponse = z.object({
  items: z.array(creditSchema),
});

export type CreditsResponse = z.infer<typeof creditsResponse>;
