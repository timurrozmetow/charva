import { formatMoney, type Lang, type TourCard as TourCardData } from '@charva/contracts';
import { Badge, cardClass, ImageSlot, StarRating } from '@charva/ui';
import { Link } from '@tanstack/react-router';

import { copyFor, fill, plural } from '../i18n';
import { path } from '../lib/routes';

export interface TourCardProps {
  tour: TourCardData;
  lang: Lang;
  /** Above the fold on the homepage: loads eagerly and skips the fade. */
  priority?: boolean;
}

/**
 * One tour, on any page that lists them.
 *
 * Written once because it appears three times — the homepage, the catalogue and the «похожие»
 * row on a detail page — and in the prototypes those are three copies of the same markup with
 * slightly different fields. The homepage's copy has no `cat`, so the same card cannot be
 * filtered there; that divergence is what a shared component prevents.
 *
 * The whole card is one link, named by its heading. The prototype makes every card an
 * `<a href="#">` around a `<div>` tree with no accessible name at all.
 */
export function TourCard({ tour, lang, priority = false }: TourCardProps) {
  const copy = copyFor(lang);
  const headingId = `tour-${String(tour.id)}`;

  return (
    <article className={cardClass({ interactive: true })}>
      <Link
        to={path.tour(lang, tour.slug)}
        aria-labelledby={headingId}
        className="block no-underline"
      >
        <div className="relative">
          <ImageSlot
            slotKey={`tour-cover-${tour.slug}`}
            brief={tour.title}
            media={
              tour.cover === null
                ? null
                : {
                    src: tour.cover.url,
                    alt: tour.cover.alt,
                    ...(tour.cover.lqip === null ? {} : { lqip: tour.cover.lqip }),
                    ...(tour.cover.width === null ? {} : { width: tour.cover.width }),
                    ...(tour.cover.height === null ? {} : { height: tour.cover.height }),
                  }
            }
            ratio="4/3"
            priority={priority}
            className="h-[240px] w-full rounded-media"
          />

          {/* The pill over the cover. `tag` and `category` are different fields — tour 2 is
              tagged «Пустыня» and categorised «Природа» — so the pill is never the filter. */}
          {tour.tag !== '' && (
            <Badge variant="tint" className="absolute left-4 top-4">
              {tour.tag}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-3 px-5 pb-6 pt-5">
          <h3 id={headingId} className="text-cardTitle font-medium text-ink">
            {tour.title}
          </h3>

          {tour.summary !== '' && <p className="text-bodySm text-body">{tour.summary}</p>}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-bodySm text-muted">
            <span>{plural(copy.common.days, tour.days, lang)}</span>
            <span aria-hidden="true">·</span>
            <span>{plural(copy.common.cities, tour.cities, lang)}</span>
            {tour.hotelStars !== null && (
              <>
                <span aria-hidden="true">·</span>
                {/* Drawn as icons, not typed: Stolzl has no `★`, so the prototype's literal
                    character falls back to a system font and looks different per platform. */}
                <StarRating
                  value={tour.hotelStars}
                  label={fill(copy.common.stars, { count: tour.hotelStars })}
                />
              </>
            )}
          </div>

          <p className="mt-1 text-bodySm text-muted">
            {copy.common.from}{' '}
            <span className="text-h3 font-medium text-ink">{formatMoney(tour.priceFrom)}</span>
          </p>
        </div>
      </Link>
    </article>
  );
}
