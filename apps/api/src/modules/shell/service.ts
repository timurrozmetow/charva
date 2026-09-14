import {
  breadcrumbHome,
  breadcrumbSection,
  type ImageWidth,
  IMAGE_WIDTHS,
  imageUrl,
  type Lang,
  routeMeta,
  SITE_BRAND,
  SITE_ORIGINS,
  type Site,
} from '@charva/contracts';
import { and, eq } from 'drizzle-orm';

import { type Database } from '../../db/client';
import * as t from '../../db/schema';
import { text } from '../../lib/serialize';
import { deriveTripState } from '../../lib/trip-status';
import { getSettings, reviewSummary } from '../global/service';
import { currentTripRows } from '../umrah/service';

import { anchorText, type FallbackLink, renderFallback } from './fallback';
import { buildHead, resolveMeta, type ShareImage, type ShellContext } from './head';
import { type HeadTag } from './html';
import * as ld from './jsonld';
import { resolveRoute, unmatchedRoute } from './routes-map';
import { listedPaths } from './sitemap';

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
  /** Markup for `#root`, for a reader that runs no JavaScript — see `fallback.ts`. */
  body: string;
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
      // The one image on these sites that is not a photograph and not content: it ships with the
      // SPA at a fixed path, so it survives every rebuild, which a hashed asset would not.
      // Google wants a logo on the organisation to put a mark on a knowledge panel.
      logoUrl: `${origin}/apple-touch-icon.png`,
    }),
  ];

  const content = await loadContent(request, resolved.route, resolved.slug, lang, url, jsonLd);

  /*
   * The trail, for the second line of a search result.
   *
   * `ld.breadcrumbs` has existed since phase 8, with a test, and was called from nowhere — the
   * same shape of gap as D-88. Only detail pages get one, because a breadcrumb list of a single
   * item is what Google ignores anyway, and the pages that need it are the deep ones.
   */
  if (content !== null && resolved.slug !== null) {
    // Two steps when there is no section page to point at — an article, whose list page this
    // site does not have. A trail naming a URL that answers 404 is worse than a shorter one:
    // every step gets fetched.
    const section = breadcrumbSection(site, resolved.route, lang);

    jsonLd.push(
      ld.breadcrumbs([
        { name: breadcrumbHome(lang), url: `${origin}/${lang}` },
        ...(section === null
          ? []
          : [{ name: section.name, url: `${origin}/${lang}${section.path}` }]),
        { name: content.name, url },
      ]),
    );
  }

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
    // Resolved even when a row was found, because a row without a cover still shares better
    // with its section's photograph than with nothing.
    defaultImage: await defaultImageFor(request, route, lang),
    analytics: await analyticsFor(db, settingsSite),
  };

  await addRouteJsonLd(request, route, lang, origin, jsonLd);

  const meta = resolveMeta(context, routeMeta(site, route, lang));

  return {
    tags: buildHead(context),
    lang,
    // `resolved.matched`, not a comparison against `unmatchedRoute(site)`: on the chooser those
    // are the same route id, and the comparison made every chooser URL answer 404 — see the
    // note on `matched` in routes-map.ts.
    found: resolved.matched && !missing,
    body: renderFallback({
      site,
      lang,
      title: meta.title,
      description: meta.description,
      links: await fallbackLinks(db, site, lang, resolved.pathAfterLang),
      contacts: { phone: settings.contacts.phone, email: settings.contacts.email },
    }),
  };
}

/**
 * The links a crawler that renders nothing would otherwise never find.
 *
 * Taken from the sitemap's page list, so the empty-section rule is applied once rather than
 * twice (D-144), and labelled with each page's own `<title>` minus the brand, so no text is
 * written for this purpose and none of it can drift.
 *
 * The chooser is the exception and has to be: its list is one entry, itself, because its whole
 * content is two links to the other two hosts. Those are the most valuable links on the domain
 * — they are how a crawler learns the two brands are one operator — and they are cross-origin,
 * so they come from `SITE_ORIGINS` (D-131) rather than from a path list.
 */
async function fallbackLinks(
  db: Database,
  site: Site,
  lang: Lang,
  currentPath: string,
): Promise<FallbackLink[]> {
  if (site === 'choice') {
    return (['global', 'umrah'] as const).map((target) => ({
      href: SITE_ORIGINS[target],
      label: SITE_BRAND[target],
      current: false,
    }));
  }

  const paths = await listedPaths(db, site);

  return paths.map((path) => {
    // `resolveRoute` reads the language out of the path, so it gets one: the table it matches
    // against is the same one the SPA routers were built from, and a second mapping from path
    // to route id would be the drift this whole file is arranged to avoid.
    const resolved = resolveRoute(site, `/${lang}${path}`);
    const meta = routeMeta(site, resolved.route, lang);

    return {
      href: `/${lang}${path}`,
      label: anchorText(meta.title, site),
      current: path === currentPath,
    };
  });
}

