import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { and, asc, eq, isNull, like } from 'drizzle-orm';
import sharp from 'sharp';

import { loadEnv } from '../env';
import { storeUpload } from '../modules/admin/media/service';

import { withDb, type Database } from './client';
import * as t from './schema';

/**
 * The owner's own Umrah photographs, from the phone originals to their places on the site.
 *
 * Twenty-three files arrived as iPhone HEIC plus one DNG, 69.6 MB, in a folder beside the
 * repository. The instruction was: use them across the Umrah site, and do not repeat any.
 *
 * **Why ffmpeg and not sharp.** sharp parses a HEIC container and then refuses the pixels —
 * «Support for this compression format has not been built in» — because its bundled libvips
 * carries libheif with AV1 but not HEVC. `metadata()` succeeding and `toBuffer()` failing on the
 * same bytes is a confusing way to find that out. ffmpeg decodes them at full size and is
 * already a dependency (D-83), so the import costs no new package. Windows' own WIC has no HEVC
 * codec on the machine this was written on either.
 *
 * **Why the DNG goes through its preview.** ffmpeg will not demosaic it (`bpp=30`), but every
 * DNG carries a full-size JPEG preview, which is what any viewer shows. Candidates are found by
 * their markers and then *decoded* to see which is real: the raw sensor data contains byte pairs
 * that look exactly like the start of a JPEG, and the first attempt at this handed sharp a
 * corrupt buffer.
 *
 * **Why `storeUpload` and not hand-written rows.** It is the same path the admin upload takes:
 * magic-byte sniffing, EXIF stripped (D-82 — these are pilgrims' photographs), checksum
 * de-duplication, `lqip`, the derivative widths. A row written by hand would be a second, worse
 * implementation of all of it. Re-running is therefore safe: identical bytes return the existing
 * row rather than a second copy.
 *
 * **Why the frames are named and listed rather than globbed.** D-181: an ordinal is not a choice
 * of photograph until somebody has looked at it. Fourteen of the twenty-three are the same night
 * view of the clock tower from the same hillside, and one is a hand holding a handset. Shipping
 * all of them would fill the Umrah gallery with one photograph repeated, which is the opposite
 * of what was asked. `KEEP` is the reviewed subset; the rest are converted and left in the media
 * library, unplaced, where the owner can reach them.
 *
 * **What it claims about the pictures.** Only what is visible. The three aerial frames are
 * unmistakably the Masjid al-Haram, so one may carry that place's cover. The hillside frames are
 * very probably Jabal al-Nour, and «very probably» is not good enough to label a real place on
 * the operator's own site (D-137), so they go where they assert nothing beyond «the group, in
 * Mecca»: the slider and the group gallery.
 *
 *   pnpm --filter @charva/api db:umrah-photos -- --inspect
 *   pnpm --filter @charva/api db:umrah-photos
 */

const SOURCE_DIR = process.env['UMRAH_PHOTOS_DIR'] ?? 'C:/Users/1293/Desktop/charva/1293';

/** Above every width the site ever serves (1440, D-150), so nothing visible is lost. */
const MAX_EDGE = 2560;

/**
 * The trip these photographs are from: 25 August to 9 September, by the owner's word.
 *
 * It has no row. The six groups in the database run April 2025 to June 2026 at roughly three
 * months apart, and a departure on 25 August sits after the June one and is the most recent —
 * which is also why the photographs are still on his phone. The year is therefore 2026, and
 * that is an inference, not something he said: if it is wrong, the slug and the two dates below
 * are the whole correction.
 *
 * `pilgrimsCount` is left null. The other groups carry a number; this one has none, because
 * nobody told me how many travelled and the site would print whatever I made up (D-137).
 *
 * Naming follows the rows that exist — slug `<month><yy>`, «<Month> aýyndaky toparymyz», and a
 * short label of «<Month> <year>» — rather than inventing a seventh convention.
 */
