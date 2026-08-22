import { type ApiError } from '@charva/contracts';
import { eq } from 'drizzle-orm';
import { type FastifyInstance, type LightMyRequestResponse } from 'fastify';
import mysql from 'mysql2/promise';

import { API_PREFIX, buildApp } from '../app';
import { createDb } from '../db/client';
import * as t from '../db/schema';
import { seedAll, SEEDED_TABLES } from '../db/seed/seed';
import { TEST_DATABASE_URL } from '../db/test-setup';
import { loadEnv } from '../env';
import { issueFormToken } from '../lib/form-token';
import { hashPassword } from '../lib/passwords';

/**
 * One app, one pool, against the real `charva_test`.
 *
 * Against MySQL and not a mock, for the same reason the phase-2 suites are: `STRICT_TRANS_TABLES`,
 * `JSON_SCHEMA_VALID`, the generated column carrying the UNIQUE on the current departure and
 * every CHECK exist only in the database. A test against a fake proves what the fake does.
 */

export interface TestAdmin {
  id: number;
  email: string;
  password: string;
  /** A signed access token for this account, ready to put in an `Authorization` header. */
  accessToken: string;
}

export interface TestApp {
  app: FastifyInstance;
  pool: mysql.Pool;
  prefix: string;
  /**
   * An owner account, so the contract walk can reach routes behind the login.
   *
   * Owner rather than editor on purpose: the walk asserts that every route answers, and an
   * account without a capability would make a 403 look like a route that works.
   */
  admin: TestAdmin;
  /**
   * A real slug per detail route, read from the seeds.
   *
   * So that the contract test can walk `/…/:slug` routes without a hand-kept fixture list going
   * stale — the failure mode there is a route that quietly stops being tested.
   */
  discoveredSlugs: Map<string, string>;
  close: () => Promise<void>;
}

/**
 * Seeds only if the catalogue is not already there.
 *
 * The suites share one schema and run sequentially, and two of them delete rows for their own
 * purposes. Checking for the nine tours rather than for "any row at all" is what stops a
 * leftover from the constraints suite being mistaken for a seeded database.
 */
async function ensureSeeded(pool: mysql.Pool): Promise<void> {
  const db = createDb(pool);
  const tours = await db.select({ id: t.tours.id }).from(t.tours).limit(1);
  if (tours.length > 0) return;

  for (const table of SEEDED_TABLES) {
    await pool.query(`DELETE FROM \`${table}\``);
  }

  await seedAll(db);
}

export interface TestAppOptions {
  /** Zero turns the response cache off, which most suites want so a fixture edit takes effect. */
  cacheTtlSeconds?: number;
  /** Raised by suites that make many requests and are not testing the limiter. */
  readRateLimitMax?: number;
}

export async function buildTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const pool = mysql.createPool({
    uri: TEST_DATABASE_URL,
    timezone: 'Z',
    connectionLimit: 5,
    supportBigNumbers: true,
    bigNumberStrings: false,
  });

  await ensureSeeded(pool);

  const env = loadEnv({
    ...process.env,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: TEST_DATABASE_URL,
    CACHE_TTL_SECONDS: String(options.cacheTtlSeconds ?? 0),
    READ_RATE_LIMIT_MAX: String(options.readRateLimitMax ?? 10_000),
    CORS_ORIGINS: 'http://localhost:5181',
  });

  const app = await buildApp(env, { pool });

  return {
    app,
    pool,
    prefix: API_PREFIX,
    admin: await ensureTestAdmin(app),
    discoveredSlugs: await discoverSlugs(pool),
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}

/**
 * The account the suites log in as.
 *
 * Recreated rather than reused, because two suites running one after another share the schema
 * and the second would otherwise inherit whatever the first did to the row — a lock, a bumped
 * failure counter, a deactivation. The password is hashed with the real parameters, so a suite
 * that logs in exercises the real cost.
 */
async function ensureTestAdmin(app: FastifyInstance): Promise<TestAdmin> {
  const email = 'owner@charva.test';
  const password = 'test-owner-password';

  await app.db.delete(t.adminUsers).where(eq(t.adminUsers.email, email));

  const [result] = await app.db.insert(t.adminUsers).values({
    email,
    name: 'Test Owner',
    role: 'owner',
    passwordHash: await hashPassword(password),
  });

  const { token } = app.signAccessToken({ id: result.insertId, role: 'owner', siteScope: null });
  return { id: result.insertId, email, password, accessToken: token };
}

/** One published slug per detail route, straight from the tables the routes read. */
async function discoverSlugs(pool: mysql.Pool): Promise<Map<string, string>> {
  const db = createDb(pool);

  const [tours, hotels, articles, places, groups] = await Promise.all([
    db.select({ slug: t.tours.slug }).from(t.tours).limit(1),
    db.select({ slug: t.hotels.slug }).from(t.hotels).limit(1),
    db.select({ slug: t.articles.slug }).from(t.articles).limit(1),
    db.select({ slug: t.ziyaratPlaces.slug }).from(t.ziyaratPlaces).limit(1),
    db.select({ slug: t.umrahGroups.slug }).from(t.umrahGroups).limit(1),
  ]);

  const found = new Map<string, string>();
  const add = (pattern: string, rows: { slug: string }[]): void => {
    const slug = rows[0]?.slug;
    if (slug !== undefined) found.set(pattern, slug);
  };

  add(`${API_PREFIX}/global/tours/:slug`, tours);
  add(`${API_PREFIX}/global/hotels/:slug`, hotels);
  add(`${API_PREFIX}/global/articles/:slug`, articles);
  add(`${API_PREFIX}/umrah/ziyarat/:slug`, places);
  add(`${API_PREFIX}/umrah/groups/:slug`, groups);

  return found;
}

/**
 * The single error envelope, which every failure in this API is shaped like.
 *
 * `response.json()` is `any`, and reading fields off an `any` is how a test keeps passing after
 * the shape it was written against changed underneath it: the assertion still runs, it just no
 * longer means anything. Elsewhere the tests call `response.json<Shape>()` directly.
 */
export function problem(response: LightMyRequestResponse): ApiError {
  return response.json<ApiError>();
}

/**
 * A form token that is already old enough to pass the three-second trap.
 *
 * The trap is a real defence and the tests should not weaken it to get past it, so they age the
 * token instead — the same thing a person filling in a form does.
 */
export function agedFormToken(app: FastifyInstance, secondsAgo = 10): string {
  // Issued for a moment in the past, then signed exactly as `issueFormToken` signs.
  return issueFormToken(app.env.FORM_TOKEN_SECRET, Date.now() - secondsAgo * 1000).token;
}
