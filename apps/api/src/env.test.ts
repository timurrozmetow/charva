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
});