const OWNER_TRIP = {
  slug: 'awgust26',
  departedOn: '2026-08-25',
  label: { tm: 'Awgust aýyndaky toparymyz', ru: 'Наша группа в августе' },
  shortLabel: { tm: 'Awgust 2026', ru: 'Август 2026' },
  /* The two dates are what the owner gave, and nothing beyond them is claimed. */
  description: { tm: '25.08.2026 — 09.09.2026', ru: '25.08.2026 — 09.09.2026' },
} as const;

/** Where a photograph may go. Resolved against the rows that exist, never against ids. */
type Target =
  | { kind: 'heroSlide'; order: number }
  | { kind: 'ziyaratCover'; match: string }
  | { kind: 'groupCover' }
  | { kind: 'gallery' };

interface Frame {
  file: string;
  /** Describes the subject, because `IMG_5522` tells nobody anything in a month. */
  name: string;
  /** Shown in the media library and read by the owner when placing it by hand. */
  alt: { tm: string; ru: string } | null;
  target: Target | null;
}

/**
 * The twelve worth placing, read off a contact sheet.
 *
 * Three of them go somewhere a script may safely put them, and the reasoning is the same each
 * time: the photograph has to be of the thing the slot says it is.
 *
 *   — Slide 1 is titled «Mekge» and currently shows a meal tray in a plastic bag. An aerial of
 *     the Masjid al-Haram is Mecca, and is the strongest frame in the set.
 *   — Slide 3 is titled «Topar», the group. One frame is the group.
 *   — Slide 2 is titled «Medine» and keeps the photograph it has, because **not one of the
 *     twenty-three was taken in Medina**. Every frame is Mecca. Putting one there would caption
 *     a Mecca photograph as Medina on the operator's own site.
 *   — `masjid-al-haram` has a cover already, imported from Wikimedia. The owner's own aerial of
 *     the same building replaces it: his photograph of his pilgrimage beats a stranger's.
 *   — `jebel-an-nur-hira` also exists, and the hillside frames are very probably taken from it —
 *     the view of the clock tower from that mountain is characteristic. «Very probably» is not
 *     enough to label a real place (D-137), so they stay unassigned to it.
 *
 * The rest are `gallery`, and need `--group=<slug>` before they go anywhere: see the note there.
 */
const KEEP: Frame[] = [
  {
    file: 'IMG_5548.HEIC',
    name: 'haram-from-above',
    alt: {
      tm: 'Mesjidi Haram we Käbe ýokardan, agşam',
      ru: 'Масджид аль-Харам и Кааба сверху, вечер',
    },
    target: { kind: 'heroSlide', order: 0 },
  },
  {
    file: 'IMG_5535.HEIC',
    name: 'group-on-the-mountain',
    alt: {
      tm: 'Topar daglykda, Mekgäniň üstünden agşam',
      ru: 'Группа на возвышенности над вечерней Меккой',
    },
    target: { kind: 'heroSlide', order: 2 },
  },
  {
    file: 'IMG_5526.HEIC',
    name: 'pilgrim-overlooking-mecca',
    alt: {
      tm: 'Zyýaratçy gaýalarda, aşakda Mekgäniň yşyklary',
      ru: 'Паломник на скалах, внизу огни Мекки',
    },
    target: { kind: 'gallery' },
  },
  {
    file: 'IMG_5547.DNG',
    name: 'haram-courtyard-from-above',
    alt: {
      tm: 'Mesjidi Haramyň howlusy we minaralar ýokardan',
      ru: 'Двор Масджид аль-Харам и минареты сверху',
    },
    target: { kind: 'ziyaratCover', match: 'masjid-al-haram' },
  },
  {
    file: 'IMG_5453.HEIC',
    name: 'umrah-briefing-hall',
    alt: { tm: 'Ugramazdan öňki topar ýygnagy', ru: 'Собрание группы перед вылетом' },
    target: { kind: 'groupCover' },
  },
  {
    file: 'IMG_5549.HEIC',
    name: 'haram-and-city-from-above',
    alt: {
      tm: 'Mesjidi Haram we şäher ýokardan',
      ru: 'Масджид аль-Харам и город сверху',
    },
    target: { kind: 'gallery' },
  },
  {
    file: 'IMG_5537.HEIC',
    name: 'group-on-the-mountain-tall',
    alt: { tm: 'Topar daglykda, agşam', ru: 'Группа на возвышенности, вечер' },
    target: { kind: 'gallery' },
  },
  {
    file: 'IMG_5527.HEIC',
    name: 'pilgrim-portrait-night',
    alt: { tm: 'Zyýaratçy, arkada şäheriň yşyklary', ru: 'Паломник, позади огни города' },
    target: { kind: 'gallery' },
  },
  {
    file: 'IMG_5531.HEIC',
    name: 'pilgrim-seated-tower',
    alt: {
      tm: 'Zyýaratçy gaýada, arkada sagat diňi',
      ru: 'Паломник на скале, позади часовая башня',
    },
    target: { kind: 'gallery' },
  },
  {
    file: 'IMG_5474.HEIC',
    name: 'mecca-night-tower-close',
    alt: { tm: 'Mekgäniň sagat diňi, agşam', ru: 'Часовая башня Мекки, вечер' },
    target: { kind: 'gallery' },
  },
  {
    file: 'IMG_5464.HEIC',
    name: 'mecca-night-towers',
    alt: { tm: 'Mekge agşam, daglykdan görnüş', ru: 'Мекка вечером, вид с возвышенности' },
    target: { kind: 'gallery' },
  },
  {
    file: 'IMG_5520.HEIC',
    name: 'mecca-valley-night',
    alt: {
      tm: 'Mekgäniň jülgesi, Harama tarap yşyklar',
      ru: 'Долина Мекки, огни в сторону Харама',
    },
    target: { kind: 'gallery' },
  },
];

