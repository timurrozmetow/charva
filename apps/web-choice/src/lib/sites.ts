import { siteOrigin } from '@charva/contracts';

/**
 * Where the two halves lead.
 *
 * Separate subdomains in production and separate dev servers locally, so the destination cannot
 * be a relative path. It used to be an environment variable with a localhost default and
 * nothing set it, so the first production build sent both halves to `http://localhost:5181` —
 * see `SITE_ORIGINS` in `@charva/contracts` for why the address now lives in the code and the
 * variable only overrides it.
 */
export const SITE_URLS = {
  global: siteOrigin('global', import.meta.env.PROD, import.meta.env.VITE_GLOBAL_URL),
  umrah: siteOrigin('umrah', import.meta.env.PROD, import.meta.env.VITE_UMRAH_URL),
} as const;
