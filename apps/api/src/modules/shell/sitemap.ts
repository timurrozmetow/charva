import { hreflangSet, type Lang, type Site, SITE_LANGS } from '@charva/contracts';
import { and, eq, isNotNull, max } from 'drizzle-orm';
import { type MySqlColumn } from 'drizzle-orm/mysql-core';

import { type Database } from '../../db/client';
import * as t from '../../db/schema';

import { escapeHtml } from './html';

/**
 * The sitemap, one per site.
 *
 * Every URL is listed once per language with the full `xhtml:link` alternate set on it, which
 * is the form Google asks for and the only one that actually associates the three translations
 * with each other. Listing the Russian page and hoping a crawler finds the English one by
 * following a link is how a site ends up indexed in one language.
 *
 * Only published rows, because an unpublished tour is not a page — and a sitemap that lists
 * URLs answering 404 is a sitemap a crawler stops trusting.
 */

export interface SitemapEntry {
  /** Path after the language prefix — `''` for the home page. */
  pathAfterLang: string;
  lastModified: Date | null;
  /** Roughly how often this page changes, for what little the hint is worth. */
  changeFrequency: 'daily' | 'weekly' | 'monthly';
  priority: string;
}

/** The static pages of each site, in the order a reader would meet them. */
const STATIC_PAGES: Record<
  Site,
  { path: string; frequency: SitemapEntry['changeFrequency']; priority: string }[]
> = {
  choice: [{ path: '', frequency: 'monthly', priority: '1.0' }],
  global: [
    { path: '', frequency: 'weekly', priority: '1.0' },
    { path: '/tours', frequency: 'weekly', priority: '0.9' },
    { path: '/builder', frequency: 'monthly', priority: '0.8' },
    { path: '/hotels', frequency: 'weekly', priority: '0.8' },
    { path: '/turkmenistan', frequency: 'monthly', priority: '0.7' },
    { path: '/articles', frequency: 'weekly', priority: '0.7' },
    { path: '/gallery', frequency: 'weekly', priority: '0.6' },
    { path: '/video', frequency: 'weekly', priority: '0.6' },
    { path: '/reviews', frequency: 'weekly', priority: '0.6' },
    { path: '/contact', frequency: 'monthly', priority: '0.7' },
    // Low priority and rightly so: it exists because a licence requires it, not because anybody
    // is looking for it.
    { path: '/credits', frequency: 'monthly', priority: '0.2' },
  ],
  umrah: [
    { path: '', frequency: 'daily', priority: '1.0' },
    { path: '/paket', frequency: 'monthly', priority: '0.9' },
    { path: '/ziyarat', frequency: 'monthly', priority: '0.8' },
    { path: '/maksatnama', frequency: 'monthly', priority: '0.8' },
    { path: '/suratlar', frequency: 'weekly', priority: '0.6' },
    { path: '/yazylmak', frequency: 'daily', priority: '0.9' },
    { path: '/credits', frequency: 'monthly', priority: '0.2' },
  ],
};

/**
 * When the rows behind a section last changed.
 *
 * A static page had no `<lastmod>` at all, on the reasonable-sounding grounds that its markup is
 * fixed. But `/hotels` is not fixed — it is sixteen rows, and it changed the day those rows
 * arrived. Google uses `lastmod` to decide what to re-crawl and ignores the field entirely on
 * sites where it cannot be trusted, so the choice is between a date that follows the content
 * and no date at all; there is no version of this where an invented date is the better option.
 */
