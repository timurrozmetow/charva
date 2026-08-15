import { type AdminResourceMeta } from '@charva/contracts';
import { useQuery } from '@tanstack/react-query';

import { resourcesQuery } from '../api/queries';

/**
 * The description of one table, from the list the API serves.
 *
 * `null` while it is still loading or when the name in the URL is not a resource — the caller
 * distinguishes those by asking the query itself, which it already has.
 */
export function useResource(name: string): AdminResourceMeta | null {
  const { data } = useQuery(resourcesQuery());
  return data?.resources.find((resource) => resource.name === name) ?? null;
}
