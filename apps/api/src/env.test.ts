import { describe, expect, it } from 'vitest';

import { loadEnv } from './env';

describe('loadEnv', () => {
  it('fills in defaults when nothing is set', () => {
    const env = loadEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(3002);
    expect(env.CORS_ORIGINS).toEqual([]);
  });

  it('splits and trims the CORS allowlist', () => {
    const env = loadEnv({ CORS_ORIGINS: 'http://a.test, http://b.test ,' });
    expect(env.CORS_ORIGINS).toEqual(['http://a.test', 'http://b.test']);
  });

  it('rejects a port that is not a port', () => {
    expect(() => loadEnv({ API_PORT: '70000' })).toThrow(/API_PORT/);
  });

  it('tolerates .env.example placeholders in development', () => {
    expect(() => loadEnv({ SOME_SECRET: 'replace_me' })).not.toThrow();
  });

  it('refuses to boot in production while placeholders remain', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', SOME_SECRET: 'replace_me' })).toThrow(
      /placeholders/,
    );
  });

  /**
   * The three secrets have development defaults so nothing has to be configured to clone the
   * repository and run it. A default secret in a public deploy is the same as no secret: the
   * form token would be forgeable by anyone with the source, and every passport number in the
   * database would be encrypted under a key printed in this file.
   */
  const REAL_SECRETS = {
    FORM_TOKEN_SECRET: 'a'.repeat(32),
    IP_HASH_SECRET: 'b'.repeat(32),
    PASSPORT_ENCRYPTION_KEY: 'ab'.repeat(32),
  };

  it('runs in development without a single secret configured', () => {
    const env = loadEnv({});
    expect(env.FORM_TOKEN_SECRET.length).toBeGreaterThan(15);
    expect(env.PASSPORT_ENCRYPTION_KEY).toMatch(/^[0-9a-f]{64}$/);
  });

  it('refuses to boot in production on a secret nobody chose', () => {
    for (const missing of Object.keys(REAL_SECRETS)) {
      const partial = Object.fromEntries(
        Object.entries(REAL_SECRETS).filter(([key]) => key !== missing),
      );

      expect(() => loadEnv({ NODE_ENV: 'production', ...partial }), missing).toThrow(
        new RegExp(missing),
      );
    }
  });

  it('boots in production once all three are set', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', ...REAL_SECRETS })).not.toThrow();
  });

  it('refuses an encryption key that is not thirty-two bytes', () => {
    // AES-256-GCM takes exactly 32 bytes. A short key is a crash at the first signup, in
    // production, on the most sensitive field in the system.
    expect(() => loadEnv({ PASSPORT_ENCRYPTION_KEY: 'too-short' })).toThrow(
      /PASSPORT_ENCRYPTION_KEY/,
    );
  });
});
