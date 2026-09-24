import { eq } from 'drizzle-orm';
import mysql from 'mysql2/promise';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb } from '../client';
import * as t from '../schema';
import { TEST_DATABASE_URL } from '../test-setup';

import {
  attachOwnerTourMedia,
  OWNER_TOUR_SLUGS,
  TURKMENISTAN_SHORT_SLUG,
  TURKMENISTAN_SLUG,
} from './owner-content';
import { seedAll, SEEDED_TABLES } from './seed';

/**
 * Whether the owner's tours actually get their photographs.
 *
 * This is the step most likely to fail by doing nothing. It finds pictures by the English `alt`
 * the Commons import writes — «The Darvaza gas crater in the Karakum Desert» — because ids depend
 * on how many files each category returned on the day it ran, and are not the same twice. A typo
 * in one of those phrases produces no error and no photograph: the tour simply keeps the cover it
 * was dealt, on a page nobody opens on the machine where the script was run.
 *
 * Its own file rather than a block in `seed.db.test.ts`, because that suite asserts the seeds
 * bring no media at all — which is true, and which this has to break in order to test anything.
 */

let pool: mysql.Pool;
let db: ReturnType<typeof createDb>;

const HORSE = 'An Akhal-Teke horse, the pride of Turkmenistan';

/**
 * One photograph, described the way the stock importer describes them.
 *
 * The index is zero-padded to three digits before the checksum is padded out to sixty-four with
 * zeros, and that is not decoration: «…-1» and «…-10» pad to the same sixty-four characters, so
 * the unique index on `checksum` rejected the eleventh photograph of a subject. It never came up
 * while the fixture held four of everything.
 */
async function photograph(subject: string, index: number): Promise<void> {
  const ordinal = String(index).padStart(3, '0');

  await db.insert(t.media).values({
    storageKey: `2026/09/test-${subject}-${ordinal}.webp`,
    mime: 'image/webp',
    width: 2000,
    height: 1400,
    sizeBytes: 100_000,
    checksum: `test-${subject}-${ordinal}`.padEnd(64, '0'),
    alt: { ru: subject, en: subject, tr: subject },
    source: 'stock',
    attribution: 'Test',
    license: 'CC BY-SA 4.0',
  });
}

beforeAll(async () => {
  pool = mysql.createPool({ uri: TEST_DATABASE_URL, timezone: 'Z', connectionLimit: 5 });
  db = createDb(pool);

  for (const table of SEEDED_TABLES) await pool.query(`DELETE FROM \`${table}\``);
  await pool.query('DELETE FROM `media`');

  await seedAll(db);

  /*
   * The subjects the five sheets between them ask for, in the numbers the live library holds.
   *
   * The counts are not decoration. `resolve()` takes the nth landscape photograph of a subject and
   * wraps with `%`, so a fixture with four of everything would silently fold the fifth tour's
   * choices back onto the first tour's — the strips would come out short, every assertion here
   * would still pass, and the arrangement the site actually ships would go untested. These are the
   * landscape counts measured on production, so a plan that fits here fits there.
   */
  const subjects: [alt: string, count: number][] = [
    ['The Darvaza gas crater in the Karakum Desert', 10],
    ['Ashgabat, the white marble capital of Turkmenistan', 16],
    ['Old Nisa, the Parthian fortress outside Ashgabat', 6],
    ['Ancient Merv, a city of the Silk Road', 8],
    ['Konye-Urgench, the minarets and mausoleums of Khorezm', 6],
    ['The Yangi Kala canyons in western Turkmenistan', 8],
    ['The Caspian coast at Turkmenbashi', 8],
    ['The dunes of the Karakum Desert', 8],
    ['An Akhal-Teke horse, the pride of Turkmenistan', 6],
    ['A hand-woven Turkmen carpet', 6],
    ['People of Turkmenistan', 8],
    ['Turkmen cuisine', 6],
  ];
  for (const [subject, count] of subjects) {
    for (let index = 0; index < count; index += 1) await photograph(subject, index);
  }
}, 60_000);

afterAll(async () => {
  await pool.query('DELETE FROM `media`');
  await pool.end();
});

async function tourBySlug(slug: string) {
  const [row] = await db.select().from(t.tours).where(eq(t.tours.slug, slug)).limit(1);
  return row;
}

/** Ordered explicitly: a table read without `ORDER BY` comes back in whatever order it likes. */
async function galleryOf(tourId: number) {
  return db
    .select({ mediaId: t.tourMedia.mediaId, sortOrder: t.tourMedia.sortOrder, alt: t.media.alt })
    .from(t.tourMedia)
    .innerJoin(t.media, eq(t.media.id, t.tourMedia.mediaId))
    .where(eq(t.tourMedia.tourId, tourId))
    .orderBy(t.tourMedia.sortOrder);
}

