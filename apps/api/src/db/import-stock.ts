import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

import { eq, inArray, isNull, sql } from 'drizzle-orm';

import { loadEnv } from '../env';
import { storeUpload, uploadsRootOf } from '../modules/admin/media/service';

import { withDb } from './client';
import * as t from './schema';

/**
 * Fills the empty picture slots with freely licensed photographs, as a stand-in.
 *
 * Question Q-1: there is not one photograph of this operator's own trips, and 174 slots are
 * waiting for one. Decision D-25 anticipated exactly this — stock arrives with `source`,
 * `attribution` and `license` filled and `is_placeholder` set, and the production deploy is
 * blocked while any of those rows remain. This is the script that does it.
 *
 * **Every one of these is a placeholder and is marked as one.** They are other people's
 * photographs of the same places, not the operator's, and most carry a licence that requires a
 * visible credit if published. What they buy is a site that can be shown and reviewed today
 * instead of after a shoot.
 *
 * Wikimedia Commons rather than a stock library, for one reason: its API states the licence and
 * the author of every file, so `attribution` and `license` are recorded from what the source says
 * rather than from what somebody assumed. A licence not on {@link ALLOWED} is skipped.
 *
 * Photographs are taken from **categories**, not from a text search. The first version searched,
 * and a search for «Merv» returned two photographs of Mashhad — a different city in a different
 * country — which is exactly the failure that is invisible until somebody who knows the place
 * looks at the page. A category is curated by people who know what is in it.
 *
 *   pnpm --filter @charva/api db:stock            fill what is still empty
 *   pnpm --filter @charva/api db:stock -- --reset detach and re-pick every placeholder
 *
 * Re-running without `--reset` is safe and nearly a no-op: identical bytes return the existing
 * row and only empty slots are filled. `--reset` never touches a photograph the owner uploaded:
 * it works strictly on rows with `is_placeholder = 1`.
 */

const COMMONS = 'https://commons.wikimedia.org/w/api.php';

/** Wikimedia asks for a real one, and an anonymous script deserves to be rate-limited. */
const USER_AGENT = 'CharvaTravelSiteBuilder/0.1 (https://charva-travel.com; dev content import)';

/**
 * Licences this script accepts, matched as a prefix of the short name.
 *
 * `CC BY-SA 4.0` and `CC BY 2.0` both pass. Non-commercial, no-derivatives and fair-use do not,
 * because this is a commercial site and «we will sort the licence out later» is how a licence
 * never gets sorted out.
 */
const ALLOWED = ['CC0', 'Public domain', 'CC BY'];

/**
 * Files that are images *of* the subject rather than pictures *taken at* it.
 *
 * Grown by looking at what got through. The first list let a commemorative coin of Merv, a
 * Kunya-Urgench meteorite and two maps of the Karakum onto the page — none of which contain the
 * words «coin», «map» or anything else worth guessing at. `LCCN` is the Library of Congress
 * accession prefix and marks a scan of a nineteenth-century engraving; a four-digit year before
 * 1990 in a title means the same thing.
 */
const NOT_A_PHOTOGRAPH =
  /(\b(map|karte|flag|coat[ _]of[ _]arms|emblem|logo|stamp|coin|banknote|medal|meteorite|diagram|chart|scheme|seal|locator|plan|drawing|engraving|lithograph|poster|svg|icon)\b|LCCN\d|RR\d{4})/i;

/**
 * A photograph of the place being rebuilt rather than of the place.
 *
 * The Masjid al-Haram category is full of the expansion works, and the chooser's Umrah half came
 * back as a pit of tower cranes — on the page that sells a pilgrimage. Nothing about the file
 * says «wrong»: it is a good photograph, correctly categorised, of the right coordinates.
 */
const BUILDING_SITE = /\b(construction|expansion|crane|scaffold|renovation|demolition|excavat)/i;

