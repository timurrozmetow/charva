import { LANGS, SITE_LANGS } from '@charva/contracts';
import { describe, expect, it } from 'vitest';

import tr from './tr.json';

import { type Copy, COPY, fill, plural } from './index';

/** What ships, plus the one that does not. Turkish is checked here and served nowhere. */
const ALL: Record<string, Copy> = { ...COPY, tr: tr satisfies Copy };

/**
 * The copy files, checked for the things a type cannot check.
 *
 * `satisfies Copy` already guarantees every file has every key. What it cannot guarantee is that
 * a key holds an actual translation rather than the Russian original copied across, or that the
 * placeholders survived — and a `{count}` that lost its braces renders as literal text in front
 * of a visitor.
 */

const KEYS_WITH_PLACEHOLDERS: [string, string][] = [
  ['badge.open.one', '{count}'],
  ['badge.open.few', '{count}'],
  ['badge.open.many', '{count}'],
  ['badge.open.other', '{count}'],
  ['footer.license', '{license}'],
];

function at(source: unknown, path: string): string {
  return path.split('.').reduce<unknown>((value, key) => {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)[key]
      : undefined;
  }, source) as string;
}

describe('every language has every string', () => {
  it('ships the three languages the chooser serves, and checks the fourth anyway', () => {
    /*
     * Three statements, and they came apart when Turkish was retired (Q-17).
     *
     * What the bundle carries is the first line: a language nothing can request has no business
     * travelling to every visitor, and it used to, here and on Global — where it was fifteen
     * kilobytes of a 372 KB entry chunk rather than one and a half.
     *
     * What still has to stay correct is the second: the file is real work and one entry in
     * `SITE_LANGS` serves it again, so every check below runs over `ALL` rather than `COPY`.
     * That is a stronger guard than the runtime table gave it, not a weaker one.
     */
    expect(Object.keys(COPY).sort()).toEqual([...SITE_LANGS.choice].sort());
    expect(Object.keys(COPY)).not.toContain('tr');
    expect(Object.keys(ALL).sort()).toEqual([...LANGS].sort());
  });

  it('keeps the placeholders a template needs', () => {
    for (const lang of Object.keys(ALL)) {
      for (const [path, placeholder] of KEYS_WITH_PLACEHOLDERS) {
        expect(at(ALL[lang]!, path), `${lang}.${path}`).toContain(placeholder);
      }
    }
  });

  it('gives each half five chips and three stat labels', () => {
    // The design draws five and three; a language file with four would silently shorten a row.
    for (const lang of Object.keys(ALL)) {
      expect(ALL[lang]!.global.chips, lang).toHaveLength(5);
      expect(ALL[lang]!.umrah.chips, lang).toHaveLength(5);
      expect(Object.keys(ALL[lang]!.global.stats), lang).toHaveLength(3);
      expect(Object.keys(ALL[lang]!.umrah.stats), lang).toHaveLength(3);
    }
  });

  it('leaves nothing empty', () => {
    const empties: string[] = [];
    // `ALL`, not `COPY`: an empty string in the retired file is the shape a half-finished
    // translation pass leaves behind, and it would sit there unnoticed until the day it ships.
    walk(ALL, [], (path, value) => {
      if (value.trim() === '') empties.push(path);
    });
    expect(empties).toEqual([]);
  });

  it('does not leave the Umrah heading in Russian on the Turkmen page', () => {
    // Defect 12 in PLAN §0.5: the prototypes put Russian sentences on Turkmen pages. Here the
    // Turkmen file is Turkmen throughout, and the Russian file is Russian throughout — the
    // bilingual lead the prototype ships is what i18n exists to stop being necessary.
    expect(COPY.tm.umrah.lead).not.toMatch(/[Ѐ-ӿ]/);
    expect(COPY.tm.umrah.title).not.toMatch(/[Ѐ-ӿ]/);
    expect(COPY.tm.global.lead).not.toMatch(/[Ѐ-ӿ]/);
    expect(COPY.en.umrah.lead).not.toMatch(/[Ѐ-ӿ]/);
  });
});

describe('plural', () => {
  it('picks the three Russian forms by their real boundaries', () => {
    // 1 место, 2 места, 5 мест, 21 место, 25 мест. A `count === 1 ? a : b` gets four of these
    // wrong, and every one of them is obvious to a Russian reader.
    const forms = COPY.ru.badge.open;
    expect(plural(forms, 1, 'ru')).toContain('1 место');
    expect(plural(forms, 2, 'ru')).toContain('2 места');
    expect(plural(forms, 5, 'ru')).toContain('5 мест');
    expect(plural(forms, 21, 'ru')).toContain('21 место');
    expect(plural(forms, 25, 'ru')).toContain('25 мест');
  });

  it('substitutes the count in every language', () => {
    for (const lang of LANGS) {
      expect(plural(ALL[lang]!.badge.open, 12, lang)).toContain('12');
      expect(plural(ALL[lang]!.badge.open, 12, lang)).not.toContain('{count}');
    }
  });
});

describe('fill', () => {
  it('replaces a named placeholder', () => {
    expect(fill('Лицензия {license}', { license: 'TM-1428' })).toBe('Лицензия TM-1428');
  });

  it('leaves an unknown placeholder alone rather than printing «undefined»', () => {
    expect(fill('a {missing} b', {})).toBe('a {missing} b');
  });
});

function walk(node: unknown, path: string[], visit: (path: string, value: string) => void): void {
  if (typeof node === 'string') {
    visit(path.join('.'), node);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => {
      walk(item, [...path, String(index)], visit);
    });
    return;
  }
  if (typeof node === 'object' && node !== null) {
    for (const [key, value] of Object.entries(node)) walk(value, [...path, key], visit);
  }
}