/**
 * Converted and stored, but placed nowhere.
 *
 * Near-duplicates of the frames above, and one photograph of a handset. They belong in the
 * library — the owner may disagree with any of these calls and place one from the admin — but
 * not on a page chosen by a script.
 */
const LIBRARY_ONLY = [
  'IMG_5469.HEIC',
  'IMG_5470.HEIC',
  'IMG_5471.HEIC',
  'IMG_5475.HEIC',
  'IMG_5521.HEIC',
  'IMG_5522.HEIC',
  'IMG_5523.HEIC',
  'IMG_5524.HEIC',
  'IMG_5525.HEIC',
  'IMG_5529.HEIC',
  'IMG_5543.HEIC',
];

/**
 * The Medina repair.
 *
 * Eight stock photographs carry the caption «Мечеть Пророка в Медине». Seven of them are the
 * Prophet's Mosque. The eighth is an airport meal — a cup of porridge, a bottle of water, dates
 * and a bread roll on a plastic sheet — and it was the one in use, on the Umrah hero slide
 * titled «Medine» and as the cover of the `masjid-an-nabawi` ziyarat page. So the page about the
 * second holiest mosque in Islam was illustrated with a lunch tray, on a pilgrimage site.
 *
 * Nothing downstream could have caught it: a wrong photograph is a perfectly valid row, with a
 * real licence and a real attribution. D-127 already records the Commons importer returning
 * Mashhad for a search for Merv; the category filter it gained afterwards narrows the problem
 * without removing it, because people do upload their iftar into a mosque's category. D-181 is
 * the rule that answers it — look at the frame — and these eight had never been looked at.
 *
 * Identified by checksum rather than by id, so the same repair runs against production, where
 * the ids differ. Applied only where the wrong row is still the one in use, so it is idempotent
 * and will not overturn a choice the owner makes later from the admin.
 */
const MEDINA_WRONG = '77434cd96ecfa2ad70fbc110ee49815da907de466036a6709a9b8168c6968ff2';
/** Sunset behind the green dome, worshippers in silhouette. The strongest of the eight. */
const MEDINA_HERO = '33f15b8b6f688ddb9be961b1347561d5d957bbe8dbc89da28dac5abebb756728';
/** The courtyard, green dome and minaret in daylight — identifies the place at a glance. */
const MEDINA_PLACE = 'ea5b0489be005409789aa667989a28778b2c3d18aadf3e974b2a10ade3ec5180';