/**
 * Which counters this site has, from `settings`.
 *
 * A row rather than an environment variable, so the owner can add a counter from the admin
 * without a deploy — and so that the wrong id is a value somebody can see and correct rather
 * than a build artefact nobody can inspect. Both fields are optional and an empty string counts
 * as absent: half-filled is the state a settings row spends most of its life in.
 *
 * Metrika's id is a number and GA4's is a string beginning `G-`; anything that does not look
 * like the thing it claims to be is dropped rather than emitted, because a malformed id in a
 * snippet is a script error on every page of the site.
 */
async function analyticsFor(
  db: Database,
  site: 'global' | 'umrah',
): Promise<{ metrika: number | null; ga: string | null }> {
  const [row] = await db
    .select({ value: t.settings.value })
    .from(t.settings)
    .where(and(eq(t.settings.site, site), eq(t.settings.settingKey, 'analytics')))
    .limit(1);

  const value = (row?.value ?? {}) as Record<string, unknown>;

  const metrikaRaw = typeof value['metrika'] === 'string' ? value['metrika'].trim() : '';
  const gaRaw = typeof value['ga'] === 'string' ? value['ga'].trim() : '';

  return {
    metrika: /^\d{6,10}$/.test(metrikaRaw) ? Number(metrikaRaw) : null,
    ga: /^G-[A-Z0-9]{6,12}$/i.test(gaRaw) ? gaRaw : null,
  };
}

