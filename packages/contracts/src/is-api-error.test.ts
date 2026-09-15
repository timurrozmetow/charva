import { describe, expect, it } from 'vitest';

import { apiErrorSchema } from './errors';
import { isApiError } from './is-api-error';

/**
 * The guard and the schema, held against each other.
 *
 * `isApiError` exists so that the browser does not download Zod to read a three-field envelope
 * (see the note on the function). The cost of that is a second description of one shape, and
 * this is what stops the two drifting: every case below is judged by both, and they have to
 * agree. TypeScript already catches a *field* added to the schema, because the guard's return
 * type is inferred from it; what it cannot catch is the guard forgetting to check one.
 */

const VALID: unknown = {
  error: { code: 'not_found', message: 'No tour with that slug', requestId: 'req-5w' },
};

const CASES: [string, unknown][] = [
  ['a complete envelope', VALID],
  [
    'an envelope with details',
    {
      error: {
        code: 'validation_failed',
        message: 'Bad request',
        requestId: 'req-1',
        details: [{ path: 'phone', message: 'Not a number' }],
      },
    },
  ],
  ['null', null],
  ['undefined', undefined],
  ['a string — an nginx error page, read as JSON', '<html>502</html>'],
  ['an array', []],
  ['an empty object', {}],
  ['an envelope with no error key', { message: 'nope' }],
  ['an error that is not an object', { error: 'not_found' }],
  ['an error that is null', { error: null }],
  ['a missing requestId', { error: { code: 'not_found', message: 'gone' } }],
  ['a missing message', { error: { code: 'not_found', requestId: 'req-1' } }],
  ['a numeric code', { error: { code: 404, message: 'gone', requestId: 'req-1' } }],
];

describe('isApiError agrees with apiErrorSchema', () => {
  for (const [name, value] of CASES) {
    it(name, () => {
      expect(isApiError(value)).toBe(apiErrorSchema.safeParse(value).success);
    });
  }

  it('reads an unknown code as an error anyway', () => {
    /*
     * The one place the two are allowed to differ, stated rather than discovered.
     *
     * The schema pins `code` to `ERROR_CODES`; the guard only asks that it is a string. That is
     * deliberate: this runs on a body the server sent, and a client that refuses to recognise an
     * error because the server has learned a new code turns a useful message into `null` — the
     * visitor gets «что-то пошло не так» instead of «этот тур снят с публикации», and the
     * request id that ties it to a log line is thrown away with it.
     */
    const future = { error: { code: 'teapot', message: 'Short and stout', requestId: 'req-9' } };

    expect(isApiError(future)).toBe(true);
    expect(apiErrorSchema.safeParse(future).success).toBe(false);
  });
});
