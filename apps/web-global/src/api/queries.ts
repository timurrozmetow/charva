import {
  type ArticleDetail,
  type ArticlesResponse,
  type BuilderConfigResponse,
  type BuilderQuoteRequest,
  type BuilderQuoteResponse,
  type CountryResponse,
  createApiClient,
  type FaqResponse,
  type FormTokenResponse,
  type GalleryResponse,
  type GlobalHomeResponse,
  type GlobalSettingsResponse,
  type HotelDetail,
  type HotelsResponse,
  type Lang,
  type LeadRequest,
  type LeadResponse,
  type ReviewsResponse,
  type TourDetail,
  type ToursResponse,
  type VideosResponse,
} from '@charva/contracts';
import { queryOptions } from '@tanstack/react-query';

/**
 * Every request this site makes, in one file.
 *
 * Same origin in every environment — Vite proxies `/api` in development and preview, nginx does
 * it in production — so the browser never sends a preflight, which is a round trip saved on a
 * connection where round trips are the expensive part.
 *
 * `staleTime` matches the API's own sixty-second window everywhere. Asking again inside that
 * window would be answered from the same in-process cache anyway; this way it is answered
 * without leaving the tab.
 */
const api = createApiClient();

const MINUTE = 60_000;

/** Query parameters that survive into the cache key, so two filters are two entries. */
type ListQuery = Record<string, string | number | undefined>;

export function settingsQuery(lang: Lang) {
  return queryOptions({
    queryKey: ['settings', lang] as const,
    queryFn: ({ signal }) =>
      api.get<GlobalSettingsResponse>('/global/settings', { query: { lang }, signal }),
    // Contacts and the licence number change about once a year.
    staleTime: 30 * MINUTE,
  });
}

/**
 * The homepage in one request.
 *
 * Nine separate calls would be nine chances to arrive half-rendered on a poor connection, and
 * nine round trips before the largest element on the page can begin loading. The data is the
 * same; the server assembles it and caches it as one piece under one ETag.
 */
export function homeQuery(lang: Lang) {
  return queryOptions({
    queryKey: ['home', lang] as const,
    queryFn: ({ signal }) =>
      api.get<GlobalHomeResponse>('/global/home', { query: { lang }, signal }),
    staleTime: MINUTE,
  });
}

export function toursQuery(lang: Lang, query: ListQuery = {}) {
  return queryOptions({
    queryKey: ['tours', lang, query] as const,
    queryFn: ({ signal }) =>
      api.get<ToursResponse>('/global/tours', { query: { lang, ...query }, signal }),
    staleTime: MINUTE,
  });
}

export function tourQuery(lang: Lang, slug: string) {
  return queryOptions({
    queryKey: ['tour', lang, slug] as const,
    queryFn: ({ signal }) =>
      api.get<TourDetail>(`/global/tours/${encodeURIComponent(slug)}`, { query: { lang }, signal }),
    staleTime: MINUTE,
  });
}

export function hotelsQuery(lang: Lang, query: ListQuery = {}) {
  return queryOptions({
    queryKey: ['hotels', lang, query] as const,
    queryFn: ({ signal }) =>
      api.get<HotelsResponse>('/global/hotels', { query: { lang, ...query }, signal }),
    staleTime: MINUTE,
  });
}

export function hotelQuery(lang: Lang, slug: string) {
  return queryOptions({
    queryKey: ['hotel', lang, slug] as const,
    queryFn: ({ signal }) =>
      api.get<HotelDetail>(`/global/hotels/${encodeURIComponent(slug)}`, {
        query: { lang },
        signal,
      }),
    staleTime: MINUTE,
  });
}

export function articlesQuery(lang: Lang, query: ListQuery = {}) {
  return queryOptions({
    queryKey: ['articles', lang, query] as const,
    queryFn: ({ signal }) =>
      api.get<ArticlesResponse>('/global/articles', { query: { lang, ...query }, signal }),
    staleTime: MINUTE,
  });
}

