import { describe, expect, it } from 'vitest';

import { DECOY_HASH, hashPassword, verifyPassword } from './passwords';

describe('password hashing', () => {
  it('is Argon2id at the OWASP parameters', async () => {
    const digest = await hashPassword('correct horse battery staple');

    /*
     * The parameters are read back out of the hash rather than out of the constant that produced
     * it, which is the only way this assertion means anything: `algorithm` is written as the
     * number 2 because `verbatimModuleSyntax` cannot import an ambient const enum, and a wrong
     * number would silently select Argon2d — a variant that is not the one to use on passwords.
     */
    expect(digest).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it('salts, so the same password twice gives two different hashes', async () => {
    const [first, second] = await Promise.all([hashPassword('same'), hashPassword('same')]);
    expect(first).not.toBe(second);
    expect(await verifyPassword(first, 'same')).toBe(true);
    expect(await verifyPassword(second, 'same')).toBe(true);
  });

  it('answers false for the wrong password', async () => {
    const digest = await hashPassword('right');
    expect(await verifyPassword(digest, 'wrong')).toBe(false);
  });

  it('answers false rather than throwing on a hash it cannot parse', async () => {
    // A truncated or hand-edited column should fail the login, not take the process down.
    expect(await verifyPassword('not-a-hash', 'anything')).toBe(false);
    expect(await verifyPassword('', '')).toBe(false);
  });

  it('has a decoy to verify against when the address is unknown', async () => {
    const decoy = await DECOY_HASH;
    expect(decoy).toMatch(/^\$argon2id\$/);
    // Nobody can present the bytes behind it, so the comparison always fails — and always costs
    // the same fifty milliseconds a real one does, which is the entire point.
    expect(await verifyPassword(decoy, 'decoy')).toBe(false);
  });
});
