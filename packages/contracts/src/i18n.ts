import { z } from 'zod';

import { DEFAULT_LANG, type Lang, LANGS, type Site, SITE_LANGS, type SiteLang } from './constants';

/**
 * Translatable content.
 *
 * Stored as a JSON column per row rather than in `*_translations` tables — decision D-5. The
 * shape below is the reason that decision types cleanly: the language set differs per site,
 * and `LocalizedText<'umrah'>` is `{ tm: string; ru?: string }` while `LocalizedText<'global'>`
 * is `{ ru: string; en?: string; tr?: string }`. A `(entity_id, lang)` table cannot say that.
 */

/** Every language a site offers, with its default required and the rest optional. */
export type LocalizedText<S extends Site = Site> = Partial<Record<SiteLang<S>, string>> &
  Record<(typeof DEFAULT_LANG)[S], string>;

/**
 * The order to fall back through when a translation is missing.
 *
 * Partial translation is the normal state, not an error: realistically the Russian copy
 * arrives first and the rest follows over weeks (Q-3). What must never happen is a blank
 * heading, so every language resolves to *something* and the chain says to what.
 *
 * Turkish falls back to English before Russian because a Turkish-speaking visitor is far
 * likelier to read English; Turkmen falls back to Russian, which is the second language of
 * the audience it is written for.
 */
export const FALLBACK_CHAIN = {
  ru: ['ru', 'en', 'tr', 'tm'],
  en: ['en', 'ru', 'tr', 'tm'],
  tr: ['tr', 'en', 'ru', 'tm'],
  tm: ['tm', 'ru', 'en', 'tr'],
} as const satisfies Record<Lang, readonly Lang[]>;

/**
 * Resolves one language out of a translated value.
 *
 * Pure, and the only place the fallback rule exists. With `*_translations` tables this would
 * be a LEFT JOIN returning NULL and an explicit COALESCE in every query; here it is one
 * function with a test suite, which is the fourth argument in D-5.
 *
 * Empty strings count as missing. An editor who clears a field in the admin leaves `""`
 * behind, not a deleted key, and a page must not render an empty heading because of it.
 */
export function pickLocale(
  value: Partial<Record<Lang, string>> | null | undefined,
  lang: Lang,
  chain: readonly Lang[] = FALLBACK_CHAIN[lang],
): string {
  if (value == null) return '';

  for (const candidate of chain) {
    const text = value[candidate];
    if (typeof text === 'string' && text.trim() !== '') return text;
  }

  // Last resort: any language at all. A visitor seeing the wrong language is a translation
  // bug; a visitor seeing a blank line is a broken page, and the second is worse.
  for (const candidate of LANGS) {
    const text = value[candidate];
    if (typeof text === 'string' && text.trim() !== '') return text;
  }

  return '';
}

/** True when a value carries nothing readable in any language. */
export function isEmptyLocale(value: Partial<Record<Lang, string>> | null | undefined): boolean {
  return pickLocale(value, 'ru') === '';
}

/** Which languages a value actually has copy for, in the site's own order. */
export function translatedLangs<S extends Site>(
  site: S,
  value: Partial<Record<Lang, string>> | null | undefined,
): SiteLang<S>[] {
  if (value == null) return [];
  return (SITE_LANGS[site] as readonly SiteLang<S>[]).filter((lang) => {
    const text = value[lang];
    return typeof text === 'string' && text.trim() !== '';
  });
}

export interface LocalizedTextOptions {
  /** Longest allowed string, per language. */
  max?: number;
  /** Allow the default language to be empty too — for an optional field like a subtitle. */
  optional?: boolean;
}

/**
 * The Zod schema for one translatable column.
 *
 * The default language is required and the others are not, which is exactly the state the
 * project will live in for months. `.strict()` matters: it rejects a key for a language the
 * site does not offer, so a Turkish string cannot end up on an Umrah row where nothing will
 * ever render it.
 */
export function localizedText(site: Site, options: LocalizedTextOptions = {}) {
  const { max = 4000, optional = false } = options;
  const text = z.string().max(max);

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const lang of SITE_LANGS[site]) {
    shape[lang] = lang === DEFAULT_LANG[site] && !optional ? text.min(1) : text.optional();
  }

  return z.object(shape).strict();
}

/** All four languages, for the chooser page and anything shared across sites. */
export const anyLocalizedText = z
  .object(Object.fromEntries(LANGS.map((lang) => [lang, z.string().max(4000).optional()])))
  .strict();

/**
 * The four plural categories any language in this project uses.
 *
 * Russian needs three of them and the boundaries are not obvious — 1 место, 2 места, 5 мест,
 * 21 место, 25 мест — so `count === 1 ? a : b` is wrong four times out of five, and wrong in a
 * way a Russian reader notices immediately.
 */
export interface PluralForms {
  one: string;
  /**
   * `few` and `many` are optional because not every language has them.
   *
   * Russian has four categories, Turkmen and English have two. Requiring all four would force
   * a Turkmen copy file to write «{count} gün» three times to say that the distinction does not
   * exist in the language — which reads as an oversight and hides the real ones.
   *
   * The safety this gives up for Russian is bought back by a test: each app's copy suite
   * asserts that every plural block in its Russian file supplies all four, so «2 дня» cannot
   * silently become «2 дней» because somebody dropped a key.
   */
  few?: string;
  many?: string;
  other: string;
}

/** Picks the right plural form for `lang` and substitutes `{count}`. */
export function plural(forms: PluralForms, count: number, lang: Lang): string {
  const category = new Intl.PluralRules(lang).select(count);

  // `select` can answer `zero` or `two` for languages this project does not speak, so the
  // lookup is widened deliberately: `other` is the form every plural rule guarantees exists.
  // An interface has no implicit index signature, so the widening is a cast rather than an
  // assignment — and it is honest: `select` really can answer a category not in the object.
  const byCategory = forms as unknown as Record<string, string | undefined>;
  const template = byCategory[category] ?? forms.other;

  return template.replace('{count}', String(count));
}

/**
 * Fills `{name}` placeholders.
 *
 * Deliberately tiny. An unknown placeholder is left as written rather than replaced with
 * `undefined`: a visible `{license}` is a bug somebody reports, and «Лицензия undefined» is a
 * bug somebody screenshots.
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}
