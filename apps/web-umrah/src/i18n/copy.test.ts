import { describe, expect, it } from 'vitest';

import { COPY, copyFor } from './index';

/**
 * The copy files, checked for the things the type system cannot say.
 *
 * `satisfies Copy` already guarantees that Russian has every key Turkmen has. What it cannot
 * express is that Russian, which has four plural categories, actually fills all four — the
 * contract's `PluralForms` makes `few` and `many` optional so a two-category language does not
 * have to write the same string three times, and this is the test that buys that safety back.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Every `{name}` in a template, so a placeholder cannot be lost in translation. */
function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort();
}

function walk(value: Json, path: string, visit: (path: string, value: Json) => void): void {
  visit(path, value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walk(item, `${path}[${String(index)}]`, visit);
    });
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`, visit);
  }
}

describe('the copy files', () => {
  it('falls back to Turkmen, not to Russian', () => {
    // The opposite of Global. A language this site does not speak arriving from anywhere is a
    // routing bug, and the audience reads Turkmen.
    expect(copyFor('en')).toBe(COPY.tm);
    expect(copyFor('tm')).toBe(COPY.tm);
    expect(copyFor('ru')).toBe(COPY.ru);
  });

  it('fills all four plural forms in Russian', () => {
    const missing: string[] = [];

    walk(COPY.ru, 'ru', (path, value) => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return;
      if (!('other' in value) || !('one' in value)) return;

      // «2 дня» and «5 дней» are different words. A Russian plural block that only has `one`
      // and `other` renders «2 дней», which is wrong and looks like a typo rather than a gap.
      for (const form of ['few', 'many'] as const) {
        if (!(form in value)) missing.push(`${path}.${form}`);
      }
    });

    expect(missing).toEqual([]);
  });

  it('keeps the same placeholders in both languages', () => {
    const wrong: string[] = [];

    walk(COPY.tm, '', (path, value) => {
      if (typeof value !== 'string') return;

      const russian = path
        .split('.')
        .filter(Boolean)
        .reduce<Json | undefined>(
          (node, key) =>
            node !== null && typeof node === 'object' && !Array.isArray(node)
              ? node[key]
              : undefined,
          COPY.ru,
        );

      if (typeof russian !== 'string') return;
      // A translated «Boş ýer: {left}» that lost its `{left}` prints the literal brace at
      // somebody, or worse, prints nothing where a number should be.
      if (placeholders(value).join() !== placeholders(russian).join()) wrong.push(path);
    });

    expect(wrong).toEqual([]);
  });
});
