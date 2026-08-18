import { z } from 'zod';

/**
 * How a photograph crosses the wire.
 *
 * `media.storage_key` holds `2026/07/a3f9….webp` and never a URL — decision D-8 — so the URL is
 * built here, at serialisation. Moving from a local disk to object storage changes one function
 * rather than every row that ever referenced a file.
 */

/**
 * The widths the resize endpoint will produce, and the only ones.
 *
 * Shared rather than duplicated: `Img` builds its `srcSet` from this list and `/img` rejects
 * anything not on it. Without the ceiling, `?w=100000` is a one-request denial of service that
 * asks a server with no GPU to allocate a forty-gigabyte bitmap.
 */
export const IMAGE_WIDTHS = [320, 480, 640, 960, 1280, 1600, 2048] as const;

export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

/**
 * The version prefix every route of this API lives under, including the two that serve bytes.
 *
 * Written down once because it was written down three times: the client's default base, the
 * URL builder on the server, and the admin's thumbnails — and the admin's copy left it out.
 * `/img/…` and `/uploads/…` are registered inside the same prefixed plugin as everything else,
 * so a URL without it is a 404, which the admin rendered as a broken-image icon on every file
 * in the library.
 */
export const API_PREFIX = '/api/v1';

/**
 * The original file, as stored.
 *
 * `origin` is empty for a same-origin request — a page on the site, or the admin behind its
 * proxy — and the API's public host in an `og:image`, which is read by a server somewhere else.
 */
export function uploadUrl(storageKey: string, origin = ''): string {
  return `${origin}${API_PREFIX}/uploads/${storageKey}`;
}

/** The same file, resized to one of `IMAGE_WIDTHS` and cached on disk by the server. */
export function imageUrl(storageKey: string, width: ImageWidth, origin = ''): string {
  return `${origin}${API_PREFIX}/img/${storageKey}?w=${String(width)}`;
}

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
