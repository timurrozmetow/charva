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