export function articleQuery(lang: Lang, slug: string) {
  return queryOptions({
    queryKey: ['article', lang, slug] as const,
    queryFn: ({ signal }) =>
      api.get<ArticleDetail>(`/global/articles/${encodeURIComponent(slug)}`, {
        query: { lang },
        signal,
      }),
    staleTime: MINUTE,
  });
}

export function galleryQuery(lang: Lang, query: ListQuery = {}) {
  return queryOptions({
    queryKey: ['gallery', lang, query] as const,
    queryFn: ({ signal }) =>
      api.get<GalleryResponse>('/global/gallery', { query: { lang, ...query }, signal }),
    staleTime: MINUTE,
  });
}

export function videosQuery(lang: Lang, query: ListQuery = {}) {
  return queryOptions({
    queryKey: ['videos', lang, query] as const,
    queryFn: ({ signal }) =>
      api.get<VideosResponse>('/global/videos', { query: { lang, ...query }, signal }),
    staleTime: MINUTE,
  });
}

export function reviewsQuery(lang: Lang, query: ListQuery = {}) {
  return queryOptions({
    queryKey: ['reviews', lang, query] as const,
    queryFn: ({ signal }) =>
      api.get<ReviewsResponse>('/global/reviews', { query: { lang, ...query }, signal }),
    staleTime: MINUTE,
  });
}

export function countryQuery(lang: Lang) {
  return queryOptions({
    queryKey: ['country', lang] as const,
    queryFn: ({ signal }) =>
      api.get<CountryResponse>('/global/country', { query: { lang }, signal }),
    staleTime: 5 * MINUTE,
  });
}

export function faqQuery(lang: Lang) {
  return queryOptions({
    queryKey: ['faq', lang] as const,
    queryFn: ({ signal }) => api.get<FaqResponse>('/global/faq', { query: { lang }, signal }),
    staleTime: 5 * MINUTE,
  });
}

/**
 * The rates and the options the builder prices with.
 *
 * Fetched once and held: the client runs the same `quote()` from `@charva/contracts` on every
 * click so the estimate moves at once, and only the authoritative recalculation goes over the
 * wire. Decision D-11.
 */
export function builderConfigQuery(lang: Lang) {
  return queryOptions({
    queryKey: ['builder-config', lang] as const,
    queryFn: ({ signal }) =>
      api.get<BuilderConfigResponse>('/global/builder/config', { query: { lang }, signal }),
    staleTime: 5 * MINUTE,
  });
}

/**
 * The authoritative price.
 *
 * Not a query — it is a POST, debounced by the caller, and its answer confirms rather than
 * produces the number on screen. There is no second implementation for it to disagree with.
 */
export function postQuote(
  lang: Lang,
  body: BuilderQuoteRequest,
  signal?: AbortSignal,
): Promise<BuilderQuoteResponse> {
  return api.post<BuilderQuoteResponse>('/global/builder/quote', body, {
    query: { lang },
    ...(signal === undefined ? {} : { signal }),
  });
}

/**
 * The signed moment a form was rendered — anti-spam layer three.
 *
 * Fetched when the form mounts rather than when it submits, because the whole mechanism is the
 * gap between the two: a submission arriving less than three seconds after the token was issued
 * was not typed by a person.
 */
export function formTokenQuery() {
  return queryOptions({
    queryKey: ['form-token'] as const,
    queryFn: ({ signal }) => api.get<FormTokenResponse>('/forms/token', { signal }),
    // Deliberately never reused from cache: a stale token is one that may already have expired.
    staleTime: 0,
    gcTime: 0,
  });
}

export function postLead(lang: Lang, body: LeadRequest): Promise<LeadResponse | undefined> {
  // `undefined` is a real answer: the honeypot branch replies 204 and writes nothing, and the
  // form shows the same confirmation either way — an error message is a lesson for a bot.
  return api.post<LeadResponse | undefined>('/global/leads', body, { query: { lang } });
}
