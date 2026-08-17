import { type Site, SITE_BRAND } from '@charva/contracts';

/**
 * Structured data, as plain objects.
 *
 * Pure functions over values that have already been fetched, so every shape here can be
 * asserted on without a database. That matters more than usual: structured data is invisible.
 * A wrong `@type`, a missing `name`, a price that should not be there — none of it shows on the
 * page, and the first sign of trouble is a search result that stopped appearing months ago.
 *
 * One rule governs the Umrah half of this file, and it is the same rule as everywhere else:
 * **no offers, no prices**. `Event` for a departure carries a date, a place and a name, and
 * nothing about money (D-12). The temptation is real, because `Event` has an `offers` field
 * and search engines like it filled.
 */

export interface OrganizationInput {
  site: Site;
  url: string;
  phone: string;
  email: string;
  address: string;
  socials: string[];
  logoUrl: string | null;
}

/**
 * The agency itself, on every page.
 *
 * `TravelAgency` rather than `Organization`: it is the narrower type, and it is what puts the
 * phone number into a knowledge panel instead of a generic company card.
 */
export function organization(input: OrganizationInput): Record<string, unknown> {
  return prune({
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: SITE_BRAND[input.site],
    url: input.url,
    telephone: input.phone === '' ? null : input.phone,
    email: input.email === '' ? null : input.email,
    address:
      input.address === ''
        ? null
        : {
            '@type': 'PostalAddress',
            addressLocality: 'Aşgabat',
            addressCountry: 'TM',
            streetAddress: input.address,
          },
    sameAs: input.socials.length === 0 ? null : input.socials,
    logo: input.logoUrl,
  });
}

export interface BreadcrumbStep {
  name: string;
  url: string;
}

/**
 * The trail, for the line under a search result.
 *
 * Built from the same steps the page renders, so a crawler is told what a reader is shown.
 */
export function breadcrumbs(steps: BreadcrumbStep[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: steps.map((step, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: step.name,
      item: step.url,
    })),
  };
}

export interface TourInput {
  name: string;
  description: string;
  url: string;
  imageUrl: string | null;
  days: number;
  priceMinor: number;
  currency: string;
}

/** A ready-made route. The only structured data in the project that carries a price. */
export function touristTrip(input: TourInput): Record<string, unknown> {
  return prune({
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: input.name,
    description: input.description === '' ? null : input.description,
    url: input.url,
    image: input.imageUrl,
    itinerary: { '@type': 'ItemList', numberOfItems: input.days },
    offers: {
      '@type': 'Offer',
      // Minor units are an implementation detail of the database, never of the wire.
      price: (input.priceMinor / 100).toFixed(2),
      priceCurrency: input.currency,
      availability: 'https://schema.org/InStock',
    },
  });
}

export interface HotelInput {
  name: string;
  description: string;
  url: string;
  imageUrl: string | null;
  city: string;
  stars: number | null;
}

export function hotel(input: HotelInput): Record<string, unknown> {
  return prune({
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: input.name,
    description: input.description === '' ? null : input.description,
    url: input.url,
    image: input.imageUrl,
    address: { '@type': 'PostalAddress', addressLocality: input.city, addressCountry: 'TM' },
    // A yurt camp has no star rating and must not be given one — the same distinction the
    // catalogue draws between `stars` and `category`.
    starRating:
      input.stars === null ? null : { '@type': 'Rating', ratingValue: String(input.stars) },
  });
}

export interface AttractionInput {
  name: string;
  description: string;
  url: string;
  imageUrl: string | null;
  city: string;
}

/** A place of ziyarat, or one of the six places on the Turkmenistan page. */
export function touristAttraction(input: AttractionInput): Record<string, unknown> {
  return prune({
    '@context': 'https://schema.org',
    '@type': 'TouristAttraction',
    name: input.name,
    description: input.description === '' ? null : input.description,
    url: input.url,
    image: input.imageUrl,
    address: { '@type': 'PostalAddress', addressLocality: input.city },
  });
}

export interface ArticleInput {
  headline: string;
  description: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string | null;
  site: Site;
}

export function article(input: ArticleInput): Record<string, unknown> {
  return prune({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description === '' ? null : input.description,
    url: input.url,
    image: input.imageUrl,
    datePublished: input.publishedAt,
    publisher: { '@type': 'Organization', name: SITE_BRAND[input.site] },
  });
}

export interface RatingInput {
  count: number;
  average: number;
  site: Site;
  url: string;
}

/**
 * The aggregate rating, counted rather than claimed.
 *
 * Emitted only when there is something to average. Structured data asserting «4.8 from 0
 * reviews» is the machine-readable form of the invented numbers D-6 removed from the pages.
 */
export function aggregateRating(input: RatingInput): Record<string, unknown> | null {
  if (input.count === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: SITE_BRAND[input.site],
    url: input.url,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: input.average.toFixed(1),
      reviewCount: input.count,
      bestRating: '5',
    },
  };
}

export interface VideoInput {
  name: string;
  description: string;
  url: string;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  uploadDate: string | null;
}

export function videoObject(input: VideoInput): Record<string, unknown> {
  return prune({
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: input.name,
    description: input.description === '' ? null : input.description,
    contentUrl: input.url,
    thumbnailUrl: input.thumbnailUrl,
    // ISO 8601, which is what the specification asks for and not what a column holds.
    duration: input.durationSeconds === null ? null : `PT${String(input.durationSeconds)}S`,
    uploadDate: input.uploadDate,
  });
}

export function faqPage(
  items: { question: string; answer: string }[],
): Record<string, unknown> | null {
  if (items.length === 0) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };
}

export interface DepartureInput {
  name: string;
  url: string;
  startDate: string;
  endDate: string;
  seatsLeft: number;
  isOpen: boolean;
}

/**
 * The departure, as an event — and without a price.
 *
 * `Event` has an `offers` field, search engines reward filling it, and `umrah_trips` has the
 * number sitting right there. It stays out. The rule is that no price for the pilgrimage
 * reaches a browser, and a `<script type="application/ld+json">` is a browser.
 */
export function departureEvent(input: DepartureInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: input.name,
    url: input.url,
    startDate: input.startDate,
    endDate: input.endDate,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: 'Mekge, Medine',
      address: { '@type': 'PostalAddress', addressCountry: 'SA' },
    },
    organizer: { '@type': 'Organization', name: SITE_BRAND.umrah },
    maximumAttendeeCapacity: input.seatsLeft,
  };
}

/** Drops null and undefined, so an absent phone number is an absent key rather than `null`. */
function prune(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== null && item !== undefined),
  );
}
