import { adminLoginRequest, adminLogoutResponse, adminSessionResponse } from '@charva/contracts';
import { type FastifyPluginCallback, type FastifyReply, type FastifyRequest } from 'fastify';
import { type ZodTypeProvider } from 'fastify-type-provider-zod';

import { type IssuedRefreshToken } from '../../../lib/admin-tokens';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from '../../../plugins/admin-auth';
import { ApiProblem } from '../../../plugins/error-handler';
import { adminContext } from '../context';

import { login, logout, refreshSession } from './service';

/**
 * The three routes a session is made of.
 *
 * The access token is returned in the body; the refresh token is only ever a cookie, and the
 * cookie is scoped to this path — so it is not attached to a request for a list of tours, and
 * a bug in a content route cannot leak it. `SameSite=Strict` on a host that serves no public
 * pages does most of what a CSRF token would do here (decision D-20), which is why there is no
 * double-submit token to get wrong.
 */
export const adminAuthRoutes: FastifyPluginCallback = (instance, _options, done) => {
  const app = instance.withTypeProvider<ZodTypeProvider>();
  const { env } = app;

  /**
   * Anti-guessing, second half.
   *
   * The per-account lock in the service stops a thousand guesses at one account; this stops one
   * guess each at a thousand accounts, which the lock cannot see at all.
   */
  const loginLimit = {
    rateLimit: { max: env.ADMIN_LOGIN_RATE_LIMIT_MAX, timeWindow: '10 minutes' },
  } as const;

  const setRefreshCookie = (reply: FastifyReply, refresh: IssuedRefreshToken): void => {
    void reply.setCookie(REFRESH_COOKIE, refresh.token, {
      httpOnly: true,
      // Not in development: the dev server is http://localhost, and a Secure cookie there is
      // silently dropped by the browser, which looks exactly like a broken login.
      secure: env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: REFRESH_COOKIE_PATH,
      maxAge: env.ADMIN_REFRESH_TTL_DAYS * 86_400,
    });
  };

  app.post(
    '/login',
    {
      config: loginLimit,
      schema: {
        tags: ['admin'],
        summary: 'Exchange an email and password for a session',
        description:
          'Every failure answers the same way — an endpoint that says «no such user» for one ' +
          'address and «wrong password» for another enumerates its own accounts. Five failed ' +
          'attempts lock the account for fifteen minutes, and that one is said plainly, ' +
          'because the person on the other end is almost always the real admin.',
        body: adminLoginRequest,
        response: { 200: adminSessionResponse },
      },
    },
    async (request, reply) => {
      const session = await login(adminContext(app, request), request.body);
      setRefreshCookie(reply, session.refresh);

      const access = app.signAccessToken(session.identity);
      return {
        accessToken: access.token,
        expiresInSeconds: access.expiresInSeconds,
        user: session.user,
      };
    },
  );

  app.post(
    '/refresh',
    {
      schema: {
        tags: ['admin'],
        summary: 'Rotate the refresh cookie and issue a new access token',
        description:
          'The rotation is the defence: presenting a token that has already been rotated ends ' +
          'every session in its family, because either it was stolen or the client is broken, ' +
          'and both warrant a logout. Also the call the SPA makes on load, which is why losing ' +
          'the cookie is a 401 rather than an error page.',
        response: { 200: adminSessionResponse },
      },
    },
    async (request, reply) => {
      const token = readRefreshCookie(request);
      if (token === undefined) throw new ApiProblem('unauthorized', 'No session cookie');

      const session = await refreshSession(adminContext(app, request), token);
      setRefreshCookie(reply, session.refresh);

      const access = app.signAccessToken(session.identity);
      return {
        accessToken: access.token,
        expiresInSeconds: access.expiresInSeconds,
        user: session.user,
      };
    },
  );

  app.post(
    '/logout',
    {
      schema: {
        tags: ['admin'],
        summary: 'End the session',
        description:
          'Revokes the whole family, not just the token in hand — the family is the session. ' +
          'Answers 200 whether or not there was one: a client that has already lost its cookie ' +
          'still needs the call to succeed so it can clear its own state.',
        response: { 200: adminLogoutResponse },
      },
    },
    async (request, reply) => {
      await logout(adminContext(app, request), readRefreshCookie(request));
      void reply.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      return { ok: true as const };
    },
  );

  done();
};

function readRefreshCookie(request: FastifyRequest): string | undefined {
  const value = request.cookies[REFRESH_COOKIE];
  return value === undefined || value === '' ? undefined : value;
}