async function sectionModified(
  db: Database,
  site: Site,
): Promise<{ paths: Record<string, Date>; newest: Date | null }> {
  const paths: Record<string, Date> = {};
  const seen: Date[] = [];
  const record = (path: string | null, at: Date | null | undefined): void => {
    if (at === null || at === undefined) return;
    if (path !== null) paths[path] = at;
    seen.push(at);
  };

  if (site === 'global') {
    const [tours, hotels, articles, places, gallery, videos, reviews] = await Promise.all([
      db
        .select({ at: max(t.tours.updatedAt) })
        .from(t.tours)
        .where(published(t.tours.isPublished)),
      db
        .select({ at: max(t.hotels.updatedAt) })
        .from(t.hotels)
        .where(published(t.hotels.isPublished)),
      db
        .select({ at: max(t.articles.updatedAt) })
        .from(t.articles)
        .where(published(t.articles.isPublished)),
      db
        .select({ at: max(t.placesToSee.updatedAt) })
        .from(t.placesToSee)
        .where(published(t.placesToSee.isPublished)),
      db
        .select({ at: max(t.galleryItems.updatedAt) })
        .from(t.galleryItems)
        .where(published(t.galleryItems.isPublished)),
      db
        .select({ at: max(t.videos.updatedAt) })
        .from(t.videos)
        .where(published(t.videos.isPublished)),
      // A review is shown by `status`, not by the `is_published` its table also carries through
      // the shared publishable columns — moderation has three states and a boolean has two. Two
      // flags on one row is one too many, and this is the half nothing else reads: the first
      // version of this file asked the boolean, so hiding every review left `/reviews` in the
      // sitemap and the page empty.
      db
        .select({ at: max(t.reviews.updatedAt) })
        .from(t.reviews)
        .where(eq(t.reviews.status, 'published')),
    ]);

    record('/tours', tours[0]?.at);
    record('/hotels', hotels[0]?.at);
    record('/turkmenistan', places[0]?.at);
    record('/gallery', gallery[0]?.at);
    record('/video', videos[0]?.at);
    record('/reviews', reviews[0]?.at);
    record('/articles', articles[0]?.at);
  }

  if (site === 'umrah') {
    const [places, groups, trips] = await Promise.all([
      db
        .select({ at: max(t.ziyaratPlaces.updatedAt) })
        .from(t.ziyaratPlaces)
        .where(published(t.ziyaratPlaces.isPublished)),
      db
        .select({ at: max(t.umrahGroups.updatedAt) })
        .from(t.umrahGroups)
        .where(published(t.umrahGroups.isPublished)),
      // No publication flag on a departure, and none wanted: announcing the next one is the
      // single most consequential edit on this site, and it must move the homepage's date.
      db.select({ at: max(t.umrahTrips.updatedAt) }).from(t.umrahTrips),
    ]);

    record('/ziyarat', places[0]?.at);
    record('/suratlar', groups[0]?.at);
    record(null, trips[0]?.at);
  }

  const newest = seen.reduce<Date | null>(
    (latest, at) => (latest === null || at > latest ? at : latest),
    null,
  );

  return { paths, newest };
}

/** Spelled out once: every one of these tables carries the same flag under the same name. */
function published(column: MySqlColumn) {
  return eq(column, true);
}

/**
 * Section pages that exist in the router but have nothing to show yet.
 *
 * `/video` is the standing example: six rows, none of them with a file — the films have not
 * been shot — so the page renders an empty grid. A crawler handed that URL finds no content
 * where a sitemap promised some, which is what Google calls a soft 404 and what it counts
 * against the whole site, not just the page. The page stays in the navigation, because a
 * visitor who clicks it should learn that the section exists; it is simply not advertised
 * until there is something behind it. It reappears the day a video is uploaded, by itself.
 */
const SECTION_SOURCES: Record<string, (db: Database) => Promise<boolean>> = {
  '/gallery': async (db) =>
    hasRows(
      db
        .select({ n: t.galleryItems.id })
        .from(t.galleryItems)
        .where(eq(t.galleryItems.isPublished, true))
        .limit(1),
    ),
  '/video': async (db) =>
    hasRows(
      db
        .select({ n: t.videos.id })
        .from(t.videos)
        .where(and(eq(t.videos.isPublished, true), isNotNull(t.videos.mediaId)))
        .limit(1),
    ),
  '/articles': async (db) =>
    hasRows(
      db
        .select({ n: t.articles.id })
        .from(t.articles)
        .where(eq(t.articles.isPublished, true))
        .limit(1),
    ),
  '/reviews': async (db) =>
    hasRows(
      db
        .select({ n: t.reviews.id })
        .from(t.reviews)
        .where(eq(t.reviews.status, 'published'))
        .limit(1),
    ),
  '/suratlar': async (db) =>
    hasRows(
      db
        .select({ n: t.umrahGroups.id })
        .from(t.umrahGroups)
        .where(eq(t.umrahGroups.isPublished, true))
        .limit(1),
    ),
};

async function hasRows(query: Promise<unknown[]>): Promise<boolean> {
  return (await query).length > 0;
}

/**
 * The paths this site is prepared to offer, in the order it offers them.
 *
 * One list, two readers. The sitemap tells a crawler which addresses exist; the no-script
 * fallback in `fallback.ts` turns the same list into the links that a crawler which does not
 * render JavaScript would otherwise never find. Keeping them separate would mean the day
 * `/video` fills up, one of the two would start advertising it and the other would not — and
 * the emptiness rule (D-144) would be half-applied, which is worse than not applied at all.
 */
export async function listedPaths(db: Database, site: Site): Promise<string[]> {
  const pages: string[] = [];
  for (const page of STATIC_PAGES[site]) {
    const source = SECTION_SOURCES[page.path];
    if (source !== undefined && !(await source(db))) continue;
    pages.push(page.path);
  }
  return pages;
}

