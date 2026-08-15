import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';

import { eq } from 'drizzle-orm';
import sharp from 'sharp';

import { type Database } from '../../../db/client';
import * as t from '../../../db/schema';
import { type AuditContext, recordAudit } from '../../../lib/audit';
import { extractPoster, ffmpegAvailable, probeVideo, transcode720p } from '../../../lib/ffmpeg';
import { acceptedTypes, detectType } from '../../../lib/magic-bytes';
import { type AdminIdentity } from '../../../plugins/admin-auth';
import { ApiProblem } from '../../../plugins/error-handler';

/**
 * Everything that happens between a file leaving a browser and a row appearing in `media`.
 *
 * Four rules, and each is here because the alternative is a real failure:
 *
 *   — the type is read from the bytes, never from what the browser said it was;
 *   — EXIF is dropped, always. These are photographs of pilgrims and EXIF carries GPS: the
 *     coordinates of somebody's home, published on a public page, by accident;
 *   — the same file uploaded twice is one row, because the same photograph will be attached to
 *     a tour, a gallery tile and an OG card;
 *   — video is transcoded once to 720p rather than served as it arrived, because what a phone
 *     records is forty megabytes a minute and the VPS has one disk.
 */

/** Big enough for a hero image, small enough that no page ever downloads a 6000px original. */
const MAX_DIMENSION = 2560;

/** WebP quality. Above this the file grows faster than the picture improves. */
const WEBP_QUALITY = 86;

export interface MediaContext {
  db: Database;
  audit: AuditContext;
  actor: AdminIdentity;
  ip: string;
  uploadsDir: string;
  ffmpegPath: string;
  ffprobePath: string;
  /** Fixed by tests, so a stored key is predictable. */
  now?: Date;
}

export type MediaRow = typeof t.media.$inferSelect;

export interface UploadResult {
  media: MediaRow;
  /** Video only: the frame the player shows before it is pressed. */
  poster: MediaRow | null;
  /** True when the checksum already existed and nothing new was written. */
  isDuplicate: boolean;
}

export function uploadsRootOf(uploadsDir: string): string {
  return isAbsolute(uploadsDir) ? uploadsDir : resolve(process.cwd(), uploadsDir);
}