/**
 * Files looked at and turned down by eye, because no rule above could have caught them.
 *
 * The two holy sites are where this matters most and where the heuristics are weakest: the
 * categories are large, well-maintained and full of photographs that are correct, well-lit and
 * completely unusable on a page selling a pilgrimage. Of the first eight fetched, four were —
 * a wheelie bin beside an information screen, a steel footbridge at night, a pit of tower cranes
 * shot by the contractor rebuilding the mosque, and a nineteenth-century engraving whose title
 * carries no date for {@link HISTORICAL} to find.
 *
 * A list of names is the honest form for this. It says «somebody looked», it can be reviewed,
 * and it grows one line at a time — unlike a regular expression, which would have to be guessed
 * at and would quietly take good photographs with it.
 */
const REJECTED = new Set([
  'Masjidil Haram (Umroh Ramadhan 2023)-1.jpg',
  'Masjidil Haram (Umroh Ramadhan 2023)-2.jpg',
  'Masjidil Haram (Umroh Ramadhan 2023)-3.jpg',
  'Masjid-Al-Nabawi Madinah.jpg',
  /*
   * Not a bad photograph and not the wrong place — Jannat al-Baqi is a real ziyarat site and
   * pilgrims do visit it. But nothing here knows that, so it can only ever be dealt out as
   * generic Medina scenery, and it arrived as the hero of the half that sells the pilgrimage:
   * a field of grave mounds, full width, under the headline. It belongs on a page of its own or
   * nowhere, and there is no page of its own yet.
   */
  'Al-Baqi Cemetery 2021.jpg',
]);

/**
 * Whole collections that are art about a place rather than photographs of it.
 *
 * The Khalili Collection is engravings, manuscripts and painted panoramas of the Hajj. Every
 * file in it is beautiful, correctly licensed and wrong for this, and naming them one by one
 * would be a list that grows for ever — its accession numbers run into the thousands.
 */
const REJECTED_PREFIXES = ['Khalili Collection'];

/** A title carrying a year from before photography of this kind existed here. */
const HISTORICAL = /\b(1[6-9]\d{2}|19[0-8]\d)\b/;

/** Below this a hero would be upscaled, and an upscaled hero looks like a mistake. */
const MIN_WIDTH = 1400;

interface Subject {
  key: string;
  /** Searched for in the category namespace; the best match is the one whose files are taken. */
  category: string;
  want: number;
  /**
   * Words that, appearing in a slot's Russian brief, mean this subject is what was asked for.
   *
   * The briefs are real art direction — «Газовый кратер Дарваза ночью, широкий кадр» — so
   * matching against them puts the crater where a crater was wanted rather than dealing pictures
   * into slots at random.
   */
  hints: string[];
  alt: { ru: string; en: string; tr: string };
}

