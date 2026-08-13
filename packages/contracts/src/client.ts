import { type ApiError, apiErrorSchema } from './errors';

/**
 * The client half of the wire format.
 *
 * It lives beside the error envelope it decodes, and that is the argument for it being here
 * rather than copied into each SPA: the envelope's shape and the code that reads it are one
 * decision, and three copies of the reader is three chances for one of them to stop matching.
 *
 * Deliberately not a data-fetching library. TanStack Query owns caching, retries and
 * deduplication in the apps; this owns the URL, the headers and turning a failure into
 * something with a code on it.
 */

/** A failed request, carrying the envelope rather than a bare status number. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    /** Null when the response was not the envelope at all — a proxy error page, say. */
    readonly body: ApiError | null,
  ) {
    super(body?.error.message ?? `Request failed with ${String(status)}`);
    this.name = 'ApiRequestError';
  }

  get code(): string {
    return this.body?.error.code ?? 'internal';
  }

  /** Field-level messages from a 400, keyed by the path the API reported. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const detail of this.body?.error.details ?? []) out[detail.path] = detail.message;
    return out;
  }
}

export interface ApiClientOptions {
  /** Same origin in every environment: Vite proxies it locally, nginx proxies it in production,
   * and the browser therefore never sends a preflight. */
  baseUrl?: string;
}

export interface RequestOptions {
  /** Added to the query string. `undefined` values are dropped rather than sent as "undefined". */
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

export function createApiClient({ baseUrl = '/api/v1' }: ApiClientOptions = {}) {
  async function request<T>(method: string, path: string, options: RequestOptions, body?: unknown) {
    const search = new URLSearchParams();
    for (const [name, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) search.set(name, String(value));
    }
    const query = search.toString();

    const response = await fetch(`${baseUrl}${path}${query === '' ? '' : `?${query}`}`, {
      method,
      headers: {
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    });

    if (!response.ok) {
      const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
      throw new ApiRequestError(response.status, parsed.success ? parsed.data : null);
    }

    // 204 is a real answer: the honeypot branch of the lead endpoints returns one deliberately.
    if (response.status === 204) return undefined as T;

    return (await response.json()) as T;
  }

  return {
    get: <T>(path: string, options: RequestOptions = {}) => request<T>('GET', path, options),
    post: <T>(path: string, body: unknown, options: RequestOptions = {}) =>
      request<T>('POST', path, options, body),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
