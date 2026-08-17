import { type Lang, type Site } from '@charva/contracts';
import { and, eq } from 'drizzle-orm';

import { type Database } from '../../db/client';
import * as t from '../../db/schema';
import { mediaUrl, text } from '../../lib/serialize';
import { deriveTripState } from '../../lib/trip-status';
import { getSettings, reviewSummary } from '../global/service';

import { buildHead, type ShellContext } from './head';
import { type HeadTag } from './html';
import * as ld from './jsonld';
import { resolveRoute, unmatchedRoute } from './routes-map';

/**
 * The head of one page, assembled from the database.
 *
 * This is the server half of decision D-4. A crawler, a Telegram card and a WhatsApp preview
 * read HTML and run no JavaScript, so everything they are told has to be in the response — and
 * for this audience the preview is not a nicety: links are shared in Telegram, and a link that
 * unfurls as a bare URL looks like something nobody should tap.
 *
 * What it deliberately is not is server-side rendering. The body stays the SPA's; only the head
 * is built here. Sixteen mostly-static routes do not repay a second rendering path, and the one
 * thing that genuinely cannot be done in the browser is exactly the thing done here.
 */

export interface ShellRequest {
  db: Database;
  site: Site;
  path: string;
  origin: string;
  /** Where `/uploads` lives, for absolute image URLs in `og:image`. */
  mediaBaseUrl: string;
  now?: Date;
}

export interface ShellResult {
  tags: HeadTag[];
  lang: Lang;
  /** False when the path matched nothing — the response should carry a 404 status. */
  found: boolean;
}

export async function renderShellHead(request: ShellRequest): Promise<ShellResult> {
  const { db, site, origin } = request;
  const resolved = resolveRoute(site, request.path);
  const lang = resolved.lang;
  const url = `${origin}/${lang}${resolved.pathAfterLang}`;

  const settingsSite = site === 'choice' ? 'global' : site;
  const settings = await getSettings(db, settingsSite, lang, [lang], lang);

  const jsonLd: unknown[] = [
    ld.organization({
      site,
      url: origin,
      phone: settings.contacts.phone,
      email: settings.contacts.email,
      address: settings.contacts.address,
      socials: Object.values(settings.socials).filter((value) => value !== ''),
      logoUrl: null,
    }),
  ];

  const content = await loadContent(request, resolved.route, resolved.slug, lang, url, jsonLd);

  /*
   * A detail path whose slug names no row is a 404, and its head has to say so.
   *
   * The pattern matched and the section exists, so without this the response is a 404 titled
   * «Ready-made tours of Turkmenistan» — a page that does not exist, described as one that
   * does. The SPA renders its 404 component in the same situation (D-69).
   */
  const missing = resolved.slug !== null && content === null;
  const route = missing ? unmatchedRoute(site) : resolved.route;

  const context: ShellContext = {
    site,
    lang,
    route,
    origin,
    pathAfterLang: resolved.pathAfterLang,
    jsonLd,
    ...(content === null ? {} : { content }),
  };

  await addRouteJsonLd(request, route, lang, origin, jsonLd);

  return {
    tags: buildHead(context),
    lang,
    found: !missing && resolved.route !== unmatchedRoute(site),
  };
}

interface ShellContent {
  name: string;
  summary: string | null;
  imageUrl: string | null;
}

/**
 * The row a detail path names, if it exists.
 *
 * Four tables, one shape. Everything the head needs is a name, a sentence and a picture, and
 * asking each table for exactly that keeps this out of the business of knowing what a tour is.
 */
async function loadContent(
  request: ShellRequest,
  route: string,
  slug: string | null,
  lang: Lang,
  url: string,
  jsonLd: unknown[],
): Promise<ShellContent | null> {
  if (slug === null) return null;
  const { db } = request;

  if (route === 'tours') {
    const [row] = await db.select().from(t.tours).where(eq(t.tours.slug, slug)).limit(1);
    if (row?.isPublished !== true) return null;

    const content = await asContent(
      request,
      text(row.title, lang),
      text(row.summary, lang),
      row.coverMediaId,
    );
    jsonLd.push(
      ld.touristTrip({
        name: content.name,
        description: content.summary ?? '',
        url,
        imageUrl: content.imageUrl,
        days: row.days,
        priceMinor: row.priceFromMinor,
        currency: row.priceCurrency,
      }),
    );
    return content;
  }

  if (route === 'hotels') {
    const [row] = await db.select().from(t.hotels).where(eq(t.hotels.slug, slug)).limit(1);
    if (row?.isPublished !== true) return null;

    const content = await asContent(
      request,
      text(row.name, lang),
      text(row.summary, lang),
      row.coverMediaId,
    );
    jsonLd.push(
      ld.hotel({
        name: content.name,
        description: content.summary ?? '',
        url,
        imageUrl: content.imageUrl,
        city: text(row.city, lang),
        stars: row.stars,
      }),
    );
    return content;
  }

  if (route === 'article') {
    const [row] = await db.select().from(t.articles).where(eq(t.articles.slug, slug)).limit(1);
    if (row?.isPublished !== true) return null;

    const content = await asContent(
      request,
      text(row.title, lang),
      text(row.summary, lang),
      row.coverMediaId,
    );
    jsonLd.push(
      ld.article({
        headline: content.name,
        description: content.summary ?? '',
        url,
        imageUrl: content.imageUrl,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        site: request.site,
      }),
    );
    return content;
  }

  if (route === 'ziyarat') {
    const [row] = await db
      .select()
      .from(t.ziyaratPlaces)
      .where(eq(t.ziyaratPlaces.slug, slug))
      .limit(1);
    if (row?.isPublished !== true) return null;

    const content = await asContent(
      request,
      text(row.name, lang),
      text(row.description, lang),
      row.coverMediaId,
    );
    jsonLd.push(
      ld.touristAttraction({
        name: content.name,
        description: content.summary ?? '',
        url,
        imageUrl: content.imageUrl,
        city: row.city,
      }),
    );
    return content;
  }

  return null;
}