async function idOf(db: Database, checksum: string): Promise<number | null> {
  const [row] = await db
    .select({ id: t.media.id })
    .from(t.media)
    .where(eq(t.media.checksum, checksum))
    .limit(1);
  return row?.id ?? null;
}

async function repairMedina(db: Database): Promise<void> {
  const wrong = await idOf(db, MEDINA_WRONG);
  if (wrong === null) return;

  const hero = await idOf(db, MEDINA_HERO);
  const place = await idOf(db, MEDINA_PLACE);

  if (hero !== null) {
    const changed = await db
      .update(t.heroSlides)
      .set({ mediaId: hero })
      .where(and(eq(t.heroSlides.site, 'umrah'), eq(t.heroSlides.mediaId, wrong)));
    void changed;
    process.stdout.write(`  hero slide showing the meal tray -> #${String(hero)}\n`);
  }

  if (place !== null) {
    await db
      .update(t.ziyaratPlaces)
      .set({ coverMediaId: place })
      .where(eq(t.ziyaratPlaces.coverMediaId, wrong));
    process.stdout.write(`  ziyarat cover showing the meal tray -> #${String(place)}\n`);
  }

  // The row keeps its file and its attribution — somebody did photograph this, and the licence
  // record is real. What it loses is the claim to be a mosque, so it cannot be chosen again by
  // anything searching captions.
  await db
    .update(t.media)
    .set({
      alt: {
        ru: 'Еда в дороге: каша, вода, финики и лепёшка',
        tm: 'Ýoldaky nahar: şüle, suw, hurma we çörek',
      },
    })
    .where(eq(t.media.id, wrong));
  process.stdout.write(`  media #${String(wrong)} re-captioned as what it actually shows\n`);
}

function decodeWithFfmpeg(path: string, ffmpegPath: string, scratch: string): Buffer {
  const out = join(scratch, 'frame.png');
  rmSync(out, { force: true });
  // No `-vf`: ffmpeg builds a complex filtergraph of its own for a tiled HEIF item, and simple
  // and complex filtering cannot both drive one stream. sharp does the scaling instead.
  execFileSync(
    ffmpegPath,
    ['-hide_banner', '-loglevel', 'error', '-y', '-i', path, '-frames:v', '1', out],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  return readFileSync(out);
}

async function decodeEmbeddedPreview(bytes: Buffer): Promise<Buffer | null> {
  const starts: number[] = [];
  for (let i = 0; i + 3 < bytes.length; i++) {
    if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) starts.push(i);
  }

  const candidates: Buffer[] = [];
  for (const start of starts) {
    for (let j = bytes.length - 1; j > start; j--) {
      if (bytes[j - 1] === 0xff && bytes[j] === 0xd9) {
        candidates.push(bytes.subarray(start, j + 1));
        break;
      }
    }
  }
  candidates.sort((a, b) => b.length - a.length);

  for (const candidate of candidates) {
    try {
      const meta = await sharp(candidate).metadata();
      if (meta.width > 1000) return candidate;
    } catch {
      // A byte pair inside the raw sensor data that merely looks like a JPEG start.
    }
  }
  return null;
}

