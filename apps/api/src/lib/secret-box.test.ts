import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { constantTimeEqual, dedupeKey, hashIp } from './hash';
import { open, seal } from './secret-box';

/**
 * The most sensitive field in the system, and the two digests that stand in for a person.
 *
 * Decision D-18. The design handoff does not mention passport numbers once, and they are the
 * one thing here that would matter after a breach.
 */

const KEY = randomBytes(32).toString('hex');

describe('sealing a passport number', () => {
  it('comes back as it went in', () => {
    expect(open(seal('AB1234567', KEY), KEY)).toBe('AB1234567');
  });

  it('produces different ciphertext every time for the same number', () => {
    // A fresh nonce per value. Reusing one under the same key would make two identical passport
    // numbers visibly identical in the column, which is most of what encrypting them was for.
    expect(seal('AB1234567', KEY)).not.toBe(seal('AB1234567', KEY));
  });

  it('refuses a ciphertext somebody edited', () => {
    // GCM authenticates as well as encrypts, so tampering fails loudly rather than decrypting
    // to something else.
    const sealed = seal('AB1234567', KEY);
    const [nonce, tag, body = ''] = sealed.split('.');
    const flipped = Buffer.from(body, 'base64url');
    flipped[0] = (flipped[0] ?? 0) ^ 0xff;

    expect(() =>
      open(`${String(nonce)}.${String(tag)}.${flipped.toString('base64url')}`, KEY),
    ).toThrow();
  });

  it('refuses the wrong key rather than returning noise', () => {
    const sealed = seal('AB1234567', KEY);
    expect(() => open(sealed, randomBytes(32).toString('hex'))).toThrow();
  });

  it('refuses a malformed value', () => {
    for (const rubbish of ['', 'nope', 'a.b', 'a.b.c.d']) {
      expect(() => open(rubbish, KEY)).toThrow();
    }
  });

  it('handles the alphabets a Turkmen or Russian name is written in', () => {
    for (const value of ['I-АБ1234567', 'Ýazyjy 998877', '護照12345']) {
      expect(open(seal(value, KEY), KEY)).toBe(value);
    }
  });
});

describe('the two digests', () => {
  it('turns an address into something stable and not reversible by table', () => {
    const pepper = 'a-secret';
    expect(hashIp('203.0.113.5', pepper)).toBe(hashIp('203.0.113.5', pepper));
    expect(hashIp('203.0.113.5', pepper)).not.toBe(hashIp('203.0.113.6', pepper));
    // The pepper is what makes it more than a four-billion-row lookup.
    expect(hashIp('203.0.113.5', pepper)).not.toBe(hashIp('203.0.113.5', 'another-secret'));
  });

  it('keeps two intentions from one person apart', () => {
    // Asking about a tour and signing up for a pilgrimage are two genuine submissions, not a
    // repeat, so the endpoint is part of the key.
    expect(dedupeKey('global/leads', '+99365123456')).not.toBe(
      dedupeKey('umrah/signups', '+99365123456'),
    );
    expect(dedupeKey('global/leads', '+99365123456')).toBe(
      dedupeKey('global/leads', '+99365123456'),
    );
  });

  it('compares signatures without leaking where they diverged', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    // A length mismatch would make `timingSafeEqual` throw, which is itself the leak.
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });
});
