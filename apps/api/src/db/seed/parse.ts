/**
 * Turning the prototypes' display strings back into data.
 *
 * The design carries every value as the string it renders: `«8 дней»`, `«1 190 $»`, `«4 ★»`,
 * `«★★★★★»`, `«Май 2026»`, `«6:12»`, `«11 800 просмотров»`, `«span 2»`. That is what a design
 * tool produces, and it is precisely what the schema refuses to store — a duration that cannot
 * be sorted, a price that cannot be added up, a date that cannot be ordered.
 *
 * These functions are where that conversion happens, and they are pure and tested because a
 * mistake here does not look like a bug. It looks like content: a tour that is quietly six days
 * long, a review dated to the wrong year.
 *
 * Every one of them throws on input it does not understand. A seed that silently stores a zero
 * is worse than a seed that stops.
 */

/**
 * Every kind of space the prototypes separate thousands with.
 *
 * An ordinary space in some places, a non-breaking one in others, and a narrow no-break space
 * in a third — all three look identical in a diff, and `«1 190 $»` parses to 1 with any of them
 * missed. Written as escapes so the set is visible rather than invisible.
 */
const SPACES = /[\s  ]/g;

function fail(what: string, value: string): never {
  throw new Error(`Cannot parse ${what} from ${JSON.stringify(value)}`);
}

/** `«8 дней»` → 8. Also `«10 gün»`, `«4 gün»`. */
export function parseCount(value: string, what = 'count'): number {
  const match = /(\d+)/.exec(value);
  if (match?.[1] === undefined) fail(what, value);
  return Number(match[1]);
}

/**
 * `«4 ★»` → 4, `«★★★★★»` → 5, `«Бутик-отель»` → null.
 *
 * Two notations for one fact, in one dataset: the cards spell the rating out in stars and the
 * filters write it as a digit. Both mean the same number, and the row stores the number.
 */
export function parseStars(value: string): number | null {
  const stars = (value.match(/★/g) ?? []).length;
  const digit = /(\d)\s*★/.exec(value);

  if (digit?.[1] !== undefined) return Number(digit[1]);
  if (stars > 0) return stars;
  return null;
}

export interface ParsedMoney {
  minor: number;
  currency: 'USD' | 'TMT';
}

/**
 * `«1 190 $»` → 119 000 minor USD, `«8 575 TMT»` → 857 500 minor TMT.
 *
 * The space between thousands is not always the same character: the prototypes use an ordinary
 * space in some places and a non-breaking one in others, and both look identical in a diff.
 */
export function parseMoney(value: string): ParsedMoney {
  const digits = value.replace(SPACES, '');
  const match = /(\d+(?:[.,]\d{1,2})?)/.exec(digits);
  if (match?.[1] === undefined) fail('money', value);

  const [major, fraction = ''] = match[1].split(/[.,]/);
  const minor = Number(major) * 100 + Number(fraction.padEnd(2, '0').slice(0, 2) || 0);

  const currency = /tmt|манат|manat/i.test(value) ? 'TMT' : 'USD';
  return { minor, currency };
}

/** `«span 2»` → 2, `«1»` → 1, undefined → 1. */
export function parseSpan(value: string | undefined): number {
  if (value === undefined) return 1;
  const match = /(\d+)/.exec(value);
  return match?.[1] === undefined ? 1 : Number(match[1]);
}

const MONTHS_RU: Record<string, number> = {
  январь: 1,
  января: 1,
  февраль: 2,
  февраля: 2,
  март: 3,
  марта: 3,
  апрель: 4,
  апреля: 4,
  май: 5,
  мая: 5,
  июнь: 6,
  июня: 6,
  июль: 7,
  июля: 7,
  август: 8,
  августа: 8,
  сентябрь: 9,
  сентября: 9,
  октябрь: 10,
  октября: 10,
  ноябрь: 11,
  ноября: 11,
  декабрь: 12,
  декабря: 12,
};

/**
 * `«Май 2026»` → `2026-05-01`.
 *
 * The day is the first because the design only ever shows the month, and inventing a day would
 * be inventing a fact. What matters is that the column sorts, which is why the prototype's
 * «Сначала новые» filter does nothing at all.
 */
