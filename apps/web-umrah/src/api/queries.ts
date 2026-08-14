import {
  createApiClient,
  type FormTokenResponse,
  type Lang,
  type UmrahCurrentTripResponse,
  type UmrahGroupDetailResponse,
  type UmrahGroupsResponse,
  type UmrahHomeResponse,
  type UmrahPackageResponse,
  type UmrahProgramResponse,
  type UmrahSettingsResponse,
  type UmrahSignupRequest,
  type UmrahSignupResponse,
  type ZiyaratDetailResponse,
  type ZiyaratResponse,
} from '@charva/contracts';
import { queryOptions } from '@tanstack/react-query';

/**
 * Every request this site makes, in one file.
 *
 * Same origin in every environment — Vite proxies `/api` in development and preview, nginx does
 * it in production — so the browser never sends a preflight.
 *
 * `staleTime` matches the API's own sixty-second window. One entry deserves a note: the current
 * departure is cached like everything else, and that is safe because the countdown is computed
 * in the browser from `departAt`. A sixty-second-old answer means a slightly stale seat count,
 * never a clock that is a minute wrong.
 */
const api = createApiClient();

const MINUTE = 60_000;

export function settingsQuery(lang: Lang) {
  return queryOptions({
    queryKey: ['settings', lang] as const,
    queryFn: ({ signal }) =>
      api.get<UmrahSettingsResponse>('/umrah/settings', { query: { lang }, signal }),
    staleTime: 30 * MINUTE,
  });
}

/**
 * The departure every page on this site depends on.
 *
 * One row, one request, one source for the countdown, the progress bar, the seat count, both
 * dates and the six states. In the prototypes the same departure is a hardcoded `TARGET` in
 * three files and the string `18.09.2026` typed into eight more places — decision D-13.
 */
export function tripQuery(lang: Lang) {
  return queryOptions({
    queryKey: ['trip', lang] as const,
    queryFn: ({ signal }) =>
      api.get<UmrahCurrentTripResponse>('/umrah/trip/current', { query: { lang }, signal }),
    staleTime: MINUTE,
  });
}

export function homeQuery(lang: Lang) {
  return queryOptions({
    queryKey: ['home', lang] as const,
    queryFn: ({ signal }) => api.get<UmrahHomeResponse>('/umrah/home', { query: { lang }, signal }),
    staleTime: MINUTE,
  });
}

export function packageQuery(lang: Lang) {
  return queryOptions({
    queryKey: ['package', lang] as const,
    queryFn: ({ signal }) =>
      api.get<UmrahPackageResponse>('/umrah/package', { query: { lang }, signal }),
    staleTime: 5 * MINUTE,
  });
}

export function programQuery(lang: Lang) {
  return queryOptions({
    queryKey: ['program', lang] as const,
    queryFn: ({ signal }) =>
      api.get<UmrahProgramResponse>('/umrah/program', { query: { lang }, signal }),
    staleTime: 5 * MINUTE,
  });
}

export function ziyaratQuery(lang: Lang, city?: string) {
  return queryOptions({
    queryKey: ['ziyarat', lang, city ?? null] as const,
    queryFn: ({ signal }) =>
      api.get<ZiyaratResponse>('/umrah/ziyarat', {
        query: { lang, ...(city === undefined ? {} : { city }) },
        signal,
      }),
    staleTime: 5 * MINUTE,
  });
}

export function ziyaratPlaceQuery(lang: Lang, slug: string) {
  return queryOptions({
    queryKey: ['ziyarat-place', lang, slug] as const,
    queryFn: ({ signal }) =>
      api.get<ZiyaratDetailResponse>(`/umrah/ziyarat/${encodeURIComponent(slug)}`, {
        query: { lang },
        signal,
      }),
    staleTime: 5 * MINUTE,
  });
}

export function groupsQuery(lang: Lang, perPage: number) {
  return queryOptions({
    queryKey: ['groups', lang, perPage] as const,
    queryFn: ({ signal }) =>
      api.get<UmrahGroupsResponse>('/umrah/groups', { query: { lang, perPage }, signal }),
    staleTime: 5 * MINUTE,
  });
}

/**
 * One group's photographs and clips.
 *
 * Fetched per group rather than with the list: sixty-eight groups of forty photographs each is
 * a payload nobody on a phone should download to look at one of them. The prototype has no
 * choice in the matter — everything is in the bundle — which is why its mosaic shows eight
 * tiles beside a counter claiming thirty-eight.
 */
export function groupQuery(lang: Lang, slug: string) {
  return queryOptions({
    queryKey: ['group', lang, slug] as const,
    queryFn: ({ signal }) =>
      api.get<UmrahGroupDetailResponse>(`/umrah/groups/${encodeURIComponent(slug)}`, {
        query: { lang },
        signal,
      }),
    staleTime: 5 * MINUTE,
  });
}

/** The signed moment the form was rendered — anti-spam layer three. */
export function formTokenQuery() {
  return queryOptions({
    queryKey: ['form-token'] as const,
    queryFn: ({ signal }) => api.get<FormTokenResponse>('/forms/token', { signal }),
    staleTime: 0,
    gcTime: 0,
  });
}

export function postSignup(
  lang: Lang,
  body: UmrahSignupRequest,
): Promise<UmrahSignupResponse | undefined> {
  // `undefined` is a real answer: the honeypot branch replies 204 and writes nothing, and the
  // form shows the same confirmation either way.
  return api.post<UmrahSignupResponse | undefined>('/umrah/signups', body, { query: { lang } });
}
