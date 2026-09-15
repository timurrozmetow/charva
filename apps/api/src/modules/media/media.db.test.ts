import { createHash } from 'node:crypto';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { IMAGE_WIDTHS } from '@charva/contracts';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { API_PREFIX } from '../../app';
import { buildTestApp, problem, type TestApp } from '../../test/app';

import { DERIVATIVE, DERIVATIVE_TAG } from './routes';

/**
 * Images: the originals, and derivatives made on request.
 *
 * There are no photographs at all yet (question Q-1), so this suite makes one. That is not a
 * shortcut: the resize path has to be proven before phase 7 starts uploading through it, and a
 * generated square exercises exactly the same code a photograph would.
 */

let context: TestApp;
let uploadsRoot: string;

const KEY = '2026/08/test-fixture.png';

beforeAll(async () => {
  context = await buildTestApp();
  uploadsRoot = join(process.cwd(), context.app.env.UPLOADS_DIR);

  await mkdir(join(uploadsRoot, '2026/08'), { recursive: true });
  const png = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: { r: 200, g: 170, b: 120 } },
  })
    .png()
    .toBuffer();
  await writeFile(join(uploadsRoot, KEY), png);
}, 60_000);

afterAll(async () => {
  await rm(join(uploadsRoot, KEY), { force: true });
  await context.close();
});

describe('GET /img', () => {
  it('resizes to a requested width and answers WebP', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/img/${KEY}?w=480`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/webp');

    const meta = await sharp(response.rawPayload).metadata();
    expect(meta.width).toBe(480);
    expect(meta.format).toBe('webp');
  });

  it('serves the second request from disk, byte for byte', async () => {
    // The cost of a width is paid once per image, not once per request.
    const url = `${API_PREFIX}/img/${KEY}?w=640`;
    const first = await context.app.inject({ method: 'GET', url });
    const second = await context.app.inject({ method: 'GET', url });

    expect(second.statusCode).toBe(200);
    expect(second.rawPayload.equals(first.rawPayload)).toBe(true);
  });

  it('marks derivatives immutable, because the key changes when the picture does', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/img/${KEY}?w=320`,
    });
    expect(response.headers['cache-control']).toContain('immutable');
  });

  it('accepts every width the client will ever ask for, and nothing else', async () => {
    /*
     * The list is shared with `Img`, which builds its `srcSet` from it. Two copies would drift
     * the day somebody adds a breakpoint, and the symptom is one broken image size at one
     * viewport width. Without the ceiling, `?w=100000` asks a server with no GPU for a
     * forty-gigabyte bitmap — a denial of service that fits in a URL.
     */
    for (const width of IMAGE_WIDTHS) {
      const response = await context.app.inject({
        method: 'GET',
        url: `${API_PREFIX}/img/${KEY}?w=${String(width)}`,
      });
      expect(response.statusCode, `w=${String(width)}`).toBe(200);
    }

    for (const width of [1, 481, 100_000, -320]) {
      const response = await context.app.inject({
        method: 'GET',
        url: `${API_PREFIX}/img/${KEY}?w=${String(width)}`,
      });
      expect(response.statusCode, `w=${String(width)}`).toBe(400);
    }
  });

  it('will not upscale a small original into a larger, blurrier file', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/img/${KEY}?w=2048`,
    });

    const meta = await sharp(response.rawPayload).metadata();
    expect(meta.width).toBe(1200);
  });

  it('refuses to walk out of the uploads directory', async () => {
    // A wildcard route is precisely where this gets attempted, and comparing resolved paths is
    // the check that holds — looking for `..` in the string is defeated by decoding.
    for (const attempt of [
      '../../../etc/passwd',
      '..%2f..%2f..%2fetc%2fpasswd',
      '....//....//package.json',
    ]) {
      const response = await context.app.inject({
        method: 'GET',
        url: `${API_PREFIX}/img/${attempt}?w=320`,
      });
      expect([400, 404], attempt).toContain(response.statusCode);
      expect(response.body).not.toContain('root:');
    }
  });

  it('404s a key with no file, in the single error envelope', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/img/2026/08/nothing-here.webp?w=320`,
    });

    expect(response.statusCode).toBe(404);
    expect(problem(response).error.code).toBe('not_found');
  });

  it('requires a width rather than guessing one', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/img/${KEY}`,
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('GET /uploads', () => {
  it('serves the original as stored', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: `${API_PREFIX}/uploads/${KEY}`,
    });

    expect(response.statusCode).toBe(200);
    const meta = await sharp(response.rawPayload).metadata();
    expect(meta.width).toBe(1200);
    expect(meta.format).toBe('png');
  });
});

describe('the derivative cache remembers how it was encoded', () => {
  it('names the file after the settings, not only the picture and the width', async () => {
    /*
     * The bug this replaces: the name was `sha256(key|width)`, so the file on disk outlived the
     * settings that produced it. Changing the quality would have changed nothing anybody could
     * see — the old file is found and returned, with a year of `immutable` on it, and the site
     * serves two encodings at once with no way to tell them apart. A setting that cannot be
     * changed is not a setting.
     *
     * Asserted both ways round, because only the negative half proves the tag is load-bearing.
     */
    const width = 960;

    const name = (material: string) =>
      join(
        uploadsRoot,
        '.cache',
        `${createHash('sha256').update(material).digest('hex').slice(0, 24)}.webp`,
      );

    const withTag = name(`${KEY}|${String(width)}|${DERIVATIVE_TAG}`);
    const withoutTag = name(`${KEY}|${String(width)}`);

    // Both candidates are cleared first, because the cache outlives a test run by design — and
    // the first time this ran it failed on a file the *old* code had left there weeks earlier,
    // which is the hazard stated rather more plainly than intended.
    await rm(withTag, { force: true });
    await rm(withoutTag, { force: true });

    await context.app.inject({ method: 'GET', url: `${API_PREFIX}/img/${KEY}?w=${String(width)}` });

    await expect(stat(withTag)).resolves.toBeDefined();
    await expect(stat(withoutTag)).rejects.toThrow();
  });

  it('encodes at an effort above sharp’s default, because the result is kept', () => {
    // Seven percent smaller at identical quality. An upload is an editor waiting at a progress
    // bar; a derivative is written once and read for a year, so the extra second is free here
    // in a way it is not there.
    expect(DERIVATIVE.effort).toBeGreaterThan(4);
  });
});
