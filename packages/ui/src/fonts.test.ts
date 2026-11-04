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
 * It has already earned its keep twice. Stolzl as delivered covered Turkmen and Cyrillic
 * completely but was missing three Turkish letters and every symbol the design uses as
 * content; neither gap was mentioned in the handoff, and the first is what retired Turkish
 * (Q-17). Golos Text, which replaced it in the rebrand (D-183), closes the Turkish gap and not
 * the symbol one — so Turkish moved up into REQUIRED below and the symbols stayed put.
 */

const fontsDir = fileURLToPath(new URL('../assets/fonts/', import.meta.url));

/** Coverage the fonts must have. A failure here blocks the phase. */
const REQUIRED = {
  latin: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  punctuation: '.,;:!?\'"()[]{}«»—–-…/\\&@#%*+=<>№',
  cyrillic: 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя',
  /** Turkmen Latin. `ň` and `ý` appear in almost every heading on the Umrah site. */
  turkmen: 'ÄŇÖŞÜÝŽäňöşüýž',
  /**
   * Turkish, in full.
   *
   * This was split in two while Stolzl was the face: the letters it had were required and
   * `Ğ ğ İ` were asserted as a gap. They are not rare — Ağustos, doğa, değil, İpek Yolu — and
   * the browser substituted some other face for exactly those glyphs, so every second Turkish
   * word was set in two typefaces at once. Golos Text has all of them, which is why the two
   * halves are one entry again, and why Q-17 is no longer a question about the font.
   */
  turkish: 'ÇĞIİÖŞÜçğıiöşü',
  /**
   * The two symbols that are typed as text rather than drawn as icons.
   *
   * Every call to action on all three sites ends in a `→`, and the middle dot separates meta
   * items — «Май 2026 · 4 мин». They are here rather than in `KNOWN_GAPS` below because Stolzl
   * genuinely has both, which is the whole reason D-26 does not apply to them: the star, the
   * checkmark and the caret are absent and fall back to the operating system's font, so they
   * became SVG. These do not, so they stay text — and this line is what keeps that true. A
   * fuller cut of Stolzl that happened to drop them would otherwise change the arrow on every
   * button on the site to whatever the reader's system supplies, with nothing failing.
   */
  symbolsInFont: '→·',
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

describe('the Golos Text web font is present', () => {
  it('ships one variable file and nothing else', () => {
    // Three static cuts became one variable file (D-183). A second file appearing here means
    // somebody added a static weight beside it, and the page would then download both.
    expect(files.sort()).toEqual(['golos-text-variable.woff2']);
  });

  it('carries a weight axis spanning 400 to 700', () => {
    /*
     * The file has to stay variable, and over the whole declared range.
     *
     * `@font-face` claims `font-weight: 400 700`. Rebuild the subset pinned to one weight — a
     * single wrong argument to the subsetter — and the file still loads, still covers every
     * glyph, and every bold heading on all three sites silently renders at regular. Nothing
     * else in the suite would notice, because coverage is unaffected.
     */
    const axis = load('golos-text-variable.woff2').variationAxes['wght'];
    expect(axis, 'the file is no longer variable').toBeDefined();
    expect(axis!.min).toBeLessThanOrEqual(400);
    expect(axis!.max).toBeGreaterThanOrEqual(700);
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
