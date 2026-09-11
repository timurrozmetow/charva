import { SITE_LANGS } from '@charva/contracts';
import { describe, expect, it } from 'vitest';

import { bestLang, isChoiceLang } from './best-lang';

/**
 * Which language a visitor lands in.
 *
 * This runs once, on `/`, and it is the only place a browser header decides anything. Getting
 * it wrong sends a Turkmen speaker to a Russian page — which still works, but the chooser is the
 * first screen of the project and it is the one that should know better.
 */

describe('bestLang', () => {
  it('takes the first offered language in the visitor’s order', () => {
    expect(bestLang(['tm-TM', 'en-GB'])).toBe('tm');
    expect(bestLang(['en-US'])).toBe('en');
  });

  it('sends a Turkish browser on, now that Turkish is retired', () => {
    // Stolzl has no `Ğ ğ İ` (Q-17), so the language came off the chooser with Global's. A
    // Turkish speaker is no longer stopped at it — the next preference decides, and Russian is
    // the default when there is none.
    expect(bestLang(['tr-TR', 'en-GB'])).toBe('en');
    expect(bestLang(['tr'])).toBe('ru');
  });

  it('maps the browser’s `tk` for Turkmen onto this project’s `tm`', () => {
    // `tk` is the BCP-47 language; `tm` is the country. The design, the routes, the enum in
    // MySQL and every seeded row use `tm`, so the browser's correct tag is translated at the
    // boundary rather than the project's wrong one being spread further.
    expect(bestLang(['tk-TM'])).toBe('tm');
    expect(bestLang(['tk'])).toBe('tm');
  });

  it('skips languages this site does not offer', () => {
    // German was never offered and Turkish no longer is; either way the next preference wins.
    expect(bestLang(['de-DE', 'ru-RU'])).toBe('ru');
  });

  it('falls back to Russian when nothing matches', () => {
    expect(bestLang(['ja', 'ko'])).toBe('ru');
    expect(bestLang([])).toBe('ru');
  });

  it('ignores case and region', () => {
    expect(bestLang(['RU-ru'])).toBe('ru');
  });
});

describe('isChoiceLang', () => {
  it('accepts what the chooser offers and nothing else', () => {
    for (const lang of SITE_LANGS.choice) expect(isChoiceLang(lang)).toBe(true);

    // `tr` sits with the never-offered ones deliberately: it is the whole of the retirement as
    // far as routing is concerned, and `/tr` now redirects the way `/de` always has.
    for (const lang of ['de', 'tr', 'tk', '', 'RU']) expect(isChoiceLang(lang)).toBe(false);
  });
});