async function toWebp(file: string, ffmpegPath: string, scratch: string): Promise<Buffer> {
  const path = join(SOURCE_DIR, file);
  let frame: Buffer | null;
  let why = '';
  try {
    frame = decodeWithFfmpeg(path, ffmpegPath, scratch);
  } catch (error) {
    /*
     * Keep the reason. The first version swallowed it and reported «nothing could decode it» on
     * a file that decodes fine — the real cause was `FFMPEG_PATH` defaulting to the bare name
     * `ffmpeg`, which is not on PATH because this machine installs it portably under
     * `.services/` (see .env.example). A fallback that hides why the first path failed turns a
     * one-line configuration fix into a hunt.
     */
    const message = error instanceof Error ? error.message : String(error);
    why = message.split('\n')[0] ?? message;
    frame = await decodeEmbeddedPreview(readFileSync(path));
  }
  if (frame === null) {
    throw new Error(
      `${file}: ffmpeg could not decode it and it carries no usable preview — ${why}`,
    );
  }

  return sharp(frame)
    .rotate()
    .resize(MAX_EDGE, MAX_EDGE, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();
}

async function inspect(db: Database): Promise<void> {
  const slides = await db
    .select({ id: t.heroSlides.id, title: t.heroSlides.title, mediaId: t.heroSlides.mediaId })
    .from(t.heroSlides)
    .where(eq(t.heroSlides.site, 'umrah'))
    .orderBy(asc(t.heroSlides.sortOrder));
  process.stdout.write(`hero slides (umrah): ${String(slides.length)}\n`);
  for (const slide of slides) {
    const title = (slide.title as Record<string, string> | null)?.['tm'] ?? '—';
    // The storage key and alt, because «media=202» does not say whether the Medina slide is
    // showing Medina. It was showing a meal tray in a plastic bag.
    const [row] =
      slide.mediaId === null
        ? []
        : await db
            .select({
              key: t.media.storageKey,
              alt: t.media.alt,
              source: t.media.source,
              attribution: t.media.attribution,
            })
            .from(t.media)
            .where(eq(t.media.id, slide.mediaId))
            .limit(1);
    const alt =
      (row?.alt as Record<string, string> | null)?.['ru'] ??
      (row?.alt as Record<string, string> | null)?.['tm'] ??
      '(no alt)';
    process.stdout.write(
      `  #${String(slide.id)} media=${String(slide.mediaId)}  ${title.padEnd(8)} ` +
        `${String(row?.source)}  ${alt}  [${String(row?.key)}]\n`,
    );
  }

  /*
   * Stock photographs whose caption mentions Medina.
   *
   * Asked because the slide titled «Medine» turned out to be holding a photograph of an airport
   * meal — a cup of porridge, a water bottle and a bread roll — captioned «Мечеть Пророка в
   * Медине» and marked `source: stock`. The same row is also the cover of `masjid-an-nabawi`,
   * so the Prophet's Mosque page was illustrated with a lunch tray. D-127 already records the
   * Commons import returning Mashhad for a search for Merv; this is the same failure surviving
   * the category filter, and nothing downstream could notice, because a wrong photograph is a
   * perfectly valid row.
   */
  const medina = await db
    .select({
      id: t.media.id,
      alt: t.media.alt,
      key: t.media.storageKey,
      checksum: t.media.checksum,
    })
    .from(t.media)
    .where(eq(t.media.source, 'stock'));
  const candidates = medina.filter((row) => {
    const text = JSON.stringify(row.alt ?? '');
    return /медин|medin|nabaw|nebew|пророк/i.test(text);
  });
  process.stdout.write(`\nstock photographs captioned Medina: ${String(candidates.length)}\n`);
  for (const row of candidates) {
    const alt = row.alt?.ru ?? '(no ru alt)';
    process.stdout.write(`  #${String(row.id)}  ${alt}  [${row.key}]  ${row.checksum}\n`);
  }

  /*
   * What the stock library actually holds, by caption.
   *
   * Asked because seven of the nine ziyarat covers turned out to be «Туркменская кухня» and
   * «Люди Туркменистана» — the importer's round-robin handing Turkmen photographs to Saudi
   * places when it could not match a subject. The question that decides the repair is whether
   * the right photographs were downloaded and never placed, or never downloaded at all.
   */
  const bySubject = new Map<string, number>();
  const allStock = await db
    .select({ alt: t.media.alt })
    .from(t.media)
    .where(eq(t.media.source, 'stock'));
  for (const row of allStock) {
    const key = row.alt?.ru ?? row.alt?.tm ?? '(no alt)';
    bySubject.set(key, (bySubject.get(key) ?? 0) + 1);
  }
  process.stdout.write(`\nstock library by caption (${String(allStock.length)} photographs):\n`);
  for (const [caption, count] of [...bySubject].sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${String(count).padStart(3)}  ${caption}\n`);
  }

  const places = await db
    .select({
      id: t.ziyaratPlaces.id,
      slug: t.ziyaratPlaces.slug,
      cover: t.ziyaratPlaces.coverMediaId,
    })
    .from(t.ziyaratPlaces)
    .orderBy(asc(t.ziyaratPlaces.sortOrder));
  process.stdout.write(`\nziyarat places: ${String(places.length)}\n`);
  for (const place of places) {
    // The cover's own caption beside the place's name. They are supposed to describe the same
    // thing; where they do not, the page is illustrated with something else entirely.
    const [row] =
      place.cover === null
        ? []
        : await db
            .select({ alt: t.media.alt, key: t.media.storageKey, source: t.media.source })
            .from(t.media)
            .where(eq(t.media.id, place.cover))
            .limit(1);
    const alt = row?.alt?.ru ?? row?.alt?.tm ?? '(no alt)';
    process.stdout.write(
      `  #${String(place.id)} cover=${String(place.cover)} ${place.slug.padEnd(26)} ` +
        `${String(row?.source)}  ${alt}  [${String(row?.key)}]\n`,
    );
  }

  const groups = await db
    .select({
      id: t.umrahGroups.id,
      slug: t.umrahGroups.slug,
      cover: t.umrahGroups.coverMediaId,
      departed: t.umrahGroups.departedOn,
      pilgrims: t.umrahGroups.pilgrimsCount,
      label: t.umrahGroups.label,
      shortLabel: t.umrahGroups.shortLabel,
    })
    .from(t.umrahGroups)
    .orderBy(asc(t.umrahGroups.sortOrder));
  process.stdout.write(`\numrah groups: ${String(groups.length)}\n`);
  for (const group of groups) {
    const media = await db
      .select({ id: t.umrahGroupMedia.id })
      .from(t.umrahGroupMedia)
      .where(eq(t.umrahGroupMedia.groupId, group.id));
    process.stdout.write(
      `  #${String(group.id)} ${group.slug.padEnd(12)} departed=${String(group.departed)} ` +
        `pilgrims=${String(group.pilgrims)} media=${String(media.length)}  ` +
        `«${group.label.tm ?? '—'}» / «${group.shortLabel?.tm ?? '—'}»\n`,
    );
  }

  /*
   * The Umrah content slots, counted by what their photograph is captioned.
   *
   * Ninety slots and none empty looked like a finished site. It is the same round-robin: the
   * question is how many of the ninety are illustrated with Turkmenistan.
   */
  const slotRows = await db
    .select({ media: t.contentSlots.mediaId, alt: t.media.alt })
    .from(t.contentSlots)
    .leftJoin(t.media, eq(t.contentSlots.mediaId, t.media.id))
    .where(eq(t.contentSlots.site, 'umrah'));

  const slotSubjects = new Map<string, number>();
  for (const row of slotRows) {
    const key = row.media === null ? '(empty)' : (row.alt?.ru ?? row.alt?.tm ?? '(no alt)');
    slotSubjects.set(key, (slotSubjects.get(key) ?? 0) + 1);
  }
  process.stdout.write(`\numrah content slots: ${String(slotRows.length)}, by caption:\n`);
  for (const [caption, count] of [...slotSubjects].sort((a, b) => b[1] - a[1])) {
    process.stdout.write(`  ${String(count).padStart(3)}  ${caption}\n`);
  }
}

