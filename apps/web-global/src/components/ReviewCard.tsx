import { type Lang, type Review } from '@charva/contracts';
import { Eyebrow, ImageSlot, StarRating } from '@charva/ui';

import { copyFor, fill } from '../i18n';

export interface ReviewCardProps {
  review: Review;
  lang: Lang;
}

/**
 * One review, on the reviews page and on the homepage.
 *
 * Written once for the same reason the tour card is: in the handoff these are two copies that
 * have already diverged. The homepage's has no date and no tour title — the fields simply are
 * not in its data — and its stars are the literal string `★★★★★` typed into the markup, so
 * every review on the homepage is five stars regardless of what was left.
 */
export function ReviewCard({ review, lang }: ReviewCardProps) {
  const copy = copyFor(lang);

  return (
    <article className="flex h-full flex-col gap-[18px] rounded-card border border-line bg-surface p-8">
      <div className="flex items-center justify-between gap-4">
        <StarRating
          value={review.rating}
          label={fill(copy.common.stars, { count: review.rating })}
        />
        {/* A real date, formatted for the reader. The prototype stores «Май 2026» as a string,
            which is precisely why its «Сначала новые» filter cannot sort anything. */}
        {review.visitedOn !== null && (
          <time dateTime={review.visitedOn} className="text-bodySm text-muted">
            {formatMonth(review.visitedOn, lang)}
          </time>
        )}
      </div>

      {review.tourTitle !== '' && <Eyebrow>{review.tourTitle}</Eyebrow>}

      <p className="flex-1 text-body font-light text-body">{review.body}</p>

      <div className="flex items-center gap-3 border-t border-line pt-5">
        <ImageSlot
          slotKey={`review-avatar-${String(review.id)}`}
          brief={review.authorName}
          media={review.avatar === null ? null : { src: review.avatar.url, alt: review.avatar.alt }}
          className="size-11 shrink-0 overflow-hidden rounded-full"
        />
        <div>
          <p className="text-body font-semibold text-ink">{review.authorName}</p>
          {review.authorCity !== '' && <p className="text-label text-muted">{review.authorCity}</p>}
        </div>
      </div>
    </article>
  );
}

/**
 * «2026-05-01» → «Май 2026».
 *
 * The day is always the first — only the month is ever shown, and inventing a day would be
 * inventing a fact — so the rendering drops it. `Intl.DateTimeFormat` rather than a table of
 * month names per language: the names, the capitalisation and the order all differ, and the
 * browser already knows all three.
 */
function formatMonth(iso: string, lang: Lang): string {
  const date = new Date(`${iso}T00:00:00Z`);
  const text = new Intl.DateTimeFormat(lang, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}
