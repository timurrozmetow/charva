import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * Environment loading and validation.
 *
 * The schema grows one phase at a time and only ever describes variables the code actually
 * reads — a variable nobody consumes is a stub by CLAUDE.md's rule. Database, mail and auth
 * settings arrive with the phases that use them.
 *
 * Placeholder values are accepted in development and refused under `NODE_ENV=production`, so a
 * half-configured deploy fails at boot rather than at the first request.
 */

loadDotenv({ path: new URL('../../../.env', import.meta.url), quiet: true });

const PLACEHOLDER = /replace[-_]me/i;

/**
 * Development stand-ins for the three secrets.
 *
 * They exist so that nothing has to be configured to clone the repository and run it, and they
 * are named here rather than inline so the production guard can recognise them: a value equal
 * to one of these is a value nobody chose.
 */
const DEV_SECRETS = {
  FORM_TOKEN_SECRET: 'charva-dev-only-form-token-secret',
  IP_HASH_SECRET: 'charva-dev-only-ip-hash-secret',
  PASSPORT_ENCRYPTION_KEY: '00'.repeat(32),
  ADMIN_JWT_SECRET: 'charva-dev-only-admin-jwt-secret',
  ADMIN_REFRESH_SECRET: 'charva-dev-only-admin-refresh-secret',
} as const;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // `silent` is what the test suite uses: an API test that prints a request log per assertion
  // buries the one line that matters when something fails.
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  API_HOST: z.string().min(1).default('0.0.0.0'),
  // 3002, not the usual 3001: the silkgrain project on this machine owns 3001. See CLAUDE.md.
  API_PORT: z.coerce.number().int().positive().max(65535).default(3002),

  /** Comma-separated origin allowlist. Never `*` — cookies are involved on the admin host. */
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),

  /**
   * MySQL 8 on 3308 — not 3306, which XAMPP holds, and not 3307, which silkgrain holds.
   *
   * A URL rather than five separate variables, because it is one string to paste into a
   * client, one thing to get wrong, and the shape the hosting provider will hand over.
   */
  DATABASE_URL: z.string().url().default('mysql://root:charva_dev_only@127.0.0.1:3308/charva'),

  /**
   * The schema the destructive scripts are allowed to touch.
   *
   * `db:reset` drops and recreates a database; there are seven other schemas on this machine
   * belonging to three other projects, and the guard is a prefix match against this value.
   */
  DATABASE_NAME_PREFIX: z.string().min(1).default('charva'),

  DATABASE_POOL_SIZE: z.coerce.number().int().positive().max(50).default(10),

  /**
   * Where uploaded media lives on disk.
   *
   * A directory rather than a bucket — decision D-8. `media.storage_key` holds a key relative
   * to this, so moving to object storage later replaces one adapter instead of rewriting every
   * row that ever referenced a file.
   */
  UPLOADS_DIR: z.string().min(1).default('uploads'),

  /**
   * The origin `/img` URLs are built against.
   *
   * Empty means "same origin as the API", which is what development wants. In production it is
   * the API host, so a URL survives being copied out of a response into an OG tag.
   */
  PUBLIC_MEDIA_BASE_URL: z.string().default(''),

  /**
   * The two video binaries.
   *
   * Bare names by default, which is what `apt install ffmpeg` gives a VPS. On this machine
   * there is no Docker and no admin right, so `pnpm setup:services` unpacks a portable copy
   * under `.services/` and `lib/ffmpeg.ts` finds it without either of these being set.
   */
  FFMPEG_PATH: z.string().min(1).default('ffmpeg'),
  FFPROBE_PATH: z.string().min(1).default('ffprobe'),

  /**
   * Upload ceilings, in megabytes.
   *
   * Two of them because they defend against different things: a photograph over twenty
   * megabytes is a mistake, while a video of that size is a short clip. Both are enforced by
   * the multipart parser, before anything is written to disk.
   */
  MAX_IMAGE_UPLOAD_MB: z.coerce.number().int().positive().max(200).default(20),
  MAX_VIDEO_UPLOAD_MB: z.coerce.number().int().positive().max(4096).default(400),

  /**
   * Where the built SPAs live, for the shell to read their `index.html` from.
   *
   * Empty means the monorepo layout — `apps/web-<site>/dist` relative to the API's working
   * directory — which is what both a local `pnpm build` and the VPS deploy produce. A value
   * points at a directory holding `web-choice/`, `web-global/` and `web-umrah/`.
   */
  SHELL_DIST_DIR: z.string().default(''),

  /** How long a public GET stays in the in-process cache. Sixty seconds — decision D-7. */
  CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(3600).default(60),

  /**
   * Anti-spam, first layer: how many form submissions one address may make, and over what
   * window. Five per ten minutes — a form that receives single digits of genuine traffic a day.
   */
  LEAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().max(1000).default(5),
  LEAD_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().max(1440).default(10),

  /** The ceiling on ordinary reads. Generous: it exists to stop a scraper, not a visitor. */
  READ_RATE_LIMIT_MAX: z.coerce.number().int().positive().max(100_000).default(300),

  /**
   * Signs the form token that carries the moment a form was rendered — anti-spam layer three.
   *
   * The signature is the whole mechanism: it lets the server trust a timestamp it did not
   * store, so the time trap needs neither a session, a cookie nor a table. See `form-token.ts`.
   */
  FORM_TOKEN_SECRET: z.string().min(16).default(DEV_SECRETS.FORM_TOKEN_SECRET),

  /**
   * Pepper for hashed IP addresses.
   *
   * A bare SHA-256 of an IPv4 address is not anonymisation: there are four billion of them and
   * a rainbow table takes minutes to build. With a secret pepper the digest is useful for
   * counting and useless for identifying.
   */
  IP_HASH_SECRET: z.string().min(16).default(DEV_SECRETS.IP_HASH_SECRET),

  /**
   * AES-256-GCM key for passport numbers — decision D-18, 32 bytes as 64 hex characters.
   *
   * The most sensitive column in the system. The default below is development-only and refused
   * in production by the check at the bottom of this file.
   */
  PASSPORT_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'must be 32 bytes as 64 hex characters')
    .default(DEV_SECRETS.PASSPORT_ENCRYPTION_KEY),

  /**
   * Signs the fifteen-minute admin access token.
   *
   * Separate from `FORM_TOKEN_SECRET` on purpose: those two sign things with wildly different
   * consequences, and one key signing both means a weakness in the cheap public one is a
   * weakness in the session.
   */
  ADMIN_JWT_SECRET: z.string().min(16).default(DEV_SECRETS.ADMIN_JWT_SECRET),

  /**
   * Peppers the refresh-token digest.
   *
   * The refresh token is 48 random bytes and is stored only as an HMAC of itself, so a dump of
   * `admin_refresh_tokens` is not a set of working sessions — the attacker also needs this.
   */
  ADMIN_REFRESH_SECRET: z.string().min(16).default(DEV_SECRETS.ADMIN_REFRESH_SECRET),

  /** How long an access token is good for. Short, because it cannot be revoked. */
  ADMIN_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().max(1440).default(15),

  /**
   * How long a refresh family may live before the admin logs in again.
   *
   * Thirty days, rotated on every use: the useful window of a stolen cookie is until its owner's
   * browser next refreshes, because that is when reuse is detected and the family dies.
   */
  ADMIN_REFRESH_TTL_DAYS: z.coerce.number().int().positive().max(365).default(30),

  /** Failed attempts before the account locks, and for how long. */
  ADMIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().positive().max(100).default(5),
  ADMIN_LOCK_MINUTES: z.coerce.number().int().positive().max(1440).default(15),

  /**
   * The ceiling on login attempts from one address, over ten minutes.
   *
   * The per-account lock above stops a password being guessed; this stops one address working
   * through a list of accounts, which the lock alone would happily allow.
   */
  ADMIN_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().max(1000).default(10),
});

