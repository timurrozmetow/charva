import { type AdminLoginRequest, type AdminUser, capabilitiesOf } from '@charva/contracts';
import { and, eq, isNull } from 'drizzle-orm';

import { type Database } from '../../../db/client';
import * as t from '../../../db/schema';
import {
  issueRefreshToken,
  type IssuedRefreshToken,
  refreshDigest,
} from '../../../lib/admin-tokens';
import { type AuditContext, recordAudit } from '../../../lib/audit';
import { hashIp } from '../../../lib/hash';
import { DECOY_HASH, verifyPassword } from '../../../lib/passwords';
import { ApiProblem } from '../../../plugins/error-handler';

/**
 * Logging in, staying logged in, and stopping.
 *
 * Three defences, each against a different attack, which is why none of them replaces another:
 *
 *   — Argon2id makes one guess expensive.
 *   — The per-account lock makes a thousand guesses at one account pointless.
 *   — The per-address rate limit (route configuration, not here) makes one guess each at a
 *     thousand accounts pointless, which the lock alone would happily allow.
 *
 * And one property that is not a defence against guessing at all: every failure answers the
 * same way. A login that says «no such user» for an unknown address and «wrong password» for a
 * known one is an endpoint that enumerates its own accounts.
 */

export interface AuthContext {
  db: Database;
  audit: AuditContext;
  refreshSecret: string;
  ipHashSecret: string;
  refreshTtlDays: number;
  maxFailedAttempts: number;
  lockMinutes: number;
  ip: string;
  userAgent: string | undefined;
  now?: Date;
}

export interface Session {
  user: AdminUser;
  identity: { id: number; role: AdminUser['role']; siteScope: AdminUser['siteScope'] };
  refresh: IssuedRefreshToken;
}

type AdminRow = typeof t.adminUsers.$inferSelect;

/** The public shape of an account: never the hash, never the lock counters. */
function present(row: AdminRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    siteScope: row.siteScope ?? null,
    capabilities: capabilitiesOf(row.role),
    lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
  };
}

/** One sentence for every way a login can fail. See the note at the top of this file. */
function refuse(): ApiProblem {
  return new ApiProblem('unauthorized', 'Wrong email or password');
}

export async function login(context: AuthContext, input: AdminLoginRequest): Promise<Session> {
  const now = context.now ?? new Date();
  const email = input.email.trim().toLowerCase();

  const [user] = await context.db
    .select()
    .from(t.adminUsers)
    .where(eq(t.adminUsers.email, email))
    .limit(1);

  if (user?.isActive !== true) {
    /*
     * Verify against a hash of bytes nobody has.
     *
     * Without this, an unknown address returns in microseconds and a known one spends fifty
     * milliseconds in Argon2 — a difference visible over a handful of requests, and enough to
     * sort a list of guessed addresses into «has an account» and «does not» before trying a
     * single password.
     */
    await verifyPassword(await DECOY_HASH, input.password);
    await recordAudit(context.audit, {
      actorId: user?.id ?? null,
      action: 'login_failed',
      entity: 'admin_users',
      entityId: user?.id ?? null,
      after: { email, reason: user === undefined ? 'unknown_email' : 'inactive' },
      ip: context.ip,
    });
    throw refuse();
  }

  if (user.lockedUntil !== null && user.lockedUntil > now) {
    // Told plainly, because the person on the other end is almost always the real admin, and
    // «wrong password» while the password is right sends them changing a password that works.
    throw new ApiProblem(
      'locked',
      `Too many failed attempts. This account is locked until ${user.lockedUntil.toISOString()}`,
    );
  }

  if (!(await verifyPassword(user.passwordHash, input.password))) {
    const failed = user.failedAttempts + 1;
    const locks = failed >= context.maxFailedAttempts;

    await context.db
      .update(t.adminUsers)
      .set({
        failedAttempts: failed,
        // The counter keeps climbing past the threshold and is only cleared by a real login, so
        // a lock that expires does not hand back a fresh budget of five more guesses.
        lockedUntil: locks ? new Date(now.getTime() + context.lockMinutes * 60_000) : null,
      })
      .where(eq(t.adminUsers.id, user.id));

    await recordAudit(context.audit, {
      actorId: user.id,
      action: 'login_failed',
      entity: 'admin_users',
      entityId: user.id,
      after: { email, failedAttempts: failed, locked: locks },
      ip: context.ip,
    });

    throw refuse();
  }

  await context.db
    .update(t.adminUsers)
    .set({ failedAttempts: 0, lockedUntil: null, lastLoginAt: now })
    .where(eq(t.adminUsers.id, user.id));

  const refresh = await startFamily(context, user.id, now);

  await recordAudit(context.audit, {
    actorId: user.id,
    action: 'login',
    entity: 'admin_users',
    entityId: user.id,
    ip: context.ip,
  });

  return {
    user: { ...present(user), lastLoginAt: now.toISOString() },
    identity: { id: user.id, role: user.role, siteScope: user.siteScope ?? null },
    refresh,
  };
}

