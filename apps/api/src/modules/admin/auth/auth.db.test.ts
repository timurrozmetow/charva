import { type AdminSessionResponse } from '@charva/contracts';
import { and, desc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as t from '../../../db/schema';
import { hashPassword } from '../../../lib/passwords';
import { REFRESH_COOKIE, REFRESH_COOKIE_PATH } from '../../../plugins/admin-auth';
import { buildTestApp, problem, type TestApp } from '../../../test/app';

/**
 * The session, against the real database.
 *
 * Everything here is about state that only exists in rows: the failure counter, the lock, the
 * revocation of a family. A mock would let all of it pass by agreeing with itself.
 *
 * Each test speaks from its own address. The login route is rate limited per address, and
 * sharing one would make the ninth test in the file fail because of the eighth — a suite that
 * has to be read in order to be understood.
 */

let context: TestApp;

const PASSWORD = 'test-owner-password';

beforeAll(async () => {
  context = await buildTestApp();
}, 60_000);

afterAll(async () => {
  await context.close();
});

/** A fresh account per test, so a lock in one cannot reach another. */
async function makeUser(
  email: string,
  overrides: Partial<typeof t.adminUsers.$inferInsert> = {},
): Promise<number> {
  await context.app.db.delete(t.adminUsers).where(eq(t.adminUsers.email, email));
  const [result] = await context.app.db.insert(t.adminUsers).values({
    email,
    name: email,
    role: 'editor',
    passwordHash: await hashPassword(PASSWORD),
    ...overrides,
  });
  return result.insertId;
}

function login(email: string, password: string, ip: string) {
  return context.app.inject({
    method: 'POST',
    url: `${context.prefix}/admin/auth/login`,
    payload: { email, password },
    headers: { 'x-forwarded-for': ip },
  });
}

function refreshCookie(response: { cookies: { name: string; value: string }[] }): string {
  const cookie = response.cookies.find((item) => item.name === REFRESH_COOKIE);
  expect(cookie, 'no refresh cookie was set').toBeDefined();
  return cookie!.value;
}

function callRefresh(token: string, ip: string) {
  return context.app.inject({
    method: 'POST',
    url: `${context.prefix}/admin/auth/refresh`,
    cookies: { [REFRESH_COOKIE]: token },
    headers: { 'x-forwarded-for': ip },
  });
}

async function lastAudit(action: string, entityId: number | string) {
  const [row] = await context.app.db
    .select()
    .from(t.auditLog)
    .where(and(eq(t.auditLog.action, action), eq(t.auditLog.entityId, String(entityId))))
    .orderBy(desc(t.auditLog.id))
    .limit(1);
  return row;
}

describe('logging in', () => {
  it('returns a session and sets a cookie the page cannot read', async () => {
    const response = await login(context.admin.email, context.admin.password, '203.0.113.1');

    expect(response.statusCode, response.body).toBe(200);
    const session = response.json<AdminSessionResponse>();
    expect(session.user.email).toBe(context.admin.email);
    expect(session.user.role).toBe('owner');
    expect(session.user.capabilities).toContain('passport.reveal');
    expect(session.expiresInSeconds).toBe(15 * 60);
    // The token is a JWT — three dot-separated segments — and not the refresh token.
    expect(session.accessToken.split('.')).toHaveLength(3);

    const cookie = response.cookies.find((item) => item.name === REFRESH_COOKIE);
    expect(cookie?.httpOnly, 'the refresh cookie must be unreadable from script').toBe(true);
    expect(cookie?.sameSite).toBe('Strict');
    // Scoped, so it is not attached to a request for a list of tours.
    expect(cookie?.['path']).toBe(REFRESH_COOKIE_PATH);
  });

  it('stores the refresh token as a digest, never as itself', async () => {
    const response = await login(context.admin.email, context.admin.password, '203.0.113.2');
    const token = refreshCookie(response);

    const rows = await context.app.db
      .select({ hash: t.adminRefreshTokens.tokenHash })
      .from(t.adminRefreshTokens)
      .where(eq(t.adminRefreshTokens.userId, context.admin.id));

    expect(rows.length).toBeGreaterThan(0);
    // A dump of this table must not be a set of working sessions.
    expect(rows.map((row) => row.hash)).not.toContain(token);
    expect(rows[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('answers a wrong password and an unknown address identically', async () => {
    const id = await makeUser('wrong-password@charva.test');

    const wrong = await login('wrong-password@charva.test', 'not-the-password', '203.0.113.3');
    const unknown = await login('nobody@charva.test', 'not-the-password', '203.0.113.4');

    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    // Same code and same sentence: otherwise the endpoint enumerates its own accounts.
    // `requestId` is per request and is the one field that is meant to differ.
    expect(problem(wrong).error.code).toBe(problem(unknown).error.code);
    expect(problem(wrong).error.message).toBe(problem(unknown).error.message);

    expect(await lastAudit('login_failed', id)).toBeDefined();
  });

  it('refuses an account that has been deactivated', async () => {
    await makeUser('gone@charva.test', { isActive: false });
    const response = await login('gone@charva.test', PASSWORD, '203.0.113.5');
    expect(response.statusCode).toBe(401);
  });
});

describe('the lock', () => {
  it('closes the account after five wrong passwords and says so plainly', async () => {
    const email = 'locks@charva.test';
    await makeUser(email);

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await login(email, 'wrong', '203.0.113.10');
      expect(response.statusCode, `attempt ${String(attempt)}`).toBe(401);
    }

    // The sixth is refused before the password is even checked, and is told why: the person on
    // the other end is almost always the real admin, and «wrong password» would send them
    // changing a password that works.
    const locked = await login(email, PASSWORD, '203.0.113.10');
    expect(locked.statusCode).toBe(423);
    expect(problem(locked).error.code).toBe('locked');
  });

  it('does not hand back a fresh budget when the lock expires', async () => {
    const email = 'expired-lock@charva.test';
    const id = await makeUser(email);

    for (let attempt = 0; attempt < 5; attempt += 1) await login(email, 'wrong', '203.0.113.11');

    // Time travel: the lock has passed, the counter has not been cleared by a real login.
    await context.app.db
      .update(t.adminUsers)
      .set({ lockedUntil: new Date(Date.now() - 60_000) })
      .where(eq(t.adminUsers.id, id));

    const again = await login(email, 'wrong', '203.0.113.11');
    expect(again.statusCode).toBe(401);

    const [row] = await context.app.db
      .select({ failed: t.adminUsers.failedAttempts, until: t.adminUsers.lockedUntil })
      .from(t.adminUsers)
      .where(eq(t.adminUsers.id, id));

    // Six, not one: one more failure re-locks immediately rather than starting a new run of five.
    expect(row?.failed).toBe(6);
    expect(row?.until?.getTime()).toBeGreaterThan(Date.now());
  });

  it('is cleared by a successful login', async () => {
    const email = 'recovers@charva.test';
    const id = await makeUser(email);

    await login(email, 'wrong', '203.0.113.12');
    await login(email, 'wrong', '203.0.113.12');
    const ok = await login(email, PASSWORD, '203.0.113.12');
    expect(ok.statusCode).toBe(200);

    const [row] = await context.app.db
      .select({ failed: t.adminUsers.failedAttempts, last: t.adminUsers.lastLoginAt })
      .from(t.adminUsers)
      .where(eq(t.adminUsers.id, id));

    expect(row?.failed).toBe(0);
    expect(row?.last).not.toBeNull();
  });
});

describe('rotation', () => {
  it('replaces the token on every use and refuses the previous one', async () => {
    const email = 'rotates@charva.test';
    await makeUser(email);

    const first = refreshCookie(await login(email, PASSWORD, '203.0.113.20'));
    const rotated = await callRefresh(first, '203.0.113.20');
    expect(rotated.statusCode, rotated.body).toBe(200);

    const second = refreshCookie(rotated);
    expect(second).not.toBe(first);

    const replay = await callRefresh(first, '203.0.113.20');
    expect(replay.statusCode, 'a rotated token must not work twice').toBe(401);
  });

  it('ends the whole family when a rotated token comes back', async () => {
    const email = 'reuse@charva.test';
    const id = await makeUser(email);

    const first = refreshCookie(await login(email, PASSWORD, '203.0.113.21'));
    const second = refreshCookie(await callRefresh(first, '203.0.113.21'));

    // Somebody presents the old one. Either it was stolen or the client is broken, and both
    // warrant a logout — including of the token that is currently working.
    await callRefresh(first, '203.0.113.99');

    const afterReuse = await callRefresh(second, '203.0.113.21');
    expect(afterReuse.statusCode, 'the live token must die with its family').toBe(401);

    expect(await lastAudit('refresh_reuse', await familyOf(id))).toBeDefined();
  });

  it('refuses a token that has expired', async () => {
    const email = 'stale@charva.test';
    const id = await makeUser(email);
    const token = refreshCookie(await login(email, PASSWORD, '203.0.113.22'));

    await context.app.db
      .update(t.adminRefreshTokens)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(t.adminRefreshTokens.userId, id));

    expect((await callRefresh(token, '203.0.113.22')).statusCode).toBe(401);
  });

  it('ends the session when the account is deactivated mid-flight', async () => {
    const email = 'deactivated@charva.test';
    const id = await makeUser(email);
    const token = refreshCookie(await login(email, PASSWORD, '203.0.113.23'));

    await context.app.db
      .update(t.adminUsers)
      .set({ isActive: false })
      .where(eq(t.adminUsers.id, id));

    // Otherwise deactivating an account only stops the next login, not the session it has.
    expect((await callRefresh(token, '203.0.113.23')).statusCode).toBe(401);
  });

  it('refuses a request with no cookie at all', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: `${context.prefix}/admin/auth/refresh`,
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('logging out', () => {
  it('ends the family, not just the token in hand', async () => {
    const email = 'logout@charva.test';
    await makeUser(email);

    const first = refreshCookie(await login(email, PASSWORD, '203.0.113.30'));
    const second = refreshCookie(await callRefresh(first, '203.0.113.30'));

    const out = await context.app.inject({
      method: 'POST',
      url: `${context.prefix}/admin/auth/logout`,
      cookies: { [REFRESH_COOKIE]: second },
      headers: { 'x-forwarded-for': '203.0.113.30' },
    });

    expect(out.statusCode).toBe(200);
    expect(out.cookies.find((item) => item.name === REFRESH_COOKIE)?.value).toBe('');
    expect((await callRefresh(second, '203.0.113.30')).statusCode).toBe(401);
  });

  it('succeeds even with no session, so a client can always clear its own state', async () => {
    const response = await context.app.inject({
      method: 'POST',
      url: `${context.prefix}/admin/auth/logout`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json<{ ok: boolean }>().ok).toBe(true);
  });
});

describe('the per-address limit', () => {
  it('stops one address trying a password against account after account', async () => {
    // The per-account lock cannot see this at all: every attempt below is against a different
    // address book entry, so no single counter ever reaches five.
    const ip = '203.0.113.40';
    let limited = 0;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await login(`nobody-${String(attempt)}@charva.test`, 'guess', ip);
      if (response.statusCode === 429) limited += 1;
    }

    expect(limited, 'twelve attempts from one address must not all be served').toBeGreaterThan(0);
  });
});

/** The family id of a user's most recent token, for the audit assertions. */
async function familyOf(userId: number): Promise<string> {
  const [row] = await context.app.db
    .select({ familyId: t.adminRefreshTokens.familyId })
    .from(t.adminRefreshTokens)
    .where(eq(t.adminRefreshTokens.userId, userId))
    .orderBy(desc(t.adminRefreshTokens.id))
    .limit(1);
  return row?.familyId ?? '';
}
