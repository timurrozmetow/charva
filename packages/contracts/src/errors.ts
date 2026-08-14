import { z } from 'zod';

/**
 * One error shape for the whole API.
 *
 * A single envelope means the client has one branch to write instead of one per endpoint, and
 * a code rather than a message means the text can be translated — this API answers in four
 * languages and an English sentence from a validator is not an answer.
 */

export const ERROR_CODES = [
  /** The request body or query failed its schema. `details` names the fields. */
  'validation_failed',
  'not_found',
  /** Too many requests from this address — the lead form's first line of defence. */
  'rate_limited',
  'unauthorized',
  'forbidden',
  /**
   * The account is temporarily locked after repeated failures.
   *
   * Separate from `rate_limited`, which is about an address: this one is about an account, and
   * the two are told apart because the fixes differ — wait, versus ask the owner to unlock.
   */
  'locked',
  /** A unique constraint, or a state the row cannot move to. */
  'conflict',
  /** Upload rejected: wrong magic bytes, too large, unsupported format. */
  'unsupported_media',
  'internal',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const HTTP_STATUS: Record<ErrorCode, number> = {
  validation_failed: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  unsupported_media: 415,
  locked: 423,
  rate_limited: 429,
  internal: 500,
};

export const errorDetailSchema = z.object({
  /** Dotted path into the request — `phone`, `selection.hotel`. */
  path: z.string(),
  message: z.string(),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    /** English, for logs and developers. Never rendered to a visitor. */
    message: z.string(),
    details: z.array(errorDetailSchema).optional(),
    /**
     * Ties a failure a visitor reports to a line in the log.
     *
     * The alternative is asking someone in Ashgabat what time it was and grepping an hour of
     * requests.
     */
    requestId: z.string(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