/**
 * Exchange a refresh token for the next one.
 *
 * Rotation is what makes a stolen cookie useful only until its owner's browser next refreshes:
 * at that moment one of the two presents a token that has already been used, and the reuse
 * branch below ends every session in the family. Which of them was the thief is unknowable from
 * here, and that is fine — both being logged out is the correct outcome.
 */
export async function refreshSession(context: AuthContext, token: string): Promise<Session> {
  const now = context.now ?? new Date();
  const digest = refreshDigest(token, context.refreshSecret);

  const [row] = await context.db
    .select()
    .from(t.adminRefreshTokens)
    .where(eq(t.adminRefreshTokens.tokenHash, digest))
    .limit(1);

  if (row === undefined) throw new ApiProblem('unauthorized', 'No such session');

  if (row.revokedAt !== null) {
    await revokeFamily(context, row.familyId, now);
    await recordAudit(context.audit, {
      actorId: row.userId,
      action: 'refresh_reuse',
      entity: 'admin_refresh_tokens',
      entityId: row.familyId,
      after: { reason: 'a token that had already been rotated was presented again' },
      ip: context.ip,
    });
    throw new ApiProblem('unauthorized', 'Session ended');
  }

  if (row.expiresAt <= now) throw new ApiProblem('unauthorized', 'Session expired');

  const [user] = await context.db
    .select()
    .from(t.adminUsers)
    .where(eq(t.adminUsers.id, row.userId))
    .limit(1);

  if (user?.isActive !== true) {
    // Deactivating an account has to end its sessions, or it only stops the next login.
    await revokeFamily(context, row.familyId, now);
    throw new ApiProblem('unauthorized', 'Session ended');
  }

  await context.db
    .update(t.adminRefreshTokens)
    .set({ revokedAt: now })
    .where(eq(t.adminRefreshTokens.id, row.id));

  const refresh = await startFamily(context, user.id, now, row.familyId);

  return {
    user: present(user),
    identity: { id: user.id, role: user.role, siteScope: user.siteScope ?? null },
    refresh,
  };
}

/**
 * Logging out ends the family, not the row.
 *
 * The family is the session; revoking only the token in hand would leave the previous, already
 * rotated ones revoked and the next refresh impossible — which happens to work, but by accident.
 * This makes it deliberate, and it is what «log out everywhere» means for a single-browser tool.
 */
export async function logout(context: AuthContext, token: string | undefined): Promise<void> {
  if (token === undefined) return;
  const now = context.now ?? new Date();

  const [row] = await context.db
    .select({ familyId: t.adminRefreshTokens.familyId, userId: t.adminRefreshTokens.userId })
    .from(t.adminRefreshTokens)
    .where(eq(t.adminRefreshTokens.tokenHash, refreshDigest(token, context.refreshSecret)))
    .limit(1);

  if (row === undefined) return;

  await revokeFamily(context, row.familyId, now);
  await recordAudit(context.audit, {
    actorId: row.userId,
    action: 'logout',
    entity: 'admin_users',
    entityId: row.userId,
    ip: context.ip,
  });
}

async function startFamily(
  context: AuthContext,
  userId: number,
  now: Date,
  familyId?: string,
): Promise<IssuedRefreshToken> {
  const refresh = issueRefreshToken(context.refreshSecret, familyId);

  await context.db.insert(t.adminRefreshTokens).values({
    userId,
    tokenHash: refresh.digest,
    familyId: refresh.familyId,
    expiresAt: new Date(now.getTime() + context.refreshTtlDays * 86_400_000),
    ipHash: hashIp(context.ip, context.ipHashSecret),
    userAgent: context.userAgent?.slice(0, 255) ?? null,
  });

  return refresh;
}

async function revokeFamily(context: AuthContext, familyId: string, now: Date): Promise<void> {
  await context.db
    .update(t.adminRefreshTokens)
    .set({ revokedAt: now })
    .where(
      and(eq(t.adminRefreshTokens.familyId, familyId), isNull(t.adminRefreshTokens.revokedAt)),
    );
}
