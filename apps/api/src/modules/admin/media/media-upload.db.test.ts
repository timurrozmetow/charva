import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { type AdminSlot } from '@charva/contracts';
import { eq } from 'drizzle-orm';
import { type LightMyRequestResponse } from 'fastify';
import FormData from 'form-data';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as t from '../../../db/schema';
import { ffmpegAvailable, resolveBinary } from '../../../lib/ffmpeg';
import { buildTestApp, problem, type TestApp } from '../../../test/app';

/**
 * The upload path, end to end, against the real converter and the real database.
 *
 * The EXIF assertion is the one that matters most and it is the one nobody would notice failing:
 * these are photographs of pilgrims, EXIF carries GPS, and a page that publishes the coordinates
 * of somebody's home does it silently and stays wrong until a stranger points it out.
 */

const run = promisify(execFile);

let context: TestApp;
let hasFfmpeg = false;
let scratch: string;

beforeAll(async () => {
  context = await buildTestApp();
  hasFfmpeg = await ffmpegAvailable('ffmpeg', 'ffprobe');
  scratch = await mkdtemp(join(tmpdir(), 'charva-media-test-'));
}, 120_000);

afterAll(async () => {
  await context.close();
  await rm(scratch, { recursive: true, force: true });
});

/**
 * A photograph that carries EXIF.
 *
 * Built rather than committed as a fixture, so the test cannot start passing against a file
 * somebody quietly replaced with one that had no metadata to strip in the first place. The tags
 * written here are the ones sharp's API exposes; what matters is that *some* EXIF goes in, since
 * the converter drops the block wholesale rather than tag by tag — the GPS coordinates a phone
 * writes leave by the same door as the copyright line below.
 */
async function jpegWithExif(width = 3200, height = 2000): Promise<Buffer> {
  const bytes = await sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 90, b: 70 } },
  })
    .withExif({ IFD0: { Copyright: 'Charva Travel', Software: 'a phone' } })
    .jpeg()
    .toBuffer();

  // If this ever stops being true the test above proves nothing, so it is checked here.
  expect((await sharp(bytes).metadata()).exif, 'the fixture carries no EXIF').toBeDefined();
  return bytes;
}

function upload(bytes: Buffer, filename: string, token?: string): Promise<LightMyRequestResponse> {
  const form = new FormData();
  form.append('file', bytes, { filename });

  return context.app.inject({
    method: 'POST',
    url: `${context.prefix}/admin/media`,
    headers: {
      ...form.getHeaders(),
      authorization: `Bearer ${token ?? context.admin.accessToken}`,
    },
    payload: form.getBuffer(),
  });
}

function call(
  method: 'GET' | 'PATCH' | 'PUT' | 'DELETE',
  url: string,
  payload?: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return context.app.inject({
    method,
    url: `${context.prefix}/admin${url}`,
    headers: { authorization: `Bearer ${context.admin.accessToken}` },
    ...(payload === undefined ? {} : { payload }),
  });
}

interface UploadBody {
  media: {
    id: number;
    mime: string;
    width: number | null;
    storageKey: string;
    lqip: string | null;
  };
  poster: { id: number; mime: string } | null;
  isDuplicate: boolean;
}

describe('uploading a photograph', () => {
  it('converts it, and leaves no EXIF behind', async () => {
    const response = await upload(await jpegWithExif(), 'pilgrims.jpg');
    expect(response.statusCode, response.body).toBe(201);

    const body = response.json<UploadBody>();
    expect(body.media.mime).toBe('image/webp');
    // 3200 wide in, 2560 out: nothing on any page needs the original, and a hero at full size
    // is a megabyte somebody in Ashgabat pays for.
    expect(body.media.width).toBe(2560);
    expect(body.media.lqip).toMatch(/^data:image\/webp;base64,/);

    const stored = await readFile(
      join(process.cwd(), context.app.env.UPLOADS_DIR, body.media.storageKey),
    );
    const metadata = await sharp(stored).metadata();

    // The whole point. `rotate()` applies the orientation and drops the block that stated it,
    // and sharp writes no metadata unless asked — so there is nothing here to publish.
    expect(metadata.exif).toBeUndefined();
    expect(metadata.format).toBe('webp');
  });

  it('stores the same file twice as one row', async () => {
    const bytes = await jpegWithExif(800, 600);

    const first = (await upload(bytes, 'twice.jpg')).json<UploadBody>();
    const second = (await upload(bytes, 'renamed.jpg')).json<UploadBody>();

    // The same photograph will be attached to a tour, a gallery tile and an OG card. Refusing
    // the second upload would send the editor hunting for the first by hand.
    expect(second.isDuplicate).toBe(true);
    expect(second.media.id).toBe(first.media.id);
  });

  it('refuses a script whatever it is called', async () => {
    const response = await upload(Buffer.from('<?php system($_GET[0]); ?>'), 'photo.jpg');

    expect(response.statusCode).toBe(415);
    expect(problem(response).error.code).toBe('unsupported_media');
  });

  it('refuses an account without the capability', async () => {
    const manager = context.app.signAccessToken({ id: 9101, role: 'manager', siteScope: null });
    const response = await upload(await jpegWithExif(320, 240), 'nope.jpg', manager.token);
    expect(response.statusCode).toBe(403);
  });
});