const SUBJECTS: Subject[] = [
  {
    key: 'darvaza',
    category: 'Darvaza gas crater',
    want: 5,
    hints: ['дарваз', 'кратер', 'врата ада'],
    alt: {
      ru: 'Газовый кратер Дарваза в пустыне Каракумы',
      en: 'The Darvaza gas crater in the Karakum Desert',
      tr: 'Karakum Çölü’ndeki Darvaza gaz krateri',
    },
  },
  {
    key: 'ashgabat',
    category: 'Ashgabat',
    want: 8,
    hints: ['ашхабад', 'столиц', 'город', 'мрамор', 'проспект', 'фонтан'],
    alt: {
      ru: 'Ашхабад — белокаменная столица Туркменистана',
      en: 'Ashgabat, the white marble capital of Turkmenistan',
      tr: 'Türkmenistan’ın beyaz mermer başkenti Aşkabat',
    },
  },
  {
    key: 'nisa',
    category: 'Nisa, Turkmenistan',
    want: 3,
    hints: ['ниса', 'парфян', 'крепост', 'юнеско'],
    alt: {
      ru: 'Старая Ниса — парфянская крепость под Ашхабадом',
      en: 'Old Nisa, the Parthian fortress outside Ashgabat',
      tr: 'Aşkabat yakınındaki Part kalesi Eski Nisa',
    },
  },
  {
    key: 'merv',
    category: 'Merv',
    want: 4,
    hints: ['мерв', 'древн', 'шёлков', 'шелков', 'руин', 'городищ'],
    alt: {
      ru: 'Древний Мерв — город на Великом шёлковом пути',
      en: 'Ancient Merv, a city of the Silk Road',
      tr: 'İpek Yolu şehri Antik Merv',
    },
  },
  {
    key: 'konye_urgench',
    category: 'Konye-Urgench',
    want: 3,
    hints: ['ургенч', 'куняургенч', 'минарет', 'мавзолей', 'хорезм'],
    alt: {
      ru: 'Куняургенч — минареты и мавзолеи Хорезма',
      en: 'Konye-Urgench, the minarets and mausoleums of Khorezm',
      tr: 'Köneürgenç, Harezm’in minareleri ve türbeleri',
    },
  },
  {
    key: 'yangikala',
    category: 'Yangykala',
    want: 4,
    hints: ['янги', 'каньон', 'кала', 'обрыв'],
    alt: {
      ru: 'Каньоны Янги-Кала на западе Туркменистана',
      en: 'The Yangi Kala canyons in western Turkmenistan',
      tr: 'Batı Türkmenistan’daki Yangi Kala kanyonları',
    },
  },
  {
    key: 'caspian',
    category: 'Turkmenbashi',
    want: 4,
    hints: ['каспи', 'туркменбаши', 'аваза', 'море', 'пляж', 'берег'],
    alt: {
      ru: 'Каспийское побережье у Туркменбаши',
      en: 'The Caspian coast at Turkmenbashi',
      tr: 'Türkmenbaşı’ndaki Hazar kıyısı',
    },
  },
  {
    key: 'karakum',
    category: 'Karakum Desert',
    want: 4,
    hints: ['каракум', 'пустын', 'бархан', 'песок', 'юрт', 'звёзд', 'звезд'],
    alt: {
      ru: 'Барханы пустыни Каракумы',
      en: 'The dunes of the Karakum Desert',
      tr: 'Karakum Çölü’nün kumulları',
    },
  },
  {
    key: 'akhal_teke',
    category: 'Akhal-Teke',
    want: 3,
    hints: ['ахалтекин', 'конь', 'лошад', 'ипподром', 'скакун'],
    alt: {
      ru: 'Ахалтекинский конь — гордость Туркменистана',
      en: 'An Akhal-Teke horse, the pride of Turkmenistan',
      tr: 'Türkmenistan’ın gururu Ahal-Teke atı',
    },
  },
  {
    key: 'carpet',
    category: 'Turkmen carpets',
    want: 3,
    hints: ['ковёр', 'ковер', 'орнамент', 'ремесл', 'сувенир', 'узор'],
    alt: {
      ru: 'Туркменский ковёр ручной работы',
      en: 'A hand-woven Turkmen carpet',
      tr: 'El dokuması Türkmen halısı',
    },
  },
  {
    key: 'people',
    category: 'People of Turkmenistan',
    want: 4,
    hints: ['люди', 'гид', 'портрет', 'улыб', 'гост', 'семь'],
    alt: {
      ru: 'Люди Туркменистана',
      en: 'People of Turkmenistan',
      tr: 'Türkmenistan’ın insanları',
    },
  },
  {
    key: 'food',
    category: 'Cuisine of Turkmenistan',
    want: 3,
    hints: ['еда', 'кухн', 'плов', 'чай', 'ужин', 'обед', 'базар', 'рынок'],
    alt: {
      ru: 'Туркменская кухня',
      en: 'Turkmen cuisine',
      tr: 'Türkmen mutfağı',
    },
  },
  {
    key: 'kowata',
    category: 'Kow Ata',
    want: 2,
    hints: ['ков-ата', 'ков ата', 'подземн', 'озер', 'пещер'],
    alt: {
      ru: 'Подземное озеро Ков-Ата',
      en: 'The Kow Ata underground lake',
      tr: 'Kow Ata yeraltı gölü',
    },
  },
  {
    key: 'mekka',
    category: 'Masjid al-Haram',
    want: 4,
    hints: ['мекк', 'кааб', 'харам', 'mekge'],
    alt: {
      ru: 'Мечеть аль-Харам в Мекке',
      en: 'Masjid al-Haram in Mecca',
      tr: 'Mekke’deki Mescid-i Haram',
    },
  },
  {
    key: 'medina',
    category: 'Al-Masjid an-Nabawi',
    want: 4,
    hints: ['медин', 'пророк', 'набави', 'medine'],
    alt: {
      ru: 'Мечеть Пророка в Медине',
      en: 'The Prophet’s Mosque in Medina',
      tr: 'Medine’deki Mescid-i Nebevi',
    },
  },
];

