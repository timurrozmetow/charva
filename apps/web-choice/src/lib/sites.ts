/**
 * Where the two halves lead.
 *
 * Separate subdomains in production and separate dev servers locally, so the destination cannot
 * be a relative path and cannot be hardcoded either. Environment variables with development
 * defaults: the ports are the ones in CLAUDE.md's port map, chosen because the silkgrain project
 * on this machine already owns everything Vite picks by itself.
 */
export const SITE_URLS = {
  global: import.meta.env.VITE_GLOBAL_URL ?? 'http://localhost:5181',
  umrah: import.meta.env.VITE_UMRAH_URL ?? 'http://localhost:5182',
} as const;
