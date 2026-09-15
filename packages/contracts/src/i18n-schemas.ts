/**
 * The two Zod builders that used to live in `i18n.ts`, and why they had to leave it.
 *
 * `fill` and `plural` beside them are imported by every page of every site to render a count
 * or substitute a name — the most ordinary thing a template does. A module holding a
 * top-level `z.object()` cannot be dropped from a bundle by tree-shaking, so those two tiny
 * pure functions were dragging the whole Zod runtime into the first download, about twenty
 * five kilobytes gzipped, on a connection this project measures in hundreds of kilobits.
 *
 * Both are re-exported from `i18n.ts`, so nothing that imports them had to change. The API
 * pays for Zod regardless — it is a validator there, on a server, and that is what it is for.
 */

import { z } from 'zod';

import { DEFAULT_LANG, LANGS, type Site, SITE_LANGS } from './constants';
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