interface Candidate {
  title: string;
  url: string;
  width: number;
  height: number;
  license: string;
  artist: string;
  descriptionUrl: string;
}

/** A photograph that made it into the library, with what the assignment needs to place it. */
interface Stored {
  id: number;
  subject: string;
  landscape: boolean;
}

function plainText(html: string | undefined): string {
  if (html === undefined) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function commons(params: Record<string, string>): Promise<unknown> {
  const url = new URL(COMMONS);
  url.search = new URLSearchParams({ format: 'json', ...params }).toString();

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`Commons answered ${String(response.status)}`);
  return response.json();
}

/** Resolves «Karakum Desert» to whatever Commons actually calls that category. */
async function findCategory(term: string): Promise<string | null> {
  const data = (await commons({
    action: 'query',
    list: 'search',
    srsearch: term,
    srnamespace: '14',
    srlimit: '1',
  })) as { query?: { search?: { title?: string }[] } };

  return data.query?.search?.[0]?.title ?? null;
}

interface CommonsPage {
  title?: string;
  imageinfo?: {
    thumburl?: string;
    url?: string;
    thumbwidth?: number;
    thumbheight?: number;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }[];
}

/**
 * Files found by name, for a subject whose category turns out to be an empty shell.
 *
 * `Category:Ashgabat` holds no files and no subcategories — everything about the capital is filed
 * elsewhere — so the subject the site needs most came back with nothing twice. The results are
 * required to carry the subject in their own title, which is the guard the first version lacked:
 * a free search for «Merv» returned photographs of Mashhad, and nothing in the pipeline noticed
 * that they were of a different city in a different country.
 */
async function searchFiles(term: string): Promise<Candidate[]> {
  const data = (await commons({
    action: 'query',
    generator: 'search',
    gsrsearch: term,
    gsrnamespace: '6',
    // Twenty-five, not forty. Above roughly thirty this generator answers `{}` — no error, no
    // warning, just no pages — and the subject silently produces nothing, which is how the
    // capital came back empty twice while every other subject looked fine.
    gsrlimit: '25',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '2200',
  })) as { query?: { pages?: Record<string, CommonsPage> } };

  const needle = term.split(/\s+/)[0]?.toLowerCase() ?? '';
  return collect(data, (title) => title.toLowerCase().includes(needle));
}

/** The subcategories of a category, so a hub category is not mistaken for an empty one. */
async function subcategoriesOf(category: string): Promise<string[]> {
  const data = (await commons({
    action: 'query',
    list: 'categorymembers',
    cmtitle: category,
    cmtype: 'subcat',
    cmlimit: '12',
  })) as { query?: { categorymembers?: { title?: string }[] } };

  return (data.query?.categorymembers ?? []).flatMap((row) =>
    row.title === undefined ? [] : [row.title],
  );
}

async function filesIn(category: string): Promise<Candidate[]> {
  const data = (await commons({
    action: 'query',
    generator: 'categorymembers',
    gcmtitle: category,
    gcmtype: 'file',
    gcmlimit: '60',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '2200',
  })) as { query?: { pages?: Record<string, CommonsPage> } };

  return collect(data, () => true);
}

