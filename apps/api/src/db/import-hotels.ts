import { eq, inArray } from 'drizzle-orm';

import { loadEnv } from '../env';
import { storeUpload } from '../modules/admin/media/service';

import { withDb } from './client';
import * as t from './schema';
import { slugify } from './seed/parse';

/**
 * The operator's real hotels, brought over from their older site.
 *
 * `mukamly-travel.com` is the same business, and its sixteen hotels are the ones Charva is
 * actually selling. Until now this catalogue held the invented rows from the design handoff —
 * plausible names, plausible star ratings and prices nobody ever quoted — which were there to
 * make a layout render and were always meant to go the week real content arrived.
 *
 * The old site renders on the client, so its pages read as empty markup; the data comes from its
 * own JSON API instead, which is cleaner anyway — names, cities, addresses and descriptions in
 * eight languages, a star rating, check-in and check-out, and a photograph list per hotel.
 *
 * What does not come over, because it is not there: nightly prices, room types and amenities.
 * The first is deliberate — the owner's answer for hotels was the same as for the tour builder,
 * that an operator quotes and the site does not — and `price_from_minor` became nullable to say
 * so. The other two are filled in from the admin panel, hotel by hotel.
 *
 * Photographs go through `storeUpload`, the same path an editor's upload takes: the type is
 * decided by the first bytes rather than the extension, EXIF is stripped, the image is converted
 * and the checksum makes a repeat a no-op. Running this twice does not duplicate a file.
 *
 *   pnpm --filter @charva/api tsx src/db/import-hotels.ts
 *   node dist/import-hotels.js          # on the server, where the bundle is
 */

type Db = Parameters<Parameters<typeof withDb>[0]>[0];

const ORIGIN = 'https://mukamly-travel.com';

/** Beyond this a gallery is a scroll nobody finishes — the same ceiling `PUT /gallery` holds. */
const MAX_GALLERY = 12;

/** One hotel as the old site's API describes it. Only the fields this import reads. */
interface Source {
  id: number;
  stars: number | null;
  check_in: string | null;
  check_out: string | null;
  main_photo_url: string | null;
  photos?: string[];
  name_en?: string;
  name_ru?: string;
  name_tr?: string;
  city_en?: string;
  city_ru?: string;
  city_tr?: string;
  address_en?: string;
  address_ru?: string;
  address_tr?: string;
  description_en?: string;
  description_ru?: string;
  description_tr?: string;
}

/**
 * `12:00:00` -> `12:00`.
 *
 * The column is `VARCHAR(5)` and holds a wall-clock rule printed on a page (D-121). The old
 * site stores a TIME, which is the shape this project deliberately does not use.
 */
function clock(value: string | null): string | null {
  if (value === null || value === '') return null;
  // The whole match rather than two groups rejoined: `match[0]` is already `HH:MM` and is the
  // one index TypeScript knows is present, so there is nothing to assert away.
  return /^\d{2}:\d{2}/.exec(value)?.[0] ?? null;
}

