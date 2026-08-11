import { describe, expect, it } from 'vitest';

import { DEFAULT_LANG, isSiteLang, LANG_NAMES, LANGS, SITE_LANGS, SITES } from './constants';

describe('site and language constants', () => {
  it('offers every site at least one language, with the default listed first', () => {
    for (const site of SITES) {
      const langs = SITE_LANGS[site];
      expect(langs.length).toBeGreaterThan(0);
      expect(langs[0]).toBe(DEFAULT_LANG[site]);
    }
  });

  it('only offers languages that exist', () => {
    for (const site of SITES) {
      for (const lang of SITE_LANGS[site]) {
        expect(LANGS).toContain(lang);
      }
    }
  });

  it('names every language, because the switcher prints the full name', () => {
    for (const lang of LANGS) {
      expect(LANG_NAMES[lang]).toBeTruthy();
    }
  });

  it('does not offer Turkish on Umrah or Turkmen on Global', () => {
    // The handoff is explicit about this and it is easy to widen by accident.
    expect(SITE_LANGS.umrah).not.toContain('tr');
    expect(SITE_LANGS.global).not.toContain('tm');
  });

  it('rejects a language the site does not offer', () => {
    expect(isSiteLang('umrah', 'tm')).toBe(true);
    expect(isSiteLang('umrah', 'tr')).toBe(false);
    expect(isSiteLang('global', 'en')).toBe(true);
    expect(isSiteLang('global', 'xx')).toBe(false);
  });
});