describe('the library', () => {
  it('lists what has been uploaded, newest first', async () => {
    await upload(await jpegWithExif(640, 480), 'listed.jpg');

    const response = await call('GET', '/media?perPage=5&kind=image');
    expect(response.statusCode).toBe(200);

    const body = response.json<{ items: { mime: string }[]; meta: { total: number } }>();
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.items.every((item) => item.mime.startsWith('image/'))).toBe(true);
  });

  it('takes alternative text per language', async () => {
    const uploaded = (await upload(await jpegWithExif(300, 200), 'alt.jpg')).json<UploadBody>();

    const response = await call('PATCH', `/media/${String(uploaded.media.id)}`, {
      alt: { ru: 'Дюны на закате', en: 'Dunes at sunset' },
      focalX: 500,
      focalY: 300,
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ alt: Record<string, string> }>().alt['en']).toBe('Dunes at sunset');
  });

  it('will not delete a file something still points at', async () => {
    const uploaded = (await upload(await jpegWithExif(310, 210), 'used.jpg')).json<UploadBody>();

    const [slot] = await context.app.db.select().from(t.contentSlots).limit(1);
    expect(slot).toBeDefined();

    await call('PUT', `/content_slots/${String(slot!.id)}/media`, { mediaId: uploaded.media.id });

    const refused = await call('DELETE', `/media/${String(uploaded.media.id)}`);
    // A dangling media_id renders as a hole on a public page, and the person deleting it is the
    // only one who knows whether that page still needs a picture.
    expect(refused.statusCode).toBe(409);

    await call('PUT', `/content_slots/${String(slot!.id)}/media`, { mediaId: null });
    expect((await call('DELETE', `/media/${String(uploaded.media.id)}`)).statusCode).toBe(200);
  });
});

describe('the photograph checklist', () => {
  it('counts how far off Q-1 is', async () => {
    const response = await call('GET', '/content_slots?perPage=200&site=umrah');
    expect(response.statusCode, response.body).toBe(200);

    const body = response.json<{
      items: AdminSlot[];
      progress: { filled: number; total: number };
    }>();

    expect(body.progress.total).toBeGreaterThan(20);
    // Every slot carries the art direction copied out of the prototype, which is what makes the
    // screen a brief rather than a list of empty boxes.
    expect(body.items.every((slot) => slot.brief.length > 0)).toBe(true);
    expect(body.items.every((slot) => slot.site === 'umrah')).toBe(true);
  });

  it('fills a slot and empties it again', async () => {
    const uploaded = (await upload(await jpegWithExif(320, 240), 'slot.jpg')).json<UploadBody>();
    const [slot] = await context.app.db
      .select()
      .from(t.contentSlots)
      .where(eq(t.contentSlots.site, 'global'))
      .limit(1);

    expect(
      (
        await call('PUT', `/content_slots/${String(slot!.id)}/media`, {
          mediaId: uploaded.media.id,
        })
      ).statusCode,
    ).toBe(200);

    const filled = (await call('GET', `/content_slots?perPage=200&site=global`)).json<{
      items: AdminSlot[];
    }>();

    expect(filled.items.find((item) => item.id === slot!.id)?.media?.id).toBe(uploaded.media.id);

    await call('PUT', `/content_slots/${String(slot!.id)}/media`, { mediaId: null });
  });
});

describe('uploading a video', () => {
  it('transcodes it and makes a poster, or says plainly that ffmpeg is missing', async () => {
    const source = join(scratch, 'clip.mp4');

    if (!hasFfmpeg) {
      // Not skipped silently: the refusal is a real behaviour and worth asserting on a machine
      // that cannot do the rest of this test.
      const response = await upload(Buffer.from('ftyp'), 'clip.mp4');
      expect(response.statusCode).toBe(415);
      return;
    }

    await run(resolveBinary('ffmpeg', 'ffmpeg'), [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=duration=2:size=640x360:rate=10',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      source,
    ]);

    const response = await upload(await readFile(source), 'clip.mp4');
    expect(response.statusCode, response.body).toBe(201);

    const body = response.json<UploadBody & { media: { durationSec: number | null } }>();
    expect(body.media.mime).toBe('video/mp4');
    // Read from the file rather than typed by hand — the prototype's «6:12» had already drifted
    // from the clip it described.
    expect(body.media.durationSec).toBe(2);
    // The frame a player shows before it is pressed, as its own row, because `videos.poster_
    // media_id` has to point at something addressable.
    expect(body.poster?.mime).toBe('image/webp');
  }, 180_000);
});