/** `2026/08/3f9a1c2e4b7d.webp` — year and month, so a directory never holds ten thousand files. */
function storageKey(checksum: string, extension: string, now: Date): string {
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${year}/${month}/${checksum.slice(0, 12)}.${extension}`;
}

async function writeInto(root: string, key: string, bytes: Buffer): Promise<void> {
  const target = join(root, key);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

export async function storeUpload(
  context: MediaContext,
  input: { filename: string; buffer: Buffer; source?: 'upload' | 'stock' },
): Promise<UploadResult> {
  const detected = detectType(input.buffer);
  if (detected === null) {
    throw new ApiProblem(
      'unsupported_media',
      `That file is not one of: ${acceptedTypes().join(', ')}`,
      [{ path: 'file', message: 'unrecognised magic bytes' }],
    );
  }

  const checksum = createHash('sha256').update(input.buffer).digest('hex');

  /*
   * The same bytes, already stored.
   *
   * Returned rather than refused: the editor's intent — «this picture, here» — is satisfied by
   * the row that already exists, and refusing would send them looking for it by hand.
   */
  const [existing] = await context.db
    .select()
    .from(t.media)
    .where(eq(t.media.checksum, checksum))
    .limit(1);

  if (existing !== undefined) return { media: existing, poster: null, isDuplicate: true };

  const now = context.now ?? new Date();
  const root = uploadsRootOf(context.uploadsDir);

  const stored =
    detected.kind === 'image'
      ? await storeImage(context, root, input.buffer, checksum, now)
      : await storeVideo(context, root, input.buffer, checksum, detected.extension, now);

  await recordAudit(context.audit, {
    actorId: context.actor.id,
    action: 'upload',
    entity: 'media',
    entityId: stored.media.id,
    after: {
      filename: input.filename,
      mime: stored.media.mime,
      sizeBytes: stored.media.sizeBytes,
    },
    ip: context.ip,
  });

  return stored;
}

/**
 * One image in, one WebP out.
 *
 * `rotate()` with no argument applies the EXIF orientation and then drops it, which is the only
 * way to keep a phone photograph the right way up while removing the block that says so. Sharp
 * writes no metadata unless asked, so the GPS tag does not survive this line — and there is a
 * test that opens the result and asserts it.
 */
async function storeImage(
  context: MediaContext,
  root: string,
  buffer: Buffer,
  checksum: string,
  now: Date,
): Promise<UploadResult> {
  const pipeline = sharp(buffer)
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const key = storageKey(checksum, 'webp', now);
  await writeInto(root, key, data);

  const [result] = await context.db.insert(t.media).values({
    storageKey: key,
    mime: 'image/webp',
    width: info.width,
    height: info.height,
    sizeBytes: data.byteLength,
    checksum,
    lqip: await makeLqip(data),
  });

  return { media: await load(context.db, result.insertId), poster: null, isDuplicate: false };
}

/**
 * A blurred sixteen-pixel preview, inline in the JSON.
 *
 * A few hundred bytes carried with the row rather than a second request, because the point is
 * to have something on screen before the real file has been asked for.
 */
async function makeLqip(webp: Buffer): Promise<string> {
  const tiny = await sharp(webp).resize(16).blur(1).webp({ quality: 30 }).toBuffer();
  return `data:image/webp;base64,${tiny.toString('base64')}`;
}

/**
 * A video, kept as one 720p file with a poster beside it.
 *
 * Two rows, not one: the poster is an image that a `<video>` element references by URL and that
 * `videos.poster_media_id` points at, so it has to be addressable on its own.
 */
async function storeVideo(
  context: MediaContext,
  root: string,
  buffer: Buffer,
  checksum: string,
  extension: string,
  now: Date,
): Promise<UploadResult> {
  if (!(await ffmpegAvailable(context.ffmpegPath, context.ffprobePath))) {
    throw new ApiProblem(
      'unsupported_media',
      'Video uploads need ffmpeg and ffprobe, and neither is installed on this server',
      [{ path: 'file', message: 'ffmpeg missing' }],
    );
  }

  // A real file on disk, because ffmpeg reads a path, not a stream we already hold.
  const scratch = join(tmpdir(), `charva-${checksum.slice(0, 12)}`);
  await mkdir(scratch, { recursive: true });

  const source = join(scratch, `source.${extension}`);
  const encoded = join(scratch, 'encoded.mp4');
  const frame = join(scratch, 'poster.jpg');

  try {
    await writeFile(source, buffer);

    const probe = await probeVideo(source, context.ffprobePath);
    await transcode720p(source, encoded, context.ffmpegPath);
    await extractPoster(source, frame, context.ffmpegPath);

    const encodedBytes = await readFile(encoded);
    const videoKey = storageKey(checksum, 'mp4', now);
    await writeInto(root, videoKey, encodedBytes);

    const posterWebp = await sharp(frame)
      .resize({ width: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });

    const posterChecksum = createHash('sha256').update(posterWebp.data).digest('hex');
    const posterKey = storageKey(posterChecksum, 'webp', now);
    await writeInto(root, posterKey, posterWebp.data);

    const [posterRow] = await context.db.insert(t.media).values({
      storageKey: posterKey,
      mime: 'image/webp',
      width: posterWebp.info.width,
      height: posterWebp.info.height,
      sizeBytes: posterWebp.data.byteLength,
      checksum: posterChecksum,
      lqip: await makeLqip(posterWebp.data),
    });

    const [videoRow] = await context.db.insert(t.media).values({
      storageKey: videoKey,
      mime: 'video/mp4',
      width: probe.width,
      height: probe.height,
      sizeBytes: encodedBytes.byteLength,
      // What the site prints, read from the file rather than typed by hand — the prototype's
      // «6:12» had already drifted from the clip it described.
      durationSec: probe.durationSec,
      checksum,
    });

    return {
      media: await load(context.db, videoRow.insertId),
      poster: await load(context.db, posterRow.insertId),
      isDuplicate: false,
    };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

async function load(db: Database, id: number): Promise<MediaRow> {
  const [row] = await db.select().from(t.media).where(eq(t.media.id, id)).limit(1);
  if (row === undefined) throw new Error(`media #${String(id)} vanished between write and read`);
  return row;
}