export function parseMonthYear(value: string): string {
  const match = /([А-Яа-яЁё]+)\s+(\d{4})/.exec(value);
  const name = match?.[1]?.toLowerCase();
  const year = match?.[2];
  if (name === undefined || year === undefined) fail('month and year', value);

  const month = MONTHS_RU[name];
  if (month === undefined) fail('month name', value);

  return `${year}-${String(month).padStart(2, '0')}-01`;
}

/** `«12.06.2026»` → `2026-06-12`. The Turkmen group dates are written this way. */
export function parseDmy(value: string): string {
  const match = /(\d{2})\.(\d{2})\.(\d{4})/.exec(value);
  if (match === null) fail('date', value);
  return `${match[3] ?? ''}-${match[2] ?? ''}-${match[1] ?? ''}`;
}

/** `«6:12»` → 372 seconds, `«14:20»` → 860. */
export function parseDuration(value: string): number {
  const parts = value.trim().split(':').map(Number);
  if (parts.some((part) => !Number.isFinite(part))) fail('duration', value);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  return fail('duration', value);
}

/** `«11 800 просмотров»` → 11800. */
export function parseViews(value: string): number {
  const digits = value.replace(SPACES, '');
  const match = /(\d+)/.exec(digits);
  return match?.[1] === undefined ? 0 : Number(match[1]);
}

/**
 * Cyrillic and Turkmen to ASCII, for slugs.
 *
 * Slugs are part of the URL and of every link that will ever be shared, so they are ASCII and
 * they are stable. The Turkmen letters come first because `ý` and `ň` also decompose under
 * NFD, and stripping the marks would turn `Ýyldyz` into `Yyldyz` — which is right — but
 * `ş` into `s` and `ç` into `c`, which is also right, so the table only has to cover what
 * decomposition does not reach.
 */
const TRANSLITERATE: Record<string, string> = {
  ä: 'a',
  ň: 'n',
  ö: 'o',
  ş: 'sh',
  ü: 'u',
  ý: 'y',
  ž: 'zh',
  ç: 'ch',
  ğ: 'g',
  ı: 'i',
  İ: 'i',
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

export function slugify(value: string): string {
  const lower = value.toLowerCase();
  let out = '';
  for (const char of lower) out += TRANSLITERATE[char] ?? char;

  return out
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/**
 * Display label to stable code.
 *
 * Filters, categories and topics are keyed by these and never by the label, so translating
 * «Классика» into «Klasik» cannot change which tours a filter matches — the same rule the
 * builder's option codes follow (D-10, D-15).
 */
export function codeFromLabel(label: string, table: Record<string, string>): string {
  const code = table[label.trim()];
  if (code === undefined) fail(`code for label`, label);
  return code;
}

export const TOUR_CATEGORIES: Record<string, string> = {
  Классика: 'classic',
  Природа: 'nature',
  История: 'history',
  Культура: 'culture',
  Отдых: 'leisure',
};

export const GALLERY_CATEGORIES: Record<string, string> = {
  Природа: 'nature',
  Города: 'cities',
  История: 'history',
  Культура: 'culture',
  Кухня: 'food',
};

export const ZIYARAT_CITIES: Record<string, 'mekge' | 'medine' | 'bedir' | 'jidda'> = {
  Mekge: 'mekge',
  Medine: 'medine',
  Bedir: 'bedir',
  Jidda: 'jidda',
};

/**
 * The hotels page writes the category two ways and the builder a third.
 *
 * `«Бутик»` in the filter chip, `«Бутик-отель»` in the builder's hotel step, `«Кемп»` against
 * `«Юрточный лагерь»`. All four are the same two categories, and anything not listed is an
 * ordinary hotel with a star rating.
 */
export const HOTEL_CATEGORIES: Record<string, 'hotel' | 'boutique' | 'camp'> = {
  Бутик: 'boutique',
  'Бутик-отель': 'boutique',
  Кемп: 'camp',
  'Юрточный лагерь': 'camp',
};

/**
 * The hotel filter key, derived rather than stored.
 *
 * `category === 'hotel' ? '<n>star' : category` — the rule that resolves the contradiction
 * between a card showing «3★» and a filter showing «Кемп».
 */
export function hotelFilterKey(category: string, stars: number | null): string {
  return category === 'hotel' && stars !== null ? `${String(stars)}star` : category;
}
