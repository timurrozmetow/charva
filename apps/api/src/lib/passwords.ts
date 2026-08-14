import { hash, verify } from '@node-rs/argon2';

/**
 * Password hashing, in one place.
 *
 * Argon2id at the OWASP parameters — 19 MiB, two passes, one lane — and never bcrypt, which
 * caps the work factor at a memory footprint a GPU does not notice. `@node-rs/argon2` ships
 * prebuilt NAPI binaries, which is what makes it installable on this Windows machine without a
 * compiler; it is in `onlyBuiltDependencies` for that reason.
 *
 * The parameters live inside the resulting hash string (`$argon2id$v=19$m=19456,t=2,p=1$…`), so
 * raising them later verifies old passwords with their old cost and stores new ones with the
 * new one. Nothing here needs to know which era a hash came from.
 */

/**
 * `Algorithm.Argon2id` written as its value.
 *
 * `@node-rs/argon2` declares `Algorithm` as an ambient `const enum`, and `verbatimModuleSyntax`
 * — on across this repo — refuses to import one, because a const enum is erased at compile time
 * and there would be nothing left to import at runtime. The number is stable: it is part of the
 * Argon2 specification, and it is echoed back in every hash string as `$argon2id$`, which the
 * test asserts.
 */
const ARGON2ID = 2;

const OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  algorithm: ARGON2ID,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

/**
 * Verify, answering false rather than throwing on a hash it cannot parse.
 *
 * A row whose `password_hash` was truncated or hand-edited should fail the login, not take the
 * process down — and the caller has no better answer to give than "no" in either case.
 */
export async function verifyPassword(digest: string, plain: string): Promise<boolean> {
  try {
    return await verify(digest, plain);
  } catch {
    return false;
  }
}

/**
 * A hash of nothing anybody knows, verified against when the email does not exist.
 *
 * Without it, a login for an unknown address returns in microseconds while a real one spends
 * ~50 ms in Argon2, and the difference is measurable over a handful of requests: an attacker
 * learns which addresses have accounts before guessing a single password. Computed once at
 * module load, from bytes nobody can present.
 */
export const DECOY_HASH: Promise<string> = hash(
  `decoy-${Math.random().toString(36)}-${String(process.pid)}`,
  OPTIONS,
);
