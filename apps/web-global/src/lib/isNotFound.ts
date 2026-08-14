import { ApiRequestError } from '@charva/contracts';

/**
 * Whether a failed request means «no such thing» rather than «something went wrong».
 *
 * The three detail pages are the first routes whose address can be wrong — a slug that was
 * renamed, a tour that was unpublished, a link that outlived the row it pointed at. Those
 * deserve the 404 page and its way back; a dropped connection deserves a retry button. Telling
 * somebody to «проверьте соединение» when the tour simply no longer exists sends them to
 * restart their router.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 404;
}
