import { type Lang } from '@charva/contracts';
import { Container, Eyebrow, Heading, Section } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';

import { creditsQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { QueryState } from '../components/QueryState';
import { copyFor } from '../i18n';
import { useDocumentMeta } from '../lib/useDocumentMeta';

export interface CreditsPageProps {
  lang: Lang;
}

/**
 * Who took the photographs on this site.
 *
 * Not a courtesy. Every image here came from Wikimedia Commons, and the licences they carry —
 * CC BY and CC BY-SA for most of them — require the author to be named wherever the work is
 * published. Until this page existed the site was in breach of that on every screen, which is
 * what decision D-25 had been holding the deploy back over.
 *
 * The list is read from the database rather than written down. A photograph the owner replaces
 * with one of his own drops off this page the moment the row changes, because the query asks for
 * `source = 'stock'` and his own is not that — which is the difference between a credits page
 * that stays true and one that is true on the day it is written.
 */
export function CreditsPage({ lang }: CreditsPageProps) {
  const copy = copyFor(lang);
  const query = useQuery(creditsQuery());

  useDocumentMeta({ route: 'credits', pathAfterLang: '/credits' }, lang);

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.credits.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <Eyebrow>{copy.brand}</Eyebrow>
          <Heading level={1} size="h1" className="mt-4 max-w-[900px]">
            {copy.credits.title}
          </Heading>
          <p className="mt-6 max-w-[640px] text-[17px] font-light leading-[1.68] text-body">
            {copy.credits.lead}
          </p>
        </Container>
      </Section>

      <Section space="sm">
        <Container>
          <QueryState
            lang={lang}
            isPending={query.isPending}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            skeletonCount={8}
            skeletonClassName="h-[44px] rounded-card"
          >
            <ul className="list-none p-0">
              {(query.data?.items ?? []).map((credit) => (
                <li
                  key={credit.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line py-3 text-[15px] last:border-b-0"
                >
                  <span className="font-medium text-ink">{credit.author}</span>
                  <span className="text-muted">{credit.license}</span>
                  {credit.sourceUrl === null ? null : (
                    <a
                      href={credit.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-accent underline"
                    >
                      {copy.credits.source}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </QueryState>
        </Container>
      </Section>
    </>
  );
}