export type Env = z.infer<typeof schema>;

/**
 * Secrets that must be chosen rather than inherited.
 *
 * Each has a development default so nothing has to be configured to run the project locally,
 * and each is refused in production, because a default secret in a public deploy is the same
 * as no secret at all.
 */
const PRODUCTION_SECRETS = Object.keys(DEV_SECRETS) as (keyof typeof DEV_SECRETS)[];

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }

  const env = parsed.data;

  if (env.NODE_ENV === 'production') {
    const unset = Object.entries(source)
      .filter(([, value]) => typeof value === 'string' && PLACEHOLDER.test(value))
      .map(([key]) => key);

    if (unset.length > 0) {
      throw new Error(
        `Refusing to start in production with .env.example placeholders still in place: ${unset.join(', ')}`,
      );
    }

    // A default secret is not a secret. Absent from `source` means the schema default applied.
    const defaulted = PRODUCTION_SECRETS.filter((key) => {
      const value = source[key];
      return value === undefined || value.trim() === '' || value === DEV_SECRETS[key];
    });

    if (defaulted.length > 0) {
      throw new Error(
        `Refusing to start in production without these secrets set: ${defaulted.join(', ')}\n` +
          'Generate each with:  node -e "console.log(crypto.randomBytes(32).toString(\'hex\'))"',
      );
    }
  }

  return env;
}
