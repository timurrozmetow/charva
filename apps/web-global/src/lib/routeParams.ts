import { type Lang } from '@charva/contracts';
import { useParams } from '@tanstack/react-router';

import { isGlobalLang } from './lang';

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
 * `strict: false` because three routes share one shape and typing each component against its own
 * route id would be three casts to say one thing. An empty slug is unreachable: the router only
 * mounts a detail component when the segment exists.
 */
export function useLang(): Lang {
  const { lang }: { lang?: string } = useParams({ strict: false });
  return lang !== undefined && isGlobalLang(lang) ? lang : 'ru';
}

/** The `$slug` of whichever detail route is mounted. */
export function useSlug(): string {
  const { slug }: { slug?: string } = useParams({ strict: false });
  return slug ?? '';
}
