import { type AdminSessionResponse, ApiRequestError, createApiClient } from '@charva/contracts';

/**
 * The admin's client, and the two things that make it different from the public one.
 *
 * The access token lives in a module variable — never in `localStorage`, where any script on
 * the page can read it and where it outlives the tab. Fifteen minutes later it stops working,
 * and rather than showing somebody a login screen in the middle of typing a tour description,
 * the client exchanges the refresh cookie for a new one and repeats the request once.
 *
 * That retry is the reason this file exists at all. Putting it in every query function would be
 * the same three lines twenty times, and the twentieth would be the one that logs somebody out.
 */

let accessToken: string | null = null;

/** Called by the session provider. Nothing else may set it. */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Set by the session provider so a dead session can send the user back to the login screen. */
let onSessionLost: () => void = () => undefined;

export function setSessionLostHandler(handler: () => void): void {
  onSessionLost = handler;
}

const api = createApiClient({
  headers: () => (accessToken === null ? {} : { authorization: `Bearer ${accessToken}` }),
});

/**
 * Ask for a new access token with the refresh cookie.
 *
 * Shared between the boot sequence and the retry below: two refreshes racing would rotate the
 * token twice, and the second rotation would present a token the first had already used — which
 * the server correctly treats as theft and answers by ending the whole session.
 */
let inFlight: Promise<AdminSessionResponse> | null = null;

export function refreshSession(): Promise<AdminSessionResponse> {
  inFlight ??= api
    .post<AdminSessionResponse>('/admin/auth/refresh', undefined)
    .then((session) => {
      setAccessToken(session.accessToken);
      return session;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

function isExpired(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status === 401;
}

/** One retry, and only for an expired token. Anything else is the answer. */
async function withRefresh<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!isExpired(error) || accessToken === null) throw error;

    try {
      await refreshSession();
    } catch {
      setAccessToken(null);
      onSessionLost();
      throw error;
    }

    return call();
  }
}

type Query = Record<string, string | number | boolean | undefined>;

export const adminApi = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) =>
    withRefresh(() =>
      api.get<T>(path, {
        ...(query === undefined ? {} : { query }),
        ...(signal === undefined ? {} : { signal }),
      }),
    ),
  post: <T>(path: string, body: unknown) => withRefresh(() => api.post<T>(path, body)),
  patch: <T>(path: string, body: unknown) => withRefresh(() => api.patch<T>(path, body)),
  put: <T>(path: string, body: unknown) => withRefresh(() => api.put<T>(path, body)),
  remove: <T>(path: string) => withRefresh(() => api.remove<T>(path)),

  /**
   * A file, which does not go through the JSON client at all.
   *
   * `FormData` sets its own `Content-Type` with the multipart boundary, and setting one by hand
   * produces a request the parser cannot read — so this builds the request itself rather than
   * teaching the shared client about a body it will never otherwise see.
   */
  upload: <T>(path: string, file: File) =>
    withRefresh(async () => {
      const body = new FormData();
      body.append('file', file);

      const response = await fetch(`/api/v1${path}`, {
        method: 'POST',
        headers: accessToken === null ? {} : { authorization: `Bearer ${accessToken}` },
        body,
      });

      if (!response.ok) {
        const parsed: unknown = await response.json().catch(() => null);
        throw new ApiRequestError(
          response.status,
          parsed as ConstructorParameters<typeof ApiRequestError>[1],
        );
      }

      return (await response.json()) as T;
    }),
};

export async function login(email: string, password: string): Promise<AdminSessionResponse> {
  const session = await api.post<AdminSessionResponse>('/admin/auth/login', { email, password });
  setAccessToken(session.accessToken);
  return session;
}

export async function logout(): Promise<void> {
  try {
    await api.post('/admin/auth/logout', undefined);
  } finally {
    // Whatever the server said, this tab is done with the session it was holding.
    setAccessToken(null);
  }
}
