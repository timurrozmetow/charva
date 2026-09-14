import { type Lang } from '@charva/contracts';
import { useParams } from '@tanstack/react-router';

import { isUmrahLang } from './lang';

/**
 * The two path parameters every page needs, read loosely.
 *
 * These used to live in `router.tsx` beside the route definitions, which was the right place
 * while the route components lived there too. They moved when the routes became lazy: a page
 * module that imports its language from the router would import the router into its own chunk,
 * and the router imports every page — so each chunk would contain the whole application and the
 * split would silently undo itself. Nothing here imports anything the shell does not already
 * have.
 *
 * Turkmen is the fallback, not Russian: it is this site's default language (`SITE_LANGS`), and
 * the same function on Global falls back to Russian for the same reason.
 */
export function useLang(): Lang {
  const { lang }: { lang?: string } = useParams({ strict: false });
  return lang !== undefined && isUmrahLang(lang) ? lang : 'tm';
}

/** The `$slug` of whichever detail route is mounted. */
export function useSlug(): string {
  const { slug }: { slug?: string } = useParams({ strict: false });
  return slug ?? '';
}
