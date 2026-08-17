import { hreflangSet, type Lang, type Site, SITE_LANGS } from '@charva/contracts';
import { eq } from 'drizzle-orm';

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
    { path: '/gallery', frequency: 'weekly', priority: '0.6' },
    { path: '/video', frequency: 'weekly', priority: '0.6' },
    { path: '/reviews', frequency: 'weekly', priority: '0.6' },
    { path: '/contact', frequency: 'monthly', priority: '0.7' },
  ],
  umrah: [
    { path: '', frequency: 'daily', priority: '1.0' },
    { path: '/paket', frequency: 'monthly', priority: '0.9' },
    { path: '/ziyarat', frequency: 'monthly', priority: '0.8' },
    { path: '/maksatnama', frequency: 'monthly', priority: '0.8' },
    { path: '/suratlar', frequency: 'weekly', priority: '0.6' },
    { path: '/yazylmak', frequency: 'daily', priority: '0.9' },
  ],
};

export async function collectEntries(db: Database, site: Site): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = STATIC_PAGES[site].map((page) => ({
    pathAfterLang: page.path,
    lastModified: null,
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
 * The two public sites allow everything and point at their own sitemap. `/uploads` is allowed
 * deliberately: those are the photographs, and image search is worth having for a tour operator.
 */
export function renderRobots(site: Site | 'admin' | 'api', origin: string): string {
  if (site === 'admin' || site === 'api') {
    return ['User-agent: *', 'Disallow: /', ''].join('\n');
  }

  return [
    'User-agent: *',
    'Allow: /',
    '',
    // Nothing here is secret; it is simply not a page, and a search result pointing at a
    // resized WebP instead of the page that shows it helps nobody.
    'Disallow: /img/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}
