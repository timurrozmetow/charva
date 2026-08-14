import { type Database } from '../db/client';
import * as t from '../db/schema';

import { hashIp } from './hash';

/**
 * The action log.
 *
 * Every write from the admin lands here, and so does every read of a passport number — the
 * second half is decision D-18 and is the unusual one. «Who looked at it» is the question asked
 * after an incident, and it cannot be answered retroactively; either the row was written at the
 * time or the answer does not exist.
 *
 * Writing is deliberately best-effort: a failure to log must not turn a completed edit into an
 * error the editor sees, because that would mean the change happened and the response said it
 * did not. The failure is logged instead, and it is loud.
 */

export type AuditAction =
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'refresh_reuse'
  | 'create'
  | 'update'
  | 'delete'
  | 'reorder'
  | 'reveal_passport'
  | 'upload'
  | 'attach_slot';

export interface AuditEntry {
  actorId: number | null;
  action: AuditAction;
  /** Table or screen the action was about — `tours`, `admin_users`, `umrah_signups`. */
  entity: string;
  entityId?: string | number | null;
  before?: unknown;
  after?: unknown;
  ip?: string | undefined;
}

export interface AuditContext {
  db: Database;
  ipHashSecret: string;
  /** Where a failure to write the log goes. Never swallowed silently. */
  onError: (error: unknown) => void;
}

export async function recordAudit(context: AuditContext, entry: AuditEntry): Promise<void> {
  try {
    await context.db.insert(t.auditLog).values({
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId:
        entry.entityId === null || entry.entityId === undefined ? null : String(entry.entityId),
      before: entry.before ?? null,
      after: entry.after ?? null,
      ipHash: entry.ip === undefined ? null : hashIp(entry.ip, context.ipHashSecret),
    });
  } catch (error) {
    context.onError(error);
  }
}

/**
 * What actually changed, rather than both whole rows.
 *
 * A log storing every column of every edit is a log nobody reads: the one field that moved is
 * buried in forty that did not. Comparison is by JSON value, so a JSON column that was rewritten
 * with the same content does not count as a change.
 */
export function diffRows(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  let changed = false;

  for (const key of Object.keys(after)) {
    // `updatedAt` moves on every write by definition and says nothing about intent.
    if (key === 'updatedAt') continue;

    const left = before[key];
    const right = after[key];
    if (JSON.stringify(left ?? null) === JSON.stringify(right ?? null)) continue;

    changedBefore[key] = left ?? null;
    changedAfter[key] = right ?? null;
    changed = true;
  }

  return changed ? { before: changedBefore, after: changedAfter } : null;
}
