import { type ChoiceResponse, type Lang } from '@charva/contracts';
import { queryOptions } from '@tanstack/react-query';

import { apiGet } from './client';

/**
 * The chooser's only request.
 *
 * `staleTime` matches the API's own cache window, so a language switch inside a minute re-reads
 * from memory instead of the network, and the page never shows a number older than the sixty
 * seconds the server already allows itself.
 */
export function choiceQuery(lang: Lang) {
  return queryOptions({
    queryKey: ['choice', lang] as const,
    queryFn: ({ signal }) => apiGet<ChoiceResponse>('/choice', lang, signal),
    staleTime: 60_000,
    /**
     * The page renders without this data.
     *
     * Both halves, their headings and their links are interface copy; the request only fills the
     * badge and three of the six figures. A failed or slow request must therefore not block
     * anything — a visitor who came here to click «Global» should never wait for a seat count.
     */
    retry: 1,
  });
}
