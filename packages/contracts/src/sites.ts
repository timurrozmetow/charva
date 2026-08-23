/**
 * Where the four sites live in production.
 *
 * The three public sites link to each other — the chooser sends a visitor to one of the two
 * brands, and both brands link back — and those links cannot be relative, because each site is
 * a separate origin. Until this file existed the destinations were environment variables with
 * localhost fallbacks and nothing ever set them, so the first production build shipped a
 * chooser whose two halves led to `http://localhost:5181`. The owner found it in half a minute.
 *
 * A build-time variable was the wrong shape for this. These are not settings that vary between
 * deployments: there is one Charva, on one domain, and its five hostnames are already written
 * into `deploy/nginx/charva.conf`, into the certificate and into CLAUDE.md's domain table. A
 * value that never varies but has to be supplied is a value that will one day not be supplied.
 *
 * `VITE_*` still overrides, which is what a staging domain would use, and the localhost ports
 * are the ones in CLAUDE.md's port map — Charva sits off every default because the silkgrain
 * project on the same machine already owns them.
 */
export const SITE_ORIGINS = {
  choice: 'https://charva-travel.com',
  global: 'https://global.charva-travel.com',
  umrah: 'https://umra.charva-travel.com',
  admin: 'https://admin.charva-travel.com',
} as const;

export const DEV_SITE_ORIGINS = {
  choice: 'http://localhost:5180',
  global: 'http://localhost:5181',
  umrah: 'http://localhost:5182',
  admin: 'http://localhost:5183',
} as const;

export type SiteKey = keyof typeof SITE_ORIGINS;

/**
 * The origin of one site, as this bundle should link to it.
 *
 * `prod` is `import.meta.env.PROD` at the call site rather than read here: this module is also
 * imported by the API, which is not a Vite bundle and has no `import.meta.env` to read.
 */
export function siteOrigin(site: SiteKey, prod: boolean, override?: string): string {
  return override ?? (prod ? SITE_ORIGINS[site] : DEV_SITE_ORIGINS[site]);
}
