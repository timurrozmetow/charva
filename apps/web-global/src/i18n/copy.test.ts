import { SITE_LANGS } from '@charva/contracts';
import { describe, expect, it } from 'vitest';

import tr from './tr.json';

import { type Copy, COPY, copyFor } from './index';

/**
 * The copy files, checked for the things the type system cannot say — and the retired one, which
 * until now nothing checked at all.
 *
 * `satisfies Copy` guarantees that a language has every key Russian has. It says nothing about
 * whether a template kept its `{count}`, whether a string was left empty, or whether Russian —
 * which has four plural categories — actually filled all four. `PluralForms` makes `few` and
 * `many` optional so that a two-category language need not write one string three times (D-71),
 * and this is where that safety is bought back.
 *
 * **Turkish is the reason this file exists.** It is not served — `SITE_LANGS.global` dropped it
 * over the missing `Ğ ğ İ` in Stolzl (Q-17) — and it used to be kept correct by sitting in the
 * runtime table with a `satisfies` on it, which meant fifteen kilobytes of unreachable language
 * in every visitor's entry bundle in exchange for the weakest check available. It is imported
 * here instead: the bundle never sees this file, and the language is now held to more than it was.
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

/** The same lookup `fill` would do, for comparing one language against the reference. */
function at(source: Json, path: string): Json | undefined {
  return path
    .split('.')
    .filter(Boolean)
    .reduce<Json | undefined>(
      (node, key) =>
        node !== null && typeof node === 'object' && !Array.isArray(node) ? node[key] : undefined,
      source,
    );
}

/** What ships, plus the one that does not. Turkish is checked, never served. */
const ALL: Record<string, Copy> = { ru: COPY.ru, en: COPY.en, tr: tr satisfies Copy };

describe('the copy files', () => {
  it('ships the languages the site serves, and not the retired one', () => {
    /*
     * Two statements that stopped being one when Turkish was retired. The first is what the
     * bundle carries; the second is what the switcher offers. A regression here is somebody
     * re-adding `tr` to the table for tidiness and putting fifteen kilobytes back on every page.
     */
    expect(Object.keys(COPY).sort()).toEqual([...SITE_LANGS.global].sort());
    expect(Object.keys(COPY)).not.toContain('tr');
  });

  it('falls back to Russian, not to English', () => {
    // The opposite of Umrah. A language this site does not speak arriving from anywhere is a
    // routing bug, and Russian is what the audience reads.
    expect(copyFor('tm')).toBe(COPY.ru);
    expect(copyFor('tr')).toBe(COPY.ru);
    expect(copyFor('ru')).toBe(COPY.ru);
    expect(copyFor('en')).toBe(COPY.en);
  });

  it('fills all four plural forms in Russian', () => {
    const missing: string[] = [];

    walk(COPY.ru, 'ru', (path, value) => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return;
      if (!('other' in value) || !('one' in value)) return;

      // «2 дня» and «5 дней» are different words. A Russian plural block with only `one` and
      // `other` renders «2 дней», which is wrong and reads like a typo rather than a gap.
      for (const form of ['few', 'many'] as const) {
        if (!(form in value)) missing.push(`${path}.${form}`);
      }
    });

    expect(missing).toEqual([]);
  });

  it('keeps the same placeholders in every language, retired included', () => {
    const wrong: string[] = [];

    for (const [lang, copy] of Object.entries(ALL)) {
      if (lang === 'ru') continue;

      walk(copy, '', (path, value) => {
        if (typeof value !== 'string') return;
        const russian = at(COPY.ru, path);
        if (typeof russian !== 'string') return;
        // A translated «Осталось {left} мест» that lost its `{left}` prints a literal brace at
        // somebody, or worse prints nothing where a number should be.
        if (placeholders(value).join() !== placeholders(russian).join())
          wrong.push(`${lang}.${path}`);
      });
    }

    expect(wrong).toEqual([]);
  });

  it('has no empty string anywhere', () => {
    const empty: string[] = [];

    for (const [lang, copy] of Object.entries(ALL)) {
      walk(copy, '', (path, value) => {
        // An empty translation renders as a gap that looks like a layout bug, and it is the
        // shape a half-finished translation pass leaves behind.
        if (typeof value === 'string' && value.trim() === '') empty.push(`${lang}${path}`);
      });
    }

    expect(empty).toEqual([]);
  });
});