async function asContent(
  request: ShellRequest,
  name: string,
  summary: string,
  mediaId: number | null,
): Promise<ShellContent> {
  return {
    name,
    summary: summary === '' ? null : summary,
    imageUrl: await imageFor(request, mediaId),
  };
}

/** Absolute, because an `og:image` is read by a server on the other side of the world. */
async function imageFor(request: ShellRequest, mediaId: number | null): Promise<string | null> {
  if (mediaId === null) return null;

  const [row] = await request.db
    .select({ key: t.media.storageKey })
    .from(t.media)
    .where(eq(t.media.id, mediaId))
    .limit(1);

  if (row === undefined) return null;
  const base = request.mediaBaseUrl === '' ? request.origin : request.mediaBaseUrl;
  return mediaUrl(row.key, base);
}

/**
 * The structured data a list page carries.
 *
 * Kept apart from `loadContent` because these are pages *about* a set rather than about a row,
 * and the queries are aggregates rather than lookups.
 */
async function addRouteJsonLd(
  request: ShellRequest,
  route: string,
  lang: Lang,
  origin: string,
  jsonLd: unknown[],
): Promise<void> {
  const { db, site } = request;

  if (route === 'reviews') {
    const summary = await reviewSummary(db);
    const rating = ld.aggregateRating({
      count: summary.total,
      average: summary.average,
      site,
      url: origin,
    });
    if (rating !== null) jsonLd.push(rating);
    return;
  }

  if (route === 'contact' || route === 'paket') {
    const rows = await db
      .select()
      .from(t.faqs)
      .where(
        and(eq(t.faqs.site, site === 'umrah' ? 'umrah' : 'global'), eq(t.faqs.isPublished, true)),
      )
      .orderBy(t.faqs.sortOrder);

    const page = ld.faqPage(
      rows.map((row) => ({ question: text(row.question, lang), answer: text(row.answer, lang) })),
    );
    if (page !== null) jsonLd.push(page);
    return;
  }

  if (route === 'video') {
    const rows = await db
      .select()
      .from(t.videos)
      .where(eq(t.videos.isPublished, true))
      .orderBy(t.videos.sortOrder)
      .limit(10);

    for (const row of rows) {
      jsonLd.push(
        ld.videoObject({
          name: text(row.title, lang),
          description: text(row.description, lang),
          url: `${origin}/${lang}/video`,
          thumbnailUrl: await imageFor(request, row.posterMediaId),
          durationSeconds: row.durationSec,
          uploadDate: row.createdAt.toISOString(),
        }),
      );
    }
    return;
  }

  /*
   * The departure, as an `Event` — on the Umrah homepage only.
   *
   * The one page where a date in a search result is worth something to the reader: «when is
   * the next group» is the question the whole site exists to answer. Without a price, and the
   * note in `jsonld.ts` explains why that is not an oversight.
   */
  if (route === 'home' && site === 'umrah') {
    const [row] = await db
      .select()
      .from(t.umrahTrips)
      .where(eq(t.umrahTrips.isCurrent, true))
      .limit(1);

    if (row === undefined) return;

    const state = deriveTripState(
      {
        departAt: new Date(`${row.departAt.replace(' ', 'T')}Z`),
        returnAt: new Date(`${row.returnAt.replace(' ', 'T')}Z`),
        signupClosesAt:
          row.signupClosesAt === null ? null : new Date(`${row.signupClosesAt.replace(' ', 'T')}Z`),
        seatsTotal: row.seatsTotal,
        seatsTaken: row.seatsTaken,
      },
      request.now ?? new Date(),
    );

    jsonLd.push(
      ld.departureEvent({
        name: `Umra ${row.departAt.slice(0, 10)}`,
        url: `${origin}/${lang}`,
        startDate: `${row.departAt.replace(' ', 'T')}Z`,
        endDate: `${row.returnAt.replace(' ', 'T')}Z`,
        seatsLeft: Math.max(0, row.seatsTotal - row.seatsTaken),
        isOpen: state.signupOpen,
      }),
    );
  }
}
