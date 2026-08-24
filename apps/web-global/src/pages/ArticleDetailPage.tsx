import { type Lang } from '@charva/contracts';
import {
  Badge,
  buttonClass,
  Container,
  Eyebrow,
  Heading,
  ImageSlot,
  proseSizes,
  Section,
} from '@charva/ui';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { articleQuery } from '../api/queries';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Prose } from '../components/Prose';
import { QueryState } from '../components/QueryState';
import { copyFor, fill } from '../i18n';
import { formatDate } from '../lib/formatDate';
import { isNotFound } from '../lib/isNotFound';
import { path } from '../lib/routes';
import { useDocumentMeta } from '../lib/useDocumentMeta';

import { NotFoundPage } from './NotFoundPage';

export interface ArticleDetailPageProps {
  lang: Lang;
  slug: string;
}

/**
 * One article.
 *
 * The narrowest page on the site — a single column at reading width rather than the catalogue's
 * three. `read_minutes` and `published_at` are a number and a date, so «6 мин чтения» and «14
 * августа 2026» are rendered per language instead of being stored as the Russian rendering of
 * both, which is what the handoff does everywhere it shows a date.
 */
export function ArticleDetailPage({ lang, slug }: ArticleDetailPageProps) {
  const copy = copyFor(lang);
  const query = useQuery(articleQuery(lang, slug));
  const article = query.data;
  const published = formatDate(article?.publishedAt ?? null, lang);

  useDocumentMeta(
    {
      route: 'article',
      pathAfterLang: `/articles/${slug}`,
      ...(article === undefined
        ? {}
        : { content: { name: article.title, summary: article.summary } }),
    },
    lang,
  );

  if (isNotFound(query.error)) return <NotFoundPage lang={lang} />;

  return (
    <>
      <Breadcrumbs
        lang={lang}
        trail={[
          // The journal has no page of its own — the articles live in a section of the
          // homepage — so the crumb points at that section rather than inventing a route.
          { label: copy.article.breadcrumb, href: `${path.home(lang)}#journal` },
          { label: article?.title ?? '…' },
        ]}
      />

      <Section space="sm">
        <Container>
          <QueryState
            lang={lang}
            isPending={query.isPending}
            isError={query.isError}
            onRetry={() => void query.refetch()}
            skeletonCount={1}
            skeletonClassName="h-[560px] rounded-panel"
          >
            {article !== undefined && (
              <article className="mx-auto max-w-[760px]">
                {article.tag !== '' && <Eyebrow>{article.tag}</Eyebrow>}

                <Heading level={1} size="h1" className="mt-4">
                  {article.title}
                </Heading>

                <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-bodySm text-muted">
                  {published !== null && (
                    <time dateTime={article.publishedAt ?? undefined}>
                      {fill(copy.article.publishedOn, { date: published })}
                    </time>
                  )}
                  {published !== null && article.readMinutes !== null && (
                    <span aria-hidden="true">·</span>
                  )}
                  {article.readMinutes !== null && (
                    <span>{fill(copy.common.readMinutes, { count: article.readMinutes })}</span>
                  )}
                </p>

                {article.summary !== '' && (
                  <p className="mt-6 text-lead font-light text-body">{article.summary}</p>
                )}

                {article.cover !== null && (
                  <ImageSlot
                    slotKey={`article-cover-${article.slug}`}
                    brief={article.title}
                    media={{
                      src: article.cover.url,
                      alt: article.cover.alt,
                      ...(article.cover.lqip === null ? {} : { lqip: article.cover.lqip }),
                      ...(article.cover.width === null ? {} : { width: article.cover.width }),
                      ...(article.cover.height === null ? {} : { height: article.cover.height }),
                    }}
                    sizes={proseSizes(760)}
                    ratio="16/9"
                    priority
                    className="mt-10 h-[420px] w-full rounded-panel mob:h-[210px]"
                  />
                )}

                <Prose text={article.body} className="mt-10" />

                <Link
                  to={path.home(lang)}
                  hash="journal"
                  className={buttonClass({ variant: 'outline', className: 'mt-12' })}
                >
                  {copy.article.backToList}
                </Link>
              </article>
            )}
          </QueryState>
        </Container>
      </Section>

      {article !== undefined && article.related.length > 0 && (
        <Section space="md">
          <Container>
            <Heading level={2} size="h2Sm">
              {copy.article.relatedTitle}
            </Heading>
            <ul className="mt-8 grid list-none grid-cols-3 gap-6 p-0 lap:grid-cols-2 mob:grid-cols-1">
              {article.related.map((related) => (
                <li key={related.id}>
                  <Link
                    to={path.article(lang, related.slug)}
                    className="flex h-full flex-col gap-3 rounded-card border border-line bg-surface p-6 no-underline transition-colors duration-colour hover:border-line-strong"
                  >
                    {related.tag !== '' && <Badge variant="tint">{related.tag}</Badge>}
                    <h3 className="text-cardTitle font-medium text-ink">{related.title}</h3>
                    {related.summary !== '' && (
                      <p className="text-bodySm font-light text-body">{related.summary}</p>
                    )}
                    {related.readMinutes !== null && (
                      <p className="mt-auto pt-2 text-bodySm text-muted">
                        {fill(copy.common.readMinutes, { count: related.readMinutes })}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      )}

      <Section space="md" className="pb-section">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-8 rounded-panel border border-line bg-surface p-11 mob:p-6">
            <div className="max-w-[520px]">
              <Heading level={2} size="h2Sm">
                {copy.article.ctaTitle}
              </Heading>
              <p className="mt-3 text-body font-light text-body">{copy.article.ctaText}</p>
            </div>
            <Link to={path.contact(lang)} className={buttonClass()}>
              {copy.article.ctaButton}
            </Link>
          </div>
        </Container>
      </Section>
    </>
  );
}
