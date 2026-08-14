import { type FastifyInstance, type FastifyRequest } from 'fastify';

import { type AuditContext } from '../../lib/audit';

import { type AuthContext } from './auth/service';

/**
 * The request-shaped half of an admin operation.
 *
 * Services take plain values rather than a Fastify request so they can be called from a test,
 * from a script and from a route without any of them constructing a fake request. This is the
 * one place that translates.
 */

export function auditContext(app: FastifyInstance, request: FastifyRequest): AuditContext {
  return {
    db: app.db,
    ipHashSecret: app.env.IP_HASH_SECRET,
    // Loud, and never fatal: a failure to write the log must not turn a completed edit into an
    // error the editor sees, because then the change happened and the response said it did not.
    onError: (error) => {
      request.log.error({ err: error }, 'failed to write an audit row');
    },
  };
}

export function adminContext(app: FastifyInstance, request: FastifyRequest): AuthContext {
  return {
    db: app.db,
    audit: auditContext(app, request),
    refreshSecret: app.env.ADMIN_REFRESH_SECRET,
    ipHashSecret: app.env.IP_HASH_SECRET,
    refreshTtlDays: app.env.ADMIN_REFRESH_TTL_DAYS,
    maxFailedAttempts: app.env.ADMIN_MAX_FAILED_ATTEMPTS,
    lockMinutes: app.env.ADMIN_LOCK_MINUTES,
    ip: request.ip,
    userAgent: request.headers['user-agent'],
  };
}