async function main(): Promise<void> {
  const env = loadEnv();

  if (process.argv.includes('--inspect')) {
    await withDb(inspect);
    return;
  }

  const scratch = mkdtempSync(join(tmpdir(), 'charva-umrah-'));
  try {
    await withDb(async (db) => {
      const [owner] = await db
        .select({ id: t.adminUsers.id })
        .from(t.adminUsers)
        .orderBy(asc(t.adminUsers.id))
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
        actor: { id: owner?.id ?? 0, role: 'owner' as const, siteScope: 'umrah' as const },
        ip: '127.0.0.1',
        uploadsDir: env.UPLOADS_DIR,
        ffmpegPath: env.FFMPEG_PATH,
        ffprobePath: env.FFPROBE_PATH,
      };

      /** Every media id this run has placed, so nothing is used twice. */
      const placed = new Set<number>();

      const everything: Frame[] = [
        ...KEEP,
        ...LIBRARY_ONLY.map((file) => ({
          file,
          name: file.replace(/\.(HEIC|DNG)$/i, '').toLowerCase(),
          alt: null,
          target: null,
        })),
      ];

      const stored = new Map<string, number>();
      for (const frame of everything) {
        const webp = await toWebp(frame.file, env.FFMPEG_PATH, scratch);
        const result = await storeUpload(context, {
          filename: `${frame.name}.webp`,
          buffer: webp,
          source: 'upload',
        });
        stored.set(frame.file, result.media.id);

        // `storeUpload` records the bytes; what the picture shows is this script's to write.
        if (frame.alt !== null) {
          await db.update(t.media).set({ alt: frame.alt }).where(eq(t.media.id, result.media.id));
        }

        process.stdout.write(
          `${result.isDuplicate ? 'have' : 'new '} #${String(result.media.id)}  ` +
            `${frame.name.padEnd(30)} ${(webp.length / 1024).toFixed(0)} kB\n`,
        );
      }

      process.stdout.write('\n--- repairing what the stock import got wrong ---\n');
      await repairMedina(db);

      process.stdout.write('\n--- placing ---\n');

      const slides = await db
        .select({ id: t.heroSlides.id })
        .from(t.heroSlides)
        .where(eq(t.heroSlides.site, 'umrah'))
        .orderBy(asc(t.heroSlides.sortOrder));

      /*
       * Which group these belong to is not knowable from the files.
       *
       * The gallery is organised by group (D-75), so a photograph needs one. There are six, all
       * with empty galleries, and nothing in the files says which trip this was: the messaging
       * app the photographs arrived through stripped EXIF, so there is no date and no GPS. The
       * most recent group is a guess, and a guess here captions the owner's photographs with
       * somebody else's journey.
       *
       * So it is an argument, not a default. Without it the slider and the Haram cover are still
       * filled — those are claims the pictures support on their own — and everything else is
       * converted into the media library for the owner to place, or to re-run this with:
       *
       *   pnpm --filter @charva/api db:umrah-photos -- --group=awgust26
       *
       * The owner named the trip after the fact: 25 August to 9 September. That group had no
       * row, so `--group=awgust26` creates it — see OWNER_TRIP above for what is asserted and
       * what is inferred.
       */
      const wanted = process.argv.find((arg) => arg.startsWith('--group='))?.slice(8);

      const findGroup = async (slug: string): Promise<{ id: number; slug: string } | undefined> => {
        const [row] = await db
          .select({ id: t.umrahGroups.id, slug: t.umrahGroups.slug })
          .from(t.umrahGroups)
          .where(eq(t.umrahGroups.slug, slug))
          .limit(1);
        return row;
      };

      let group = wanted === undefined ? undefined : await findGroup(wanted);

      /*
       * Create the trip if it is the one these photographs are from.
       *
       * The script is what reaches production, not this machine's database — content is not in
       * git. So it has to be able to make the row it needs, or running it on the live site would
       * stop with «no group awgust26» and the photographs would have nowhere to go. Only this
       * one slug is ever created: any other name is a typo, and a group invented from a typo is
       * worse than a refusal.
       */
      if (wanted === OWNER_TRIP.slug && group === undefined) {
        await db.insert(t.umrahGroups).values({
          slug: OWNER_TRIP.slug,
          departedOn: OWNER_TRIP.departedOn,
          label: OWNER_TRIP.label,
          shortLabel: OWNER_TRIP.shortLabel,
          description: OWNER_TRIP.description,
          isPublished: true,
        });
        group = await findGroup(OWNER_TRIP.slug);
        process.stdout.write(
          `created group «${OWNER_TRIP.slug}», departed ${OWNER_TRIP.departedOn}\n`,
        );
      }

      if (wanted !== undefined && group === undefined) {
        const all = await db.select({ slug: t.umrahGroups.slug }).from(t.umrahGroups);
        throw new Error(
          `no group «${wanted}». Known: ${all.map((row) => row.slug).join(', ')}. ` +
            `Only «${OWNER_TRIP.slug}» is created automatically.`,
        );
      }
      if (wanted === undefined) {
        process.stdout.write(
          'no --group given: filling the slider and the Haram cover only, and leaving the rest in the library\n',
        );
      }

      let galleryOrder = 0;
      for (const frame of KEEP) {
        const mediaId = stored.get(frame.file);
        if (mediaId === undefined || frame.target === null) continue;
        if (placed.has(mediaId)) continue;

        switch (frame.target.kind) {
          case 'heroSlide': {
            const slide = slides[frame.target.order];
            if (slide === undefined) break;
            await db.update(t.heroSlides).set({ mediaId }).where(eq(t.heroSlides.id, slide.id));
            placed.add(mediaId);
            process.stdout.write(`  hero slide #${String(slide.id)} <- ${frame.name}\n`);
            break;
          }
          case 'ziyaratCover': {
            const [place] = await db
              .select({ id: t.ziyaratPlaces.id, slug: t.ziyaratPlaces.slug })
              .from(t.ziyaratPlaces)
              .where(like(t.ziyaratPlaces.slug, `%${frame.target.match}%`))
              .limit(1);
            if (place === undefined) {
              process.stdout.write(
                `  no ziyarat place matching «${frame.target.match}» — ${frame.name} stays in the library\n`,
              );
              break;
            }
            await db
              .update(t.ziyaratPlaces)
              .set({ coverMediaId: mediaId })
              .where(eq(t.ziyaratPlaces.id, place.id));
            placed.add(mediaId);
            process.stdout.write(`  ziyarat «${place.slug}» <- ${frame.name}\n`);
            break;
          }
          case 'groupCover': {
            if (group === undefined) break;
            await db
              .update(t.umrahGroups)
              .set({ coverMediaId: mediaId })
              .where(eq(t.umrahGroups.id, group.id));
            placed.add(mediaId);
            process.stdout.write(`  group cover <- ${frame.name}\n`);
            break;
          }
          case 'gallery': {
            if (group === undefined) break;
            const [already] = await db
              .select({ id: t.umrahGroupMedia.id })
              .from(t.umrahGroupMedia)
              .where(
                and(
                  eq(t.umrahGroupMedia.groupId, group.id),
                  eq(t.umrahGroupMedia.mediaId, mediaId),
                ),
              )
              .limit(1);
            if (already !== undefined) {
              placed.add(mediaId);
              break;
            }
            await db.insert(t.umrahGroupMedia).values({
              groupId: group.id,
              kind: 'photo',
              mediaId,
              caption: frame.alt,
              sortOrder: galleryOrder++,
            });
            placed.add(mediaId);
            process.stdout.write(`  gallery <- ${frame.name}\n`);
            break;
          }
        }
      }

      /*
       * Anything still empty gets nothing from this run.
       *
       * Content slots name specific pages and specific art direction, and a photograph of Mecca
       * is not an illustration of «the signup form» just because both are on the Umrah site. The
       * slot list stays a visible checklist (D-21), which is what it is for.
       */
      const stillEmpty = await db
        .select({ page: t.contentSlots.page, key: t.contentSlots.slotKey })
        .from(t.contentSlots)
        .where(and(eq(t.contentSlots.site, 'umrah'), isNull(t.contentSlots.mediaId)));
      process.stdout.write(
        `\n${String(placed.size)} photographs placed, ${String(stored.size - placed.size)} left in the library, ` +
          `${String(stillEmpty.length)} Umrah slots still waiting for art direction.\n`,
      );
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

await main();
