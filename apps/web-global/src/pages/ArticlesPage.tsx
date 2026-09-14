import { type Lang } from '@charva/contracts';
import { Button, Container, Eyebrow, Heading, Section } from '@charva/ui';
import { useQuery } from '@tanstack/react-query';

import { articlesQuery } from '../api/queries';
import { ArticleCard } from '../components/ArticleCard';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { QueryState } from '../components/QueryState';
import { copyFor, fill } from '../i18n';
import { cardGridClass } from '../lib/cardGrid';
import { useLang } from '../lib/routeParams';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { useListSearch } from '../lib/useListSearch';

export interface ArticlesPageProps {
  lang: Lang;
}

const PER_PAGE = 9;

/**
 * The journal.
 *
 * A section the design never drew, added because its absence was a hole rather than a choice:
 * the two articles that existed were reachable from the homepage and from nowhere else, so an
 * article was a page nobody could navigate to and a crawler met once. Everything a visitor asks
 * before coming here — how the visa works, when to travel, whether Darvaza is worth the night —
 * is a search somebody makes months before they ever type the name of a tour operator, and a
 * catalogue page cannot answer any of it.
 *
 * No filter chips. Four tags over ten articles is a control that hides things without helping
 * anybody find them; the list is short enough to read, and «Показать ещё» grows the page rather
 * than paging it, for the same reason as everywhere else (D-61).
 */
export function ArticlesPage({ lang }: ArticlesPageProps) {
  const copy = copyFor(lang);
  const { page, nextPage } = useListSearch(path.articles(lang));

  const query = useQuery(articlesQuery(lang, { perPage: page * PER_PAGE }));
  const items = query.data?.items ?? [];
  const total = query.data?.meta.total ?? 0;

  useDocumentMeta({ route: 'articles', pathAfterLang: '/articles' }, lang);

  return (
    <>
      <Breadcrumbs lang={lang} trail={[{ label: copy.article.breadcrumb }]} />

      <Section space="sm">
        <Container>
          <Eyebrow>{copy.brand}</Eyebrow>
          <Heading level={1} size="h1" className="mt-4">
            {copy.article.title}
          </Heading>
          <p className="mt-6 max-w-[640px] text-lead font-light text-body">{copy.article.lead}</p>
        </Container>
      </Section>

      <Section space="sm">
        <Container>
          <QueryState
            lang={lang}
            isPending={query.isPending}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            skeletonCount={6}
            skeletonClassName="h-[380px] rounded-card"
          >
            {total === 0 ? (
              <div className="rounded-panel border border-line bg-surface p-11 text-center mob:p-6">
                <Heading level={2} size="h3">
                  {copy.common.sectionEmpty}
                </Heading>
                <p className="mt-3 text-body font-light text-body">
                  {copy.common.sectionEmptyHint}
                </p>
              </div>
            ) : (
              <>
                <p className="text-bodySm text-muted">
                  {fill(copy.common.shown, { shown: items.length, total })}
                </p>

                <ul className={`mt-6 ${cardGridClass(items.length)}`}>
                  {items.map((article) => (
                    <li key={article.id}>
                      <ArticleCard article={article} lang={lang} />
                    </li>
                  ))}
                </ul>

                {(query.data?.meta.hasMore ?? false) && (
                  <div className="mt-10 flex justify-center">
                    <Button
                      variant="outline"
                      onClick={nextPage}
                      {...(query.isFetching ? { disabled: true } : {})}
                    >
                      {copy.common.showMore}
                    </Button>
                  </div>
                )}
              </>
            )}
          </QueryState>
        </Container>
      </Section>
    </>
  );
}

/**
 * What the router mounts, and the reason it lives here rather than beside the route.
 *
 * A named function and not an inline arrow: the hooks below sit in a function React lint
 * rules would not recognise as a component if it were anonymous, and the same anonymity is
 * what would let a hook end up behind a condition without anything noticing.
 *
 * It is in this file because the route is lazy, and the chunk boundary is this module: the
 * router imports only the name, so nothing below is downloaded until the page is asked for.
 */
export function ArticlesRoute() {
  return <ArticlesPage lang={useLang()} />;
}