/** Trimmed, and empty rather than a string of spaces. */
function clean(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Three languages out of the eight the old site carries.
 *
 * Turkish is retired rather than deleted (Q-17), and it is stored here for the same reason its
 * copy files were kept: the day the font question is answered the language comes back with its
 * content already in place. French, Chinese, Japanese, Korean and Italian are dropped — Charva
 * has never offered them and a column holding text nothing can render is dead data (D-9).
 */
function localized(
  ru: string | undefined,
  en: string | undefined,
  tr: string | undefined,
): Record<string, string> | null {
  const value: Record<string, string> = {};
  if (clean(ru) !== '') value['ru'] = clean(ru);
  if (clean(en) !== '') value['en'] = clean(en);
  if (clean(tr) !== '') value['tr'] = clean(tr);
  return Object.keys(value).length === 0 ? null : value;
}

/**
 * The first sentence or so, for a card.
 *
 * The old site has one description per language and Charva has two fields: `summary` on the
 * card and `body` on the page. Cutting at a sentence boundary rather than at a character count
 * is what keeps a card from ending mid-word; the cap is there for a description written as one
 * long sentence, which several of these are.
 */
function summarise(body: string): string {
  if (body === '') return '';
  const sentence = /^.{40,220}?[.!?](\s|$)/.exec(body);
  const cut = sentence === null ? body.slice(0, 200) : sentence[0];
  return cut.trim();
}

function summaryOf(value: Record<string, string> | null): Record<string, string> | null {
  if (value === null) return null;
  const out: Record<string, string> = {};
  for (const [lang, text] of Object.entries(value)) out[lang] = summarise(text);
  return out;
}

async function readJson<T>(path: string): Promise<T> {
  const response = await fetch(`${ORIGIN}${path}`, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${path} answered ${String(response.status)}`);
  return (await response.json()) as T;
}

/**
 * Everything the invented hotels left behind — eight of them, in the live database.
 *
 * Their `media` rows are deliberately not touched. Those are the Wikimedia photographs the site
 * imported in August, they are shared with `content_slots` and other pages, and they are
 * credited on `/credits` — deleting them here would blank a photograph somewhere else.
 */
async function removeExisting(db: Db): Promise<string[]> {
  const rows = await db.select({ id: t.hotels.id, slug: t.hotels.slug }).from(t.hotels);
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  await db.delete(t.hotelAmenities).where(inArray(t.hotelAmenities.hotelId, ids));
  await db.delete(t.hotelRooms).where(inArray(t.hotelRooms.hotelId, ids));
  await db.delete(t.hotelMedia).where(inArray(t.hotelMedia.hotelId, ids));
  await db.delete(t.hotels).where(inArray(t.hotels.id, ids));

  return rows.map((row) => row.slug);
}

async function main(): Promise<void> {
  const env = loadEnv();

  await withDb(async (db) => {
    const [owner] = await db
      .select({ id: t.adminUsers.id })
      .from(t.adminUsers)
      .orderBy(t.adminUsers.id)
      .limit(1);

    const context = {
      db,
      audit: {
        db,
        ipHashSecret: env.IP_HASH_SECRET,
        onError: (error: unknown) => {
          process.stderr.write(`audit log failed: ${String(error)}\n`);
        },
      },
      actor: { id: owner?.id ?? 0, role: 'owner' as const, siteScope: null },
      ip: '127.0.0.1',
      uploadsDir: env.UPLOADS_DIR,
      ffmpegPath: env.FFMPEG_PATH,
      ffprobePath: env.FFPROBE_PATH,
    };

    const list = await readJson<{ id: number }[]>('/api/hotels');
    process.stdout.write(`${String(list.length)} hotels on the old site\n`);

    const removed = await removeExisting(db);
    if (removed.length > 0) {
      process.stdout.write(
        `removed ${String(removed.length)} demo hotels: ${removed.join(', ')}\n`,
      );
    }

    let photographs = 0;

    for (const [index, entry] of list.entries()) {
      const raw = await readJson<Source | Source[]>(`/api/hotels/${String(entry.id)}`);
      const source = Array.isArray(raw) ? raw[0] : raw;
      if (source === undefined) continue;

      const name = localized(source.name_ru, source.name_en, source.name_tr);
      const city = localized(source.city_ru, source.city_en, source.city_tr);
      if (name === null || city === null) {
        process.stdout.write(`  #${String(entry.id)}: no name or city, skipped\n`);
        continue;
      }

      const body = localized(source.description_ru, source.description_en, source.description_tr);

      // English, because a slug is ASCII and immutable once shared (D-40). `slugify`
      // transliterates, so a Russian name would work too — it would just read worse.
      const slug = slugify(clean(source.name_en) || clean(source.name_ru));

      /*
       * The cover first, then the gallery, and the cover is not repeated in it.
       *
       * The hotel page shows the cover as the first thumbnail rather than as a separate image
       * above them (D-119), so a gallery that also held it would show it twice.
       */
      const urls = [source.main_photo_url, ...(source.photos ?? [])]
        .filter((url): url is string => typeof url === 'string' && url !== '')
        .filter((url, at, all) => all.indexOf(url) === at)
        .slice(0, MAX_GALLERY);

      const mediaIds: number[] = [];
      for (const url of urls) {
        try {
          const response = await fetch(`${ORIGIN}${url}`);
          if (!response.ok) continue;
          const buffer = Buffer.from(await response.arrayBuffer());

          const result = await storeUpload(context, {
            filename: url.split('/').pop() ?? 'photo',
            buffer,
            source: 'upload',
          });

          /*
           * The operator's own photographs: no attribution, and `source` stays `upload`.
           *
           * That distinction is load-bearing. The deploy gate counts `stock` rows without a
           * credit, and `/credits` lists `stock` rows by author — these are neither borrowed
           * nor owed to anybody, so putting them in that set would print a credit for a
           * photograph the business took itself.
           *
           * `alt` is a localized column like every other piece of text. The hotel's own name is
           * a poor alternative text and a good deal better than none, which is what these would
           * otherwise have: the old site stores no alt at all.
           */
          await db.update(t.media).set({ alt: name }).where(eq(t.media.id, result.media.id));

          mediaIds.push(result.media.id);
          photographs += 1;
        } catch (error) {
          process.stdout.write(`  ${slug}: one photograph skipped (${String(error)})\n`);
        }
      }

      const [inserted] = await db.insert(t.hotels).values({
        slug,
        name,
        summary: summaryOf(body),
        body,
        city,
        address: localized(source.address_ru, source.address_en, source.address_tr),
        stars: source.stars,
        // Every one of the sixteen is an ordinary hotel. The camp and the boutique were among
        // the invented rows, and the enum keeps the option for the day a real one arrives.
        category: 'hotel',
        // Null is «по запросу» — migration 0009 and the owner's decision of 2026-09-11.
        priceFromMinor: null,
        checkIn: clock(source.check_in),
        checkOut: clock(source.check_out),
        coverMediaId: mediaIds[0] ?? null,
        isPublished: true,
        sortOrder: index,
      });

      const hotelId = inserted.insertId;
      if (mediaIds.length > 1) {
        await db.insert(t.hotelMedia).values(
          mediaIds.slice(1).map((mediaId, at) => ({
            hotelId,
            mediaId,
            sortOrder: at,
          })),
        );
      }

      process.stdout.write(
        `  ${slug.padEnd(26)} ${String(source.stars ?? '-')}★  ` +
          `${clean(source.city_en).padEnd(12)} photos: ${String(mediaIds.length)}\n`,
      );
    }

    process.stdout.write(`\nimported ${String(photographs)} photographs\n`);
  });
}

await main();
