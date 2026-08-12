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

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

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
});

export type Env = z.infer<typeof schema>;

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
  }

  return env;
}
