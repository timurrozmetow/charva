import { type ApiError, type ErrorCode, HTTP_STATUS } from '@charva/contracts';
import { type FastifyError, type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from 'fastify-type-provider-zod';
import { ZodError } from 'zod';

/**
 * One error shape for the whole API.
 *
 * The client writes one branch instead of one per endpoint, and the payload carries a *code*
 * rather than a sentence, because this API answers in four languages and «Expected string,
 * received number» is not something a visitor in Ashgabat can be shown. The English `message`
 * is for the log and for whoever is reading it.
 */

/** Thrown by services. Anything else reaching the handler is a bug and is logged as one. */
export class ApiProblem extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiProblem';
  }
}

export function notFound(what: string): ApiProblem {
  return new ApiProblem('not_found', `${what} not found`);
}

function envelope(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: { path: string; message: string }[],
): ApiError {
  return { error: { code, message, requestId, ...(details === undefined ? {} : { details }) } };
}

export const errorHandler = fp(function errorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    void reply
      .code(HTTP_STATUS.not_found)
      .send(envelope('not_found', `No route for ${request.method} ${request.url}`, request.id));
  });

  // Annotated rather than inferred: without it TypeScript widens the parameter to `unknown`
  // once the first type guard runs, and every branch below has to re-narrow.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    /*
     * A response that does not match its own schema.
     *
     * This is the failure mode the mandatory response schema creates, and it is worth its own
     * branch: it means a handler returned a shape nobody declared, which under D-12 is exactly
     * the mechanism that stops an Umrah price from reaching a browser. It is a 500 to the
     * client and a loud line in the log for us, never a quietly reshaped body.
     */
    if (isResponseSerializationError(error)) {
      request.log.error(
        { err: error, route: error.method, url: error.url, cause: error.cause.issues },
        'response did not match its schema',
      );
      return reply
        .code(HTTP_STATUS.internal)
        .send(envelope('internal', 'Response failed its own schema', request.id));
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const details = error.validation.map((issue) => ({
        path: issue.params.issue.path.join('.'),
        message: issue.params.issue.message,
      }));
      return reply
        .code(HTTP_STATUS.validation_failed)
        .send(envelope('validation_failed', 'Request failed validation', request.id, details));
    }

    // A schema used inside a service rather than on the route boundary.
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return reply
        .code(HTTP_STATUS.validation_failed)
        .send(envelope('validation_failed', 'Request failed validation', request.id, details));
    }

    if (error instanceof ApiProblem) {
      return reply
        .code(HTTP_STATUS[error.code])
        .send(envelope(error.code, error.message, request.id, error.details));
    }

    // `@fastify/rate-limit` and `@fastify/sensible` throw with a status already attached.
    if (error.statusCode === HTTP_STATUS.rate_limited) {
      return reply
        .code(HTTP_STATUS.rate_limited)
        .send(envelope('rate_limited', error.message, request.id));
    }

    if (error.statusCode !== undefined && error.statusCode < 500) {
      const code: ErrorCode =
        error.statusCode === HTTP_STATUS.not_found
          ? 'not_found'
          : error.statusCode === HTTP_STATUS.unsupported_media
            ? 'unsupported_media'
            : 'validation_failed';
      return reply.code(error.statusCode).send(envelope(code, error.message, request.id));
    }

    /*
     * Everything else.
     *
     * The real message goes to the log and a fixed one goes to the client: an unhandled error
     * from a database driver says which column, which table and sometimes which value, and none
     * of that is a visitor's business.
     */
    request.log.error({ err: error }, 'unhandled error');
    return reply
      .code(HTTP_STATUS.internal)
      .send(envelope('internal', 'Something went wrong', request.id));
  });
});
