import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * No Russian outside the Russian copy file.
 *
 * The handoff's Turkmen pages carry Russian in four places, and every one of them is there
 * because the page was written in Russian and translated in a hurry:
 *
 *   1. the ziyarat page's H1 reads «Куда мы пойдём» while the navigation calls the same
 *      section `Ziýarat ýerleri`
 *   2. a duplicated H2 on the same page
 *   3. a sentence in the call to action
 *   4. the signup form's label `Bellik / Комментарий`, bilingual in one string
 *
 * Question Q-3 lists them. This test is what stops a fifth appearing: interface text lives in
 * `tm.json` and `ru.json` (D-23), so Cyrillic anywhere else in `src` is either a hardcoded
 * string that should be copy or a Russian word left on a Turkmen page.
 *
 * Comments are exempt — the whole codebase is documented in English and Russian prose, and a
 * comment is not what a pilgrim reads.
 */

const SRC = join(dirname(fileURLToPath(import.meta.url)));

const CYRILLIC = /\p{Script=Cyrillic}/u;

/** `ru.json` is the point of the exercise; the test files quote what they assert. */
const EXEMPT = /(?:ru\.json|\.test\.tsx?|[\\/]test[\\/])$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx|json)$/.test(full) && !EXEMPT.test(full) ? [full] : [];
  });
}

/**
 * Drops `//` and `/* *\/` comments and JSX comment blocks.
 *
 * Crude on purpose: it does not need to understand the language, only to stop the file's own
 * Russian documentation from failing a check about what is rendered.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('Turkmen pages', () => {
  it('contain no Russian outside ru.json', () => {
    const offenders = sourceFiles(SRC)
      .map((file) => ({ file, code: stripComments(readFileSync(file, 'utf8')) }))
      .filter(({ code }) => CYRILLIC.test(code))
      .map(({ file, code }) => {
        const line =
          code
            .split('\n')
            .find((text) => CYRILLIC.test(text))
            ?.trim() ?? '';
        return `${relative(SRC, file)}: ${line}`;
      });

    expect(offenders).toEqual([]);
  });
});
