import { and, asc, eq, inArray, isNull, like, or } from 'drizzle-orm';

import { withDb } from './client';
import * as t from './schema';
import { rows } from './seed/content';

/**
 * Fills `hero_slides` on a database that already has content.
 *
 * The seeder cannot do this. It refuses a database with rows in it — seeding twice would double
 * every list — so a table added after the site went into use has no way to reach the one database
 * that matters. A migration cannot do it either: content in a migration passes silently on an
 * empty test database and then collides with the seeder that inserts the same rows a moment later
 * (D-123). What is left is a script somebody runs once, and this is it.
 *
 * It reproduces exactly what the homepage used to show, so nothing changes on screen the day the
 * slider becomes editable:
 *
 *   — the caption from the design's own `SLIDES` list, which is where it should have come from;
 *   — the photograph from wherever the old hero would have found it — the place's cover if it had
 *     one, otherwise the `g-hero-N` / `u-hero-N` content slot — which is the two-source rule this
 *     table exists to end, applied one last time on the way out.
 *
 * Then it deletes those seven slots. They are the second home for the photograph, and leaving
 * them would leave an editor a place to upload into where nothing would happen — which is the
 * complaint that started all this. The `media` rows they pointed at are untouched: the pictures
 * stay in the library, and the slides now hold them.
 *
 * Safe to run twice. A site that already has slides is left alone.
 */

const SITES = [
  {
    site: 'global',
    lang: 'ru',
    screen: 'Charva Travel Global',
    prefix: 'g-hero-',
    places: t.placesToSee,
  },
  {
    site: 'umrah',
    lang: 'tm',
    screen: 'Charva Umrah',
    prefix: 'u-hero-',
    places: t.ziyaratPlaces,
  },
] as const;

interface SlideRow {
  slot: string;
  label: string;
  photo: string;
}

type Db = Parameters<Parameters<typeof withDb>[0]>[0];

async function backfill(db: Db): Promise<void> {
  for (const target of SITES) {
    const existing = await db
      .select({ id: t.heroSlides.id })
      .from(t.heroSlides)
      .where(eq(t.heroSlides.site, target.site))
      .limit(1);

    if (existing.length > 0) {
      process.stdout.write(`${target.site}: already has slides, left alone\n`);
      continue;
    }

    const slides = rows<SlideRow>(target.screen, 'SLIDES');

    // Both old sources, read once each, in the order the old homepage resolved them.
    const slots = await db
      .select({ key: t.contentSlots.slotKey, mediaId: t.contentSlots.mediaId })
      .from(t.contentSlots)
      .where(like(t.contentSlots.slotKey, `${target.prefix}%`));
    const bySlot = new Map(slots.map((slot) => [slot.key, slot.mediaId]));

    const places = await db
      .select({ coverMediaId: target.places.coverMediaId })
      .from(target.places)
      .where(eq(target.places.isPublished, true))
      .orderBy(asc(target.places.sortOrder), asc(target.places.id))
      .limit(slides.length);

    const values = slides.map((slide, index) => ({
      site: target.site,
      title: { [target.lang]: slide.label },
      brief: slide.photo,
      mediaId: places[index]?.coverMediaId ?? bySlot.get(slide.slot) ?? null,
      isPublished: true,
      sortOrder: index + 1,
    }));

    await db.insert(t.heroSlides).values(values);

    const withPhoto = values.filter((value) => value.mediaId !== null).length;
    process.stdout.write(
      `${target.site}: ${String(values.length)} slides, ${String(withPhoto)} with a photograph\n`,
    );
  }

  /*
   * The slots go last, and only after every slide is in.
   *
   * If the insert above threw, the pictures would still be reachable through the slots; deleting
   * first would have thrown away the only pointer to them.
   */
  const dead = await db
    .select({ id: t.contentSlots.id })
    .from(t.contentSlots)
    .where(or(like(t.contentSlots.slotKey, 'g-hero-%'), like(t.contentSlots.slotKey, 'u-hero-%')));

  if (dead.length > 0) {
    await db.delete(t.contentSlots).where(
      inArray(
        t.contentSlots.id,
        dead.map((slot) => slot.id),
      ),
    );
    process.stdout.write(`removed ${String(dead.length)} hero slots from the checklist\n`);
  }

  const blank = await db
    .select({ id: t.heroSlides.id })
    .from(t.heroSlides)
    .where(and(isNull(t.heroSlides.mediaId), eq(t.heroSlides.isPublished, true)));

  if (blank.length > 0) {
    // Not an error: a slide with no picture draws its brief, which is the point of the brief.
    process.stdout.write(
      `${String(blank.length)} slides have no photograph yet — they show their brief\n`,
    );
  }
}

export { backfill as backfillHeroSlides };

if (
  process.argv[1] !== undefined &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))
) {
  await withDb(backfill);
}