interface ShellContent {
  name: string;
  summary: string | null;
  image: ShareImage | null;
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
      lang,
    );
    jsonLd.push(
      ld.touristTrip({
        name: content.name,
        description: content.summary ?? '',
        url,
        imageUrl: content.image?.url ?? null,
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
      lang,
    );
    jsonLd.push(
      ld.hotel({
        name: content.name,
        description: content.summary ?? '',
        url,
        imageUrl: content.image?.url ?? null,
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
      lang,
    );
    jsonLd.push(
      ld.article({
        headline: content.name,
        description: content.summary ?? '',
        url,
        imageUrl: content.image?.url ?? null,
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
      lang,
    );
    jsonLd.push(
      ld.touristAttraction({
        name: content.name,
        description: content.summary ?? '',
        url,
        imageUrl: content.image?.url ?? null,
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
  lang: Lang,
): Promise<ShellContent> {
  return {
    name,
    summary: summary === '' ? null : summary,
    image: await imageFor(request, mediaId, lang),
  };
}

/**
 * The widest derivative that is not an upscale, and not larger than a preview needs.
 *
 * The original is what `og:image` used to point at, and the originals here are eight hundred
 * kilobytes and up. Facebook, Telegram and WhatsApp all fetch that file on a machine that is
 * not the reader's, on a timer, and WhatsApp gives up on anything much past a quarter of a
 * megabyte — so the link that gets forwarded most in this market is exactly the one that
 * showed no picture. 1280 is past the point where a card looks any better.
 */
function shareWidth(intrinsic: number | null): ImageWidth {
  const usable = IMAGE_WIDTHS.filter(
    (width) => width <= 1280 && (intrinsic === null || width <= intrinsic),
  );
  return usable.at(-1) ?? IMAGE_WIDTHS[0];
}

/** Absolute, because an `og:image` is read by a server on the other side of the world. */
async function imageFor(
  request: ShellRequest,
  mediaId: number | null,
  lang: Lang,
): Promise<ShareImage | null> {
  if (mediaId === null) return null;

  const [row] = await request.db
    .select({
      key: t.media.storageKey,
      width: t.media.width,
      height: t.media.height,
      alt: t.media.alt,
    })
    .from(t.media)
    .where(eq(t.media.id, mediaId))
    .limit(1);

  if (row === undefined) return null;
  const base = request.mediaBaseUrl === '' ? request.origin : request.mediaBaseUrl;

  const width = shareWidth(row.width);
  // Only when both are known: a card told a width and left to guess the height reflows once the
  // bytes land, which is the jump `og:image:width` exists to prevent.
  const height =
    row.width === null || row.height === null ? null : Math.round((width * row.height) / row.width);

  return {
    url: imageUrl(row.key, width, base),
    width,
    height,
    alt: text(row.alt, lang),
    /*
     * Relative, exactly as `Img` builds it in the browser.
     *
     * The two strings have to produce identical URLs or the preload fetches a second copy of
     * the same photograph — which is what it was doing. `Img` starts from `media.url`, which is
     * relative now that photographs come from the page's own origin (D-141), so this does too.
     */
    srcSet: IMAGE_WIDTHS.map(
      (candidate) => `${imageUrl(row.key, candidate)} ${String(candidate)}w`,
    ).join(', '),
  };
}

/**
 * What a page with no row of its own shows when it is shared.
 *
 * Every page here is built on photographs, and until now only the four detail routes put one in
 * their `og:image` — so a link to the homepage, to `/tours`, to the pilgrimage, to any of the
 * twenty pages somebody would actually send a friend, arrived in Telegram as a line of grey
 * text. That is the channel this site is distributed through (D-4), so it was the wrong twenty
 * pages to leave bare.
 *
 * The picture is the page's own first photograph rather than a logo or a stored «sharing
 * image». One fewer thing to keep in step, and the card shows what the page is about; the fact
 * that it is the same picture the visitor then lands on is the point rather than a coincidence.
 * A section with nothing of its own falls back to the site's first hero slide.
 */
async function defaultImageFor(
  request: ShellRequest,
  route: string,
  lang: Lang,
): Promise<ShareImage | null> {
  const { db, site } = request;

  const first = async (mediaId: number | null | undefined): Promise<ShareImage | null> =>
    mediaId === undefined ? null : imageFor(request, mediaId, lang);

  if (site === 'global') {
    if (route === 'tours') {
      const [row] = await db
        .select({ mediaId: t.tours.coverMediaId })
        .from(t.tours)
        .where(and(eq(t.tours.isPublished, true), eq(t.tours.isFeatured, true)))
        .orderBy(t.tours.sortOrder)
        .limit(1);
      const image = await first(row?.mediaId);
      if (image !== null) return image;
    }

    if (route === 'hotels') {
      const [row] = await db
        .select({ mediaId: t.hotels.coverMediaId })
        .from(t.hotels)
        .where(eq(t.hotels.isPublished, true))
        .orderBy(t.hotels.sortOrder)
        .limit(1);
      const image = await first(row?.mediaId);
      if (image !== null) return image;
    }

    if (route === 'country') {
      const [row] = await db
        .select({ mediaId: t.placesToSee.coverMediaId })
        .from(t.placesToSee)
        .where(eq(t.placesToSee.isPublished, true))
        .orderBy(t.placesToSee.sortOrder)
        .limit(1);
      const image = await first(row?.mediaId);
      if (image !== null) return image;
    }

    if (route === 'articles') {
      const [row] = await db
        .select({ mediaId: t.articles.coverMediaId })
        .from(t.articles)
        .where(and(eq(t.articles.isPublished, true), eq(t.articles.isFeatured, true)))
        .orderBy(t.articles.sortOrder)
        .limit(1);
      const image = await first(row?.mediaId);
      if (image !== null) return image;
    }

    if (route === 'gallery') {
      const [row] = await db
        .select({ mediaId: t.galleryItems.mediaId })
        .from(t.galleryItems)
        .where(eq(t.galleryItems.isPublished, true))
        .orderBy(t.galleryItems.sortOrder)
        .limit(1);
      const image = await first(row?.mediaId);
      if (image !== null) return image;
    }

    if (route === 'video') {
      const [row] = await db
        .select({ mediaId: t.videos.posterMediaId })
        .from(t.videos)
        .where(eq(t.videos.isPublished, true))
        .orderBy(t.videos.sortOrder)
        .limit(1);
      const image = await first(row?.mediaId);
      if (image !== null) return image;
    }
  }

  if (site === 'umrah' && (route === 'ziyarat' || route === 'maksatnama')) {
    const [row] = await db
      .select({ mediaId: t.ziyaratPlaces.coverMediaId })
      .from(t.ziyaratPlaces)
      .where(eq(t.ziyaratPlaces.isPublished, true))
      .orderBy(t.ziyaratPlaces.sortOrder)
      .limit(1);
    const image = await first(row?.mediaId);
    if (image !== null) return image;
  }

  // The site's own first slide, and for the chooser the Global one — the chooser has no slider
  // of its own (there is no `choice` in `hero_slides`), and its left half is Global.
  const [slide] = await db
    .select({ mediaId: t.heroSlides.mediaId })
    .from(t.heroSlides)
    .where(
      and(
        eq(t.heroSlides.site, site === 'umrah' ? 'umrah' : 'global'),
        eq(t.heroSlides.isPublished, true),
      ),
    )
    .orderBy(t.heroSlides.sortOrder)
    .limit(1);

  return first(slide?.mediaId);
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
          thumbnailUrl: (await imageFor(request, row.posterMediaId, lang))?.url ?? null,
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
    const now = request.now ?? new Date();

    // The same rule the page itself follows, from the same function. This used to select
    // `is_current = true` by itself — the exception rather than the rule (D-13) — so clearing
    // an override that had been pinned to a departed group took the event off the page
    // silently: nothing renders structured data, so nothing looked different.
    const { chosen: row } = await currentTripRows(db, now);
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
      now,
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
