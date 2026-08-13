import { type ApiError, apiErrorSchema, type Lang } from '@charva/contracts';

/**
 * The one place this app talks to the API.
 *
 * Same origin in every environment: Vite proxies `/api` in development and preview, and nginx
 * proxies it in production. That keeps the browser from ever sending a preflight, which matters
 * on a connection where a wasted round trip is measured in hundreds of milliseconds.
 */
const BASE = '/api/v1';

/** A failed request, carrying the envelope the API sends rather than a status number. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiError | null,
  ) {
    super(body?.error.message ?? `Request failed with ${String(status)}`);
    this.name = 'ApiRequestError';
  }
}

export async function apiGet<T>(path: string, lang: Lang, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${BASE}${path}?lang=${lang}`, {
    headers: { accept: 'application/json' },
    ...(signal === undefined ? {} : { signal }),
  });

  if (!response.ok) {
    // The envelope is the same shape on every failure — one branch, not one per endpoint.
    const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new ApiRequestError(response.status, parsed.success ? parsed.data : null);
  }

  return (await response.json()) as T;
}