/** Turns an API answer into the candidates that pass every rule above. */
function collect(
  data: { query?: { pages?: Record<string, CommonsPage> } },
  accept: (title: string) => boolean,
): Candidate[] {
  const found: Candidate[] = [];

  for (const page of Object.values(data.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    const title = page.title ?? '';
    if (info === undefined) continue;
    // JPEG only. A PNG on Commons is almost always a map, a scan or a diagram — both of the
    // «Karakum Desert» PNGs that got through the first pass were maps.
    if (info.mime !== 'image/jpeg') continue;
    if (NOT_A_PHOTOGRAPH.test(title) || HISTORICAL.test(title)) continue;
    if (BUILDING_SITE.test(title)) continue;
    const bare = title.replace(/^File:/, '');
    if (REJECTED.has(bare)) continue;
    if (REJECTED_PREFIXES.some((prefix) => bare.startsWith(prefix))) continue;
    if (!accept(title)) continue;

    const license = plainText(info.extmetadata?.['LicenseShortName']?.value);
    if (!ALLOWED.some((prefix) => license.startsWith(prefix))) continue;

    const url = info.thumburl ?? info.url;
    const width = info.thumbwidth ?? 0;
    const height = info.thumbheight ?? 0;
    if (url === undefined || width < MIN_WIDTH) continue;

    found.push({
      title: title.replace(/^File:/, ''),
      url,
      width,
      height,
      license,
      artist: plainText(info.extmetadata?.['Artist']?.value) || 'Wikimedia Commons',
      descriptionUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
    });
  }

  /*
   * Landscape first, then widest.
   *
   * Almost every frame on this site is wider than it is tall — a 21:9 hero, a 16:9 cover, a 4:3
   * card — and a portrait photograph in one of them is cropped to a vertical strip of its own
   * middle. The first run put a portrait shot of a stone head on a tour card and it looked
   * exactly as odd as that sounds.
   */
  return found
    .sort((a, b) => {
      const wide = Number(b.width > b.height) - Number(a.width > a.height);
      return wide !== 0 ? wide : b.width - a.width;
    })
    .slice(0, 60);
}

type Db = Awaited<Parameters<Parameters<typeof withDb>[0]>[0]>;

/** Every column that can point at a picture, and how to empty it. */
const NULLABLE_REFERENCES = [
  { table: t.contentSlots, column: t.contentSlots.mediaId, name: 'mediaId' },
  { table: t.heroSlides, column: t.heroSlides.mediaId, name: 'mediaId' },
  { table: t.tours, column: t.tours.coverMediaId, name: 'coverMediaId' },
  { table: t.hotels, column: t.hotels.coverMediaId, name: 'coverMediaId' },
  { table: t.articles, column: t.articles.coverMediaId, name: 'coverMediaId' },
  { table: t.placesToSee, column: t.placesToSee.coverMediaId, name: 'coverMediaId' },
  { table: t.ziyaratPlaces, column: t.ziyaratPlaces.coverMediaId, name: 'coverMediaId' },
] as const;

/**
 * Detaches and deletes every placeholder, leaving anything the owner uploaded alone.
 *
 * The filter is `is_placeholder = 1` and nothing else. That column is the whole reason the
 * distinction survives contact with a script — a naming convention would not have.
 */
async function reset(db: Db, uploadsRoot: string): Promise<void> {
  const placeholders = await db
    .select({ id: t.media.id, key: t.media.storageKey })
    .from(t.media)
    .where(eq(t.media.isPlaceholder, true));

  if (placeholders.length === 0) return;
  const ids = placeholders.map((row) => row.id);

  for (const reference of NULLABLE_REFERENCES) {
    await db
      .update(reference.table)
      .set({ [reference.name]: null })
      .where(inArray(reference.column, ids));
  }

  await db.delete(t.media).where(inArray(t.media.id, ids));

  for (const row of placeholders) {
    // A file left behind would be re-downloaded under the same name and never noticed.
    await unlink(join(uploadsRoot, row.key)).catch(() => undefined);
  }

  process.stdout.write(`reset: removed ${String(placeholders.length)} placeholders\n`);
}

async function main(): Promise<void> {
  const env = loadEnv();
  const wantsReset = process.argv.includes('--reset');

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

    if (wantsReset) await reset(db, uploadsRootOf(env.UPLOADS_DIR));

    const stored: Stored[] = [];

    for (const subject of SUBJECTS) {
      const category = await findCategory(subject.category);
      if (category === null) {
        process.stdout.write(`  ${subject.key}: no category found, skipped\n`);
        continue;
      }

      /*
       * A category, and its children if it turns out to be a hub.
       *
       * `Category:Ashgabat` holds almost no files directly — everything is filed under
       * «Monuments in Ashgabat», «Streets in Ashgabat» and so on — so the first run came back
       * with nothing at all for the capital, which is the subject the site needs most.
       */
      let candidates = await filesIn(category);
      if (candidates.length < subject.want * 2) {
        for (const child of await subcategoriesOf(category)) {
          candidates = candidates.concat(await filesIn(child));
          if (candidates.length >= subject.want * 3) break;
        }
      }
      // Still nothing: the category is an empty shell, so fall back to names.
      if (candidates.length < subject.want) {
        candidates = candidates.concat(await searchFiles(subject.category));
      }
      let kept = 0;

      for (const candidate of candidates) {
        if (kept >= subject.want) break;

        try {
          const response = await fetch(candidate.url, { headers: { 'User-Agent': USER_AGENT } });
          if (!response.ok) continue;
          const buffer = Buffer.from(await response.arrayBuffer());

          const result = await storeUpload(context, {
            filename: candidate.title,
            buffer,
            source: 'stock',
          });

          // `storeUpload` records the bytes; the provenance is this script's to write.
          await db
            .update(t.media)
            .set({
              source: 'stock',
              attribution: `${candidate.artist} · ${candidate.descriptionUrl}`.slice(0, 255),
              license: candidate.license.slice(0, 120),
              isPlaceholder: true,
              alt: subject.alt,
            })
            .where(eq(t.media.id, result.media.id));

          stored.push({
            id: result.media.id,
            subject: subject.key,
            landscape: (result.media.width ?? 0) >= (result.media.height ?? 1),
          });
          kept += 1;

          process.stdout.write(
            `  ${subject.key.padEnd(14)} ${candidate.license.padEnd(16)} ${candidate.title}\n`,
          );
        } catch (error) {
          // One unreachable file must not cost the other fifty.
          process.stdout.write(`  ${subject.key}: skipped one (${String(error)})\n`);
        }
      }
    }

    if (stored.length === 0) throw new Error('nothing was imported; leaving the slots alone');
    process.stdout.write(`\nstored ${String(stored.length)} photographs\n`);

    await assign(db, stored);
  });
}

