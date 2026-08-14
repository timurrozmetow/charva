import { type AdminRole, type AdminSiteScope, can, type Capability } from '@charva/contracts';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { type FastifyInstance, type preHandlerAsyncHookHandler } from 'fastify';
import fp from 'fastify-plugin';

import { ApiProblem } from './error-handler';

/**
 * Who is asking, on admin routes.
 *
 * Two tokens with deliberately different properties. The access token is a JWT that lives for
 * fifteen minutes in a JavaScript variable in the admin tab — verifiable without a database
 * round trip, which is the point, and impossible to revoke, which is why it is short. The
 * refresh token is opaque, stored as a digest, rotated on use, and revocable; it never reaches
 * JavaScript at all, because it is a `HttpOnly` cookie.
 *
 * Wrapped in `fastify-plugin` for the reason D-49 records in blood: `register` gives a plugin
 * its own encapsulation context, so a decorator or hook added inside an unwrapped plugin is
 * invisible to sibling routes — the plugin loads, nothing errors, and no request is ever
 * checked.
 */

export interface AdminIdentity {
  id: number;
  role: AdminRole;
  siteScope: AdminSiteScope | null;
}

/** What the signed token actually carries. Deliberately small: an id and what it may do. */
interface AccessTokenPayload {
  sub: string;
  role: AdminRole;
  scope: AdminSiteScope | null;
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Null on every public route, and on an admin route only before `requireAdmin` has run. */
    admin: AdminIdentity | null;
  }

  interface FastifyInstance {
    /**
     * A `preHandler` that authenticates, and optionally demands one capability.
     *
     * Passing the capability here rather than checking it inside the handler means a route
     * cannot be written that authenticates but forgets to authorise: the guard is in the route
     * definition, where it is visible in review.
     */
    requireAdmin: (capability?: Capability) => preHandlerAsyncHookHandler;
    signAccessToken: (identity: AdminIdentity) => { token: string; expiresInSeconds: number };
  }
}

const ISSUER = 'charva-admin';

/** Where the refresh cookie is sent back to. Nothing outside this path ever receives it. */
export const REFRESH_COOKIE = 'charva_admin_refresh';
export const REFRESH_COOKIE_PATH = '/api/v1/admin/auth';

export const adminAuthPlugin = fp(async function adminAuthPlugin(app: FastifyInstance) {
  const ttlSeconds = app.env.ADMIN_ACCESS_TTL_MINUTES * 60;

  await app.register(cookie);
  await app.register(jwt, {
    secret: app.env.ADMIN_JWT_SECRET,
    sign: { expiresIn: ttlSeconds, iss: ISSUER },
    verify: { allowedIss: ISSUER },
  });

  app.decorateRequest('admin', null);

  app.decorate('signAccessToken', (identity: AdminIdentity) => ({
    token: app.jwt.sign({
      sub: String(identity.id),
      role: identity.role,
      scope: identity.siteScope,
    }),
    expiresInSeconds: ttlSeconds,
  }));

  app.decorate('requireAdmin', (capability?: Capability): preHandlerAsyncHookHandler => {
    return async function authenticate(request) {
      let payload: AccessTokenPayload;
      try {
        payload = await request.jwtVerify<AccessTokenPayload>();
      } catch {
        /*
         * One answer for every way a token can fail: absent, malformed, expired, signed by
         * something else. The client's response to all four is the same — refresh, then send
         * the person to the login screen — and naming which one it was tells an attacker
         * whether a forged token got as far as the signature check.
         */
        throw new ApiProblem('unauthorized', 'A valid admin session is required');
      }

      const identity: AdminIdentity = {
        id: Number(payload.sub),
        role: payload.role,
        siteScope: payload.scope,
      };
      request.admin = identity;

      if (capability !== undefined && !can(identity.role, capability)) {
        throw new ApiProblem('forbidden', `This account may not ${capability}`);
      }
    };
  });
});

/**
 * The identity of the account making the request, or a failure that means the guard is missing.
 *
 * Handlers call this rather than reading `request.admin` directly, so that a route which forgot
 * its `preHandler` fails loudly on the first request instead of writing an audit row with a
 * null actor and carrying on.
 */
export function currentAdmin(request: { admin: AdminIdentity | null }): AdminIdentity {
  if (request.admin === null) {
    throw new Error('currentAdmin() called on a route without requireAdmin()');
  }
  return request.admin;
}