export async function collectEntries(db: Database, site: Site): Promise<SitemapEntry[]> {
  const modified = await sectionModified(db, site);

  const listed = new Set(await listedPaths(db, site));
  const pages = STATIC_PAGES[site].filter((page) => listed.has(page.path));

  const entries: SitemapEntry[] = pages.map((page) => ({
    pathAfterLang: page.path,
    // The section's own rows when it has any, the site's newest for a page like `/contact`
    // whose content genuinely is the markup — it still changes when the site is redeployed,
    // and the newest row is the closest honest answer available here.
    lastModified: modified.paths[page.path] ?? modified.newest,
    changeFrequency: page.frequency,
    priority: page.priority,
  }));

  if (site === 'global') {
    const [tours, hotels, articles] = await Promise.all([
      db
        .select({ slug: t.tours.slug, updatedAt: t.tours.updatedAt })
        .from(t.tours)
        .where(eq(t.tours.isPublished, true)),
      db
        .select({ slug: t.hotels.slug, updatedAt: t.hotels.updatedAt })
        .from(t.hotels)
        .where(eq(t.hotels.isPublished, true)),
      db
        .select({ slug: t.articles.slug, updatedAt: t.articles.updatedAt })
        .from(t.articles)
        .where(eq(t.articles.isPublished, true)),
    ]);

    for (const row of tours) {
      entries.push(detail(`/tours/${row.slug}`, row.updatedAt, '0.8'));
    }
    for (const row of hotels) {
      entries.push(detail(`/hotels/${row.slug}`, row.updatedAt, '0.7'));
    }
    for (const row of articles) {
      entries.push(detail(`/articles/${row.slug}`, row.updatedAt, '0.6'));
    }
  }

  if (site === 'umrah') {
    const places = await db
      .select({ slug: t.ziyaratPlaces.slug, updatedAt: t.ziyaratPlaces.updatedAt })
      .from(t.ziyaratPlaces)
      .where(eq(t.ziyaratPlaces.isPublished, true));

    for (const row of places) {
      entries.push(detail(`/ziyarat/${row.slug}`, row.updatedAt, '0.6'));
    }
  }

  return entries;
}

function detail(path: string, updatedAt: Date, priority: string): SitemapEntry {
  return { pathAfterLang: path, lastModified: updatedAt, changeFrequency: 'monthly', priority };
}

export function renderSitemap(site: Site, origin: string, entries: SitemapEntry[]): string {
  const langs: readonly Lang[] = SITE_LANGS[site];
  const alternates = hreflangSet(site);

  const urls = entries.flatMap((entry) =>
    langs.map((lang) => {
      const location = `${origin}/${lang}${entry.pathAfterLang}`;

      /*
       * The alternates go on every language's entry, pointing at all of them including itself.
       *
       * That self-reference looks redundant and is required: a set where page A names B but B
       * does not name A back is treated as unconfirmed and ignored.
       */
      const links = alternates
        .map(
          (alternate) =>
            `    <xhtml:link rel="alternate" hreflang="${alternate.hreflang}" ` +
            `href="${escapeHtml(`${origin}/${alternate.lang}${entry.pathAfterLang}`)}"/>`,
        )
        .join('\n');

      return [
        '  <url>',
        `    <loc>${escapeHtml(location)}</loc>`,
        links,
        entry.lastModified === null
          ? null
          : `    <lastmod>${entry.lastModified.toISOString().slice(0, 10)}</lastmod>`,
        `    <changefreq>${entry.changeFrequency}</changefreq>`,
        `    <priority>${entry.priority}</priority>`,
        '  </url>',
      ]
        .filter((line) => line !== null)
        .join('\n');
    }),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
      'xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/**
 * `robots.txt`, per host.
 *
 * The admin and the API are disallowed wholesale — not because a crawler could get past the
 * login, but because indexing a login form serves nobody and an indexed `/api/v1/...` response
 * is a JSON document in somebody's search results.
 *
 * The two public sites allow everything, photographs included, and point at their own sitemap.
 *
 * `/img/` used to be disallowed, with the reasoning that «a search result pointing at a resized
 * WebP instead of the page that shows it helps nobody». The reasoning was wrong about how image
 * search works: a result in Google Images links to the page the picture is on, which is the
 * page we want found. And since every `<img>` on both sites is served from `/img/…?w=`, the
 * rule did not stop that result appearing — it stopped every photograph on a site made entirely
 * of photographs from being indexed at all. Seven widths per file is a few hundred extra URLs,
 * which is not a crawl budget worth protecting at this size.
 */
export function renderRobots(site: Site | 'admin' | 'api', origin: string): string {
  if (site === 'admin' || site === 'api') {
    return ['User-agent: *', 'Disallow: /', ''].join('\n');
  }

  return ['User-agent: *', 'Allow: /', '', `Sitemap: ${origin}/sitemap.xml`, ''].join('\n');
}