/**
 * Puts each photograph where something asked for one.
 *
 * Briefs first — a slot whose brief says «Газовый кратер Дарваза ночью» gets the crater — and
 * whatever is left is dealt round-robin, which is the honest thing to do with a slot describing a
 * photograph nobody has taken yet.
 */
async function assign(db: Db, stored: Stored[]): Promise<void> {
  const landscape = stored.filter((photo) => photo.landscape);
  const pool = landscape.length > 0 ? landscape : stored;
  let cursor = 0;

  const pick = (text: string, wide: boolean): number => {
    const haystack = text.toLowerCase();

    /*
     * The subject the brief mentions first wins, not the one listed first here.
     *
     * «Фон: каньон Йангыкала на закате или Ашхабад ночью» names two subjects and means the
     * first one; matching in declaration order gave the chooser a hazy aerial of the Ashgabat
     * suburbs, which under that page's heavy scrim is indistinguishable from an empty panel.
     * A brief is a sentence, and the thing it opens with is the thing it is about.
     */
    const matched = SUBJECTS.map((subject) => {
      const at = subject.hints.map((hint) => haystack.indexOf(hint)).filter((index) => index >= 0);
      return { subject, at: at.length === 0 ? Infinity : Math.min(...at) };
    })
      .filter((entry) => entry.at !== Infinity)
      .sort((a, b) => a.at - b.at)[0]?.subject;

    const candidates = matched
      ? stored.filter((photo) => photo.subject === matched.key && (!wide || photo.landscape))
      : [];

    const from = candidates.length > 0 ? candidates : wide ? pool : stored;
    cursor += 1;

    const chosen = from[cursor % from.length];
    // `main` refuses to assign when nothing was imported, so this cannot fire — and if the
    // guard above it is ever loosened, an exception beats writing a null into every slot.
    if (chosen === undefined) throw new Error('no photograph to assign');
    return chosen.id;
  };

  const slots = await db
    .select({ id: t.contentSlots.id, brief: t.contentSlots.brief, key: t.contentSlots.slotKey })
    .from(t.contentSlots)
    .where(isNull(t.contentSlots.mediaId));

  for (const slot of slots) {
    // The chooser's two panels are the only frames on any of the three sites that are taller
    // than they are wide, so they are the only ones a portrait photograph suits.
    const wide = !slot.key.startsWith('choice-');
    await db
      .update(t.contentSlots)
      .set({ mediaId: pick(`${slot.brief} ${slot.key}`, wide) })
      .where(eq(t.contentSlots.id, slot.id));
  }
  process.stdout.write(`filled ${String(slots.length)} content slots\n`);

  /*
   * The hero slides, matched on their own brief.
   *
   * Separate from the covers below because the column is `media_id` rather than `cover_media_id`
   * and because the text to match on is the brief — «Газовый кратер Дарваза ночью» — rather than
   * the caption, which is one word. Always wide: these are 21:9 frames across the whole window,
   * and a portrait photograph in one is a vertical strip of its own middle.
   */
  const slides = await db
    .select({ id: t.heroSlides.id, brief: t.heroSlides.brief, title: t.heroSlides.title })
    .from(t.heroSlides)
    .where(isNull(t.heroSlides.mediaId));

  for (const slide of slides) {
    const caption = Object.values(slide.title as Record<string, string>).join(' ');
    await db
      .update(t.heroSlides)
      .set({ mediaId: pick(`${slide.brief ?? ''} ${caption}`, true) })
      .where(eq(t.heroSlides.id, slide.id));
  }
  process.stdout.write(`filled ${String(slides.length)} hero slides\n`);

  const covers = [
    { name: 'tours', table: t.tours, column: t.tours.coverMediaId, label: t.tours.title },
    { name: 'hotels', table: t.hotels, column: t.hotels.coverMediaId, label: t.hotels.name },
    {
      name: 'articles',
      table: t.articles,
      column: t.articles.coverMediaId,
      label: t.articles.title,
    },
    {
      name: 'places',
      table: t.placesToSee,
      column: t.placesToSee.coverMediaId,
      label: t.placesToSee.name,
    },
    {
      name: 'ziyarat',
      table: t.ziyaratPlaces,
      column: t.ziyaratPlaces.coverMediaId,
      label: t.ziyaratPlaces.name,
    },
  ] as const;

  for (const cover of covers) {
    const rows = await db
      .select({ id: sql<number>`id`, label: cover.label })
      .from(cover.table)
      .where(isNull(cover.column));

    for (const row of rows) {
      const text = Object.values(row.label as Record<string, string>).join(' ');
      await db
        .update(cover.table)
        .set({ coverMediaId: pick(text, true) })
        .where(sql`id = ${row.id}`);
    }
    process.stdout.write(`filled ${String(rows.length)} ${cover.name} covers\n`);
  }
}

await main();