describe('attachOwnerTourMedia', () => {
  it('gives every owner tour a cover and a strip', async () => {
    const touched = await attachOwnerTourMedia(db);
    expect(touched).toBe(OWNER_TOUR_SLUGS.length);

    for (const slug of OWNER_TOUR_SLUGS) {
      const tour = await tourBySlug(slug);
      expect(tour?.coverMediaId, slug).not.toBeNull();
      expect((await galleryOf(tour!.id)).length, slug).toBeGreaterThan(0);
    }
  });

  /*
   * No photograph on two cards.
   *
   * The five tours between them ask for 32 frames out of a library of about a hundred, and they
   * ask by subject and ordinal — «the fifth landscape crater» — not by id. Nothing in the data
   * stops two tours naming the same one: `resolve` wraps with `%`, so an ordinal past the end of
   * a subject's pool silently folds back onto a frame an earlier tour already took, and the only
   * symptom is the same picture on two cards in one catalogue row. The three transit tours step
   * their ordinals past what the two published ones use precisely to avoid it, and that is an
   * arrangement a sixth sheet can break without touching a line of this file.
   */
  it('never shows one photograph on two tours', async () => {
    const seen = new Map<number, string>();

    for (const slug of OWNER_TOUR_SLUGS) {
      const tour = await tourBySlug(slug);
      const frames = [tour!.coverMediaId, ...(await galleryOf(tour!.id)).map((row) => row.mediaId)];

      for (const id of frames) {
        if (id === null) continue;
        expect(
          seen.get(id),
          `media ${String(id)} is on ${seen.get(id) ?? ''} and on ${slug}`,
        ).toBeUndefined();
        seen.set(id, slug);
      }
    }

    // Five covers and their strips: the number is derived so a sixth sheet reports its own total
    // rather than failing a literal somebody has to update.
    expect(seen.size).toBeGreaterThanOrEqual(OWNER_TOUR_SLUGS.length * 2);
  });

  it('puts the short tour’s crater on the card, not whatever came first', async () => {
    const tour = await tourBySlug(TURKMENISTAN_SHORT_SLUG);
    const [cover] = await db
      .select({ alt: t.media.alt })
      .from(t.media)
      .where(eq(t.media.id, tour!.coverMediaId!));

    expect(cover?.alt?.en).toContain('Darvaza gas crater');
  });

  it('keeps the strip in itinerary order and free of repeats', async () => {
    const tour = await tourBySlug(TURKMENISTAN_SHORT_SLUG);
    const strip = await galleryOf(tour!.id);

    // The two days in pictures: the capital, the desert crossing, the crater twice, the dinner
    // eaten beside it, and the road out through Khorezm.
    expect(strip.map((row) => row.alt?.en)).toEqual([
      'Ashgabat, the white marble capital of Turkmenistan',
      'The dunes of the Karakum Desert',
      'The Darvaza gas crater in the Karakum Desert',
      'The Darvaza gas crater in the Karakum Desert',
      'Turkmen cuisine',
      'Konye-Urgench, the minarets and mausoleums of Khorezm',
    ]);
    // Two frames of the crater, but never the same file twice — the unique index on
    // (tour, media) would reject the whole insert rather than the repeat.
    expect(new Set(strip.map((row) => row.mediaId)).size).toBe(strip.length);
  });

  /*
   * The page draws the cover large and the strip beneath it, so one photograph in both is one
   * photograph shown twice — which reads as a fault rather than as a choice.
   *
   * Not hypothetical, and this is the arrangement that produces it: the five-day tour already has
   * a cover, dealt to it round-robin when the photographs were imported, and it happens to be the
   * very frame its strip would ask for. So the cover is pinned to that frame here rather than
   * left to the code that is being tested.
   */
  it('never repeats the cover inside the strip', async () => {
    const tour = await tourBySlug(TURKMENISTAN_SLUG);
    // Filtered here rather than in SQL: comparing a JSON column to an object compares the
    // serialised text, and a key order away from matching is a test that silently finds nothing.
    const horses = (await db.select({ id: t.media.id, alt: t.media.alt }).from(t.media))
      .filter((photo) => photo.alt?.en === HORSE)
      .sort((a, b) => a.id - b.id);

    const collides = horses[1]?.id;
    expect(collides, 'the fixture must hold a second horse').toBeDefined();

    await db.update(t.tours).set({ coverMediaId: collides }).where(eq(t.tours.id, tour!.id));
    await db.delete(t.tourMedia).where(eq(t.tourMedia.tourId, tour!.id));

    await attachOwnerTourMedia(db);

    const strip = await galleryOf(tour!.id);
    expect(strip.length).toBeGreaterThan(0);
    expect(strip.map((row) => row.mediaId)).not.toContain(collides);
  });

  /*
   * The half that protects the editor.
   *
   * `db:content` is meant to be safe to run twice, and «safe» here means it does not re-assert
   * its own taste over a gallery somebody has since arranged in the admin panel (D-117).
   */
  it('changes nothing on a second run', async () => {
    const tour = await tourBySlug(TURKMENISTAN_SHORT_SLUG);
    const before = { cover: tour?.coverMediaId, strip: await galleryOf(tour!.id) };

    expect(await attachOwnerTourMedia(db)).toBe(0);

    const after = await tourBySlug(TURKMENISTAN_SHORT_SLUG);
    expect(after?.coverMediaId).toBe(before.cover);
    expect(await galleryOf(tour!.id)).toEqual(before.strip);
  });

  it('leaves a cover somebody else chose alone', async () => {
    const tour = await tourBySlug(TURKMENISTAN_SLUG);
    const [other] = await db.select({ id: t.media.id }).from(t.media).limit(1);

    await db.update(t.tours).set({ coverMediaId: other!.id }).where(eq(t.tours.id, tour!.id));
    await attachOwnerTourMedia(db);

    expect((await tourBySlug(TURKMENISTAN_SLUG))?.coverMediaId).toBe(other!.id);
  });

  it('does nothing, rather than failing, on a database with no photographs', async () => {
    await pool.query('DELETE FROM `tour_media`');
    await db.update(t.tours).set({ coverMediaId: null });
    await pool.query('DELETE FROM `media`');

    expect(await attachOwnerTourMedia(db)).toBe(0);
    expect((await tourBySlug(TURKMENISTAN_SLUG))?.coverMediaId).toBeNull();
  });
});
