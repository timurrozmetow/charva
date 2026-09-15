import { type ApiError } from './errors';

/**
 * The error envelope, checked by hand — and the one place in this package that does that.
 *
 * `client.ts` runs in the browser and is the only thing every page of every site imports before
 * anything is on screen. It used to call `apiErrorSchema.safeParse`, which is correct and cost
 * every visitor the whole of Zod — about twenty-five kilobytes gzipped — to validate one
 * three-field envelope that this project's own error handler produced. Nothing else on the
 * eager path touches a schema, so that one call was the reason the runtime shipped at all. It
 * is the largest thing between a phone in Ashgabat and the first paint that is not React.
 *
 * It is a file of its own rather than a function in `errors.ts` for the same reason: a bundler
 * cannot drop a module containing a top-level `z.object()`, so a guard sitting beside the
 * schema brings the schema with it wherever it goes.
 *
 * The rule «one schema, two consumers» survives, because the shape is still declared once: the
 * return type is `ApiError`, inferred from `apiErrorSchema`, so a field added there and
 * forgotten here is a compile error rather than a silent divergence — `is-api-error.test.ts`
 * checks the two against each other with the schema's own parser. What is given up is runtime
 * *depth*: this checks the shape, not that `code` is one of the known codes. That is the right
 * trade for a defensive read of a body which might equally be an nginx error page.
 */
export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;

  const { error } = value;
  if (typeof error !== 'object' || error === null) return false;

  const { code, message, requestId } = error as Record<string, unknown>;
  return typeof code === 'string' && typeof message === 'string' && typeof requestId === 'string';
}
