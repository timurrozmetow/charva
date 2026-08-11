import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as fontkit from 'fontkit';
import { describe, expect, it } from 'vitest';

/**
 * Glyph coverage.
 *
 * The Umrah site's primary audience reads Turkmen and Global serves Russian, English and
 * Turkish. A font missing `ň`, `ý` or `ž` renders tofu on the most important page of the site,
 * and nobody testing in Russian would ever see it. So this is checked on every build rather
 * than assumed.
 *
 * It has already earned its keep. Stolzl as delivered covers Turkmen and Cyrillic completely,
 * but is missing three Turkish letters and every symbol the design uses as content. Both gaps
 * are recorded below and neither was mentioned in the handoff.
 */

const fontsDir = fileURLToPath(new URL('../assets/fonts/', import.meta.url));

/** Coverage the fonts must have. A failure here blocks the phase. */
const REQUIRED = {
  latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  punctuation: '.,;:!?\'"()[]{}«»—–-…/\\&@#%*+=<>№',
  cyrillic: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя',
  /** Turkmen Latin. `ň` and `ý` appear in almost every heading on the Umrah site. */
  turkmen: 'ÄŇÖŞÜÝŽäňöşüýž',
  /** The Turkish letters Stolzl does have. */
  turkishPartial: 'ÇIÖŞÜçıöşü',
} as const;

/**
 * Known gaps, asserted as gaps.
 *
 * A test that fails forever teaches everyone to ignore it. These assert the gap is still
 * exactly what we believe it is, so the day a fuller cut of Stolzl arrives this suite fails
 * and tells us to delete the workarounds rather than leaving them in place for years.
 */
const KNOWN_GAPS = {
  /**
   * Turkish G-breve and dotted capital I. Question Q-17: Turkish cannot be typeset in Stolzl
   * until the foundry supplies a cut with Latin Extended-A, or `:lang(tr)` falls back.
   * `ğ` is not rare — it is in Ağustos, doğa, değil, and it is in most Turkish paragraphs.
   */
  turkish: 'Ğğİ',
  /**
   * Symbols the prototypes use as literal text: star ratings, the dropdown checkmark, the
   * package bullet, the language caret, the play triangle. In the browser they silently fall
   * back to whatever the OS supplies, which is why nobody noticed. They are icons, not text,
   * and the implementation draws them as SVG instead — decision D-26.
   */
  symbols: '★☆✓✦▾▶',
} as const;

const files = readdirSync(fontsDir).filter((name) => name.endsWith('.woff2'));

function load(file: string): fontkit.Font {
  const font = fontkit.create(readFileSync(fontsDir + file));
  if ('fonts' in font) throw new Error(`${file} is a font collection, expected a single font`);
  return font;
}

/**
 * Splits into code points, which is exactly what a cmap lookup needs.
 *
 * `Intl.Segmenter` — what the lint rule suggests — groups grapheme clusters, and a cluster is
 * the wrong unit here: `İ` composed as I + U+0307 is one grapheme but two code points, and a
 * font can perfectly well have one and not the other. Every charset below is BMP single
 * code points, so there are no emoji to decompose.
 */
function codePoints(chars: string): string[] {
  // eslint-disable-next-line @typescript-eslint/no-misused-spread -- code points are the unit
  return [...chars];
}

function missingFrom(font: fontkit.Font, chars: string): string[] {
  return codePoints(chars).filter((char) => !font.hasGlyphForCodePoint(char.codePointAt(0)!));
}

function describeMissing(file: string, missing: string[]): string {
  if (missing.length === 0) return '';
  const listed = missing
    .map((c) => `${c} (U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`)
    .join(', ');
  return `${file} is missing ${listed}`;
}

describe('the Stolzl web fonts are present', () => {
  it('ships all three weights', () => {
    expect(files.sort()).toEqual([
      'stolzl-bold.woff2',
      'stolzl-medium.woff2',
      'stolzl-regular.woff2',
    ]);
  });
});

describe.each(files)('%s', (file) => {
  const font = load(file);

  for (const [name, chars] of Object.entries(REQUIRED)) {
    it(`covers ${name}`, () => {
      const missing = missingFrom(font, chars);
      expect(missing, describeMissing(file, missing)).toEqual([]);
    });
  }

  for (const [name, chars] of Object.entries(KNOWN_GAPS)) {
    it(`still lacks the known ${name} gap`, () => {
      // Asserted as a gap on purpose. If this fails, a better font arrived: update
      // QUESTIONS.md Q-17 and drop the corresponding workaround.
      const missing = missingFrom(font, chars);
      expect(
        missing.join(''),
        `${file} now covers some of "${chars}" — the workaround may be removable`,
      ).toBe(chars);
    });
  }
});
