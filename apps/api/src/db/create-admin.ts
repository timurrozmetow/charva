import { randomBytes } from 'node:crypto';

import {
  ADMIN_ROLES,
  ADMIN_SITE_SCOPES,
  type AdminRole,
  type AdminSiteScope,
} from '@charva/contracts';
import { eq } from 'drizzle-orm';
import mysql from 'mysql2/promise';

import { loadEnv } from '../env';
import { hashPassword } from '../lib/passwords';

import { createDb } from './client';
import * as t from './schema';

/**
 * The only way an admin account comes into existence.
 *
 * Deliberately not part of `db:seed`. A seeded account with a password printed in the
 * repository is a working login on every machine that ever ran the seeds, including whichever
 * one becomes production — and the value of the whole auth layer is bounded above by the
 * weakest way into it.
 *
 * There is no «forgot password» email either, and cannot be until question Q-11 chooses a
 * delivery channel. Until then this script is the recovery path: it runs where the database
 * already is, which is the same trust boundary a password reset would have needed anyway.
 *
 *   pnpm --filter @charva/api admin:create -- --email=a@b.tm --name="Имя" --role=owner
 *   pnpm --filter @charva/api admin:create -- --email=a@b.tm --reset
 */

/** Long enough that Argon2id's cost is the thing an attacker has to pay, not a dictionary. */
const MIN_PASSWORD_LENGTH = 12;

export interface CreateAdminInput {
  email: string;
  name: string;
  role: AdminRole;
  siteScope: AdminSiteScope | null;
  password: string;
  /** Update the password and reactivate an account that already exists. */
  reset: boolean;
}

export function parseArgs(argv: string[]): Partial<CreateAdminInput> & { help?: boolean } {
  const flags = new Map<string, string>();
  let help = false;

  for (const argument of argv) {
    if (argument === '--help' || argument === '-h') {
      help = true;
      continue;
    }
    const match = /^--([\w-]+)(?:=(.*))?$/.exec(argument);
    const name = match?.[1];
    if (name === undefined) continue;
    flags.set(name, match?.[2] ?? 'true');
  }

  const email = flags.get('email')?.trim().toLowerCase();
  const name = flags.get('name');
  const password = flags.get('password');
  const role = flags.get('role');
  const scope = flags.get('scope');

  if (role !== undefined && !(ADMIN_ROLES as readonly string[]).includes(role)) {
    throw new Error(`--role must be one of ${ADMIN_ROLES.join(', ')}`);
  }
  if (scope !== undefined && !(ADMIN_SITE_SCOPES as readonly string[]).includes(scope)) {
    throw new Error(`--scope must be one of ${ADMIN_SITE_SCOPES.join(', ')}, or left out for both`);
  }

  return {
    ...(email === undefined ? {} : { email }),
    ...(name === undefined ? {} : { name }),
    ...(role === undefined ? {} : { role: role as AdminRole }),
    ...(scope === undefined ? {} : { siteScope: scope as AdminSiteScope }),
    ...(password === undefined ? {} : { password }),
    reset: flags.has('reset'),
    help,
  };
}

/** Printed once and never stored anywhere this process can be asked for it again. */
export function generatePassword(): string {
  return randomBytes(18).toString('base64url');
}

export async function createAdmin(
  input: CreateAdminInput,
): Promise<{ id: number; created: boolean }> {
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`The password must be at least ${String(MIN_PASSWORD_LENGTH)} characters.`);
  }

  const env = loadEnv();
  const pool = mysql.createPool({ uri: env.DATABASE_URL, timezone: 'Z', connectionLimit: 2 });
  const db = createDb(pool);

  try {
    const [existing] = await db
      .select({ id: t.adminUsers.id })
      .from(t.adminUsers)
      .where(eq(t.adminUsers.email, input.email))
      .limit(1);

    const passwordHash = await hashPassword(input.password);

    if (existing !== undefined) {
      if (!input.reset) {
        throw new Error(`${input.email} already exists. Pass --reset to set a new password.`);
      }
      await db
        .update(t.adminUsers)
        .set({
          passwordHash,
          // A reset is also the unlock: the admin who locked themselves out is the one running
          // this, and leaving the counter set would lock them out again immediately.
          isActive: true,
          failedAttempts: 0,
          lockedUntil: null,
        })
        .where(eq(t.adminUsers.id, existing.id));

      return { id: existing.id, created: false };
    }

    const [result] = await db.insert(t.adminUsers).values({
      email: input.email,
      name: input.name,
      role: input.role,
      siteScope: input.siteScope,
      passwordHash,
    });

    return { id: result.insertId, created: true };
  } finally {
    await pool.end();
  }
}

const USAGE = `
Create or reset an admin account.

  --email=<address>     required
  --name=<name>         required when creating
  --role=<role>         ${ADMIN_ROLES.join(' | ')}   (default: editor)
  --scope=<site>        ${ADMIN_SITE_SCOPES.join(' | ')}   (default: both)
  --password=<secret>   at least ${String(MIN_PASSWORD_LENGTH)} characters; generated if omitted
  --reset               the account exists: set a new password, unlock and reactivate it
`;

if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help === true || parsed.email === undefined) {
    process.stdout.write(USAGE);
    process.exit(parsed.email === undefined && parsed.help !== true ? 1 : 0);
  }

  const generated = parsed.password === undefined;
  const password = parsed.password ?? generatePassword();

  const { id, created } = await createAdmin({
    email: parsed.email,
    name: parsed.name ?? parsed.email,
    role: parsed.role ?? 'editor',
    siteScope: parsed.siteScope ?? null,
    password,
    reset: parsed.reset ?? false,
  });

  process.stdout.write(
    `${created ? 'created' : 'reset'} ${parsed.email} (#${String(id)}) as ${parsed.role ?? 'editor'}\n`,
  );
  if (generated) {
    process.stdout.write(`password: ${password}\n\nIt is not stored anywhere. Copy it now.\n`);
  }
}
