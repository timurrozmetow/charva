import { type ArticleCard as ArticleCardData, type Lang } from '@charva/contracts';
import { imageSizes, ImageSlot } from '@charva/ui';
import { Link } from '@tanstack/react-router';

import { copyFor, fill } from '../i18n';
import { path } from '../lib/routes';

export interface ArticleCardProps {
  article: ArticleCardData;
  lang: Lang;
  /** The lead card on the homepage is taller and sits in a wider column. */
  size?: 'lead' | 'grid';
}

/**
 * One article, as a card.
 *
 * Extracted the day the journal got a page of its own: the same card is now the lead on the
 * homepage and every tile on `/articles`, and two copies of it would be two places to fix the
 * day a tag or a reading time changes shape. The only difference between the two uses is how
 * tall the photograph is, which is a prop rather than a class from the caller — a `className`
 * carrying `h-…` would sit beside the one here and be settled by stylesheet order (D-90).
 */
export function ArticleCard({ article, lang, size = 'grid' }: ArticleCardProps) {
  const copy = copyFor(lang);
  const hasTag = article.tag !== '';
  const hasMinutes = article.readMinutes !== null;

  return (
    <Link
      to={path.article(lang, article.slug)}
      className="group flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface no-underline transition-colors duration-colour hover:border-line-strong"
    >
      <ImageSlot
        slotKey={`article-cover-${article.slug}`}
        brief={article.title}
        media={article.cover === null ? null : { src: article.cover.url, alt: article.cover.alt }}
        sizes={size === 'lead' ? imageSizes.halfPanel : imageSizes.cardGrid}
        ratio="16/9"
        className={size === 'lead' ? 'h-[320px] w-full' : 'h-[220px] w-full'}
      />
      <div className="flex flex-1 flex-col gap-3 p-8 mob:p-6">
        {(hasTag || hasMinutes) && (
          <p className="flex flex-wrap items-center gap-3 text-label font-bold uppercase text-accent-text">
            {hasTag && <span>{article.tag}</span>}
            {hasTag && hasMinutes && <span aria-hidden="true">·</span>}
            {hasMinutes && (
              <span>{fill(copy.common.readMinutes, { count: article.readMinutes ?? 0 })}</span>
            )}
          </p>
        )}
        <h3
          className={
            size === 'lead' ? 'text-h3 font-medium text-ink' : 'text-cardTitle font-medium text-ink'
          }
        >
          {article.title}
        </h3>
        {article.summary !== '' && (
          <p className="text-body font-light text-body mob:text-bodySm">{article.summary}</p>
        )}
      </div>
    </Link>
  );
}
