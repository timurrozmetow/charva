import { formatMoney, type Lang, type TourCard as TourCardData } from '@charva/contracts';
import { Badge, cardClass, Icon, imageSizes, ImageSlot, StarRating } from '@charva/ui';
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
 *
 * Three things about the layout, each of which was wrong before and is the sort of wrong that
 * only shows up in a grid of several cards rather than in one:
 *
 * **The card fills its cell and the price sits on the floor of it.** Summaries are different
 * lengths, so cards used to be different heights and the price landed at a different level in
 * every one — a row of cards that do not line up reads as carelessness before anybody works out
 * why. `h-full` plus `mt-auto` puts every price on the same line across the row.
 *
 * **The summary is clamped to two lines.** Same reason, from the other end: one tour with a long
 * description should not make its neighbours short.
 *
 * **The facts carry icons.** «8 дней · 5 городов · ★★★★» was one grey run of text at the same
 * weight as the sentence above it, so the two things a person actually compares between tours
 * were the least scannable part of the card.
 */
export function TourCard({ tour, lang, priority = false }: TourCardProps) {
  const copy = copyFor(lang);
  const headingId = `tour-${String(tour.id)}`;

  return (
    <article className={cardClass({ interactive: true, className: 'group flex h-full flex-col' })}>
      <Link
        to={path.tour(lang, tour.slug)}
        aria-labelledby={headingId}
        className="flex flex-1 flex-col no-underline"
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
            sizes={imageSizes.cardGrid}
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

        <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-5">
          <h3 id={headingId} className="text-cardTitle font-medium text-ink">
            {tour.title}
          </h3>

          {tour.summary !== '' && (
            <p className="line-clamp-2 text-bodySm text-body">{tour.summary}</p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-bodySm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" size={15} className="text-accent-text" />
              {plural(copy.common.days, tour.days, lang)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Icon name="pin" size={15} className="text-accent-text" />
              {plural(copy.common.cities, tour.cities, lang)}
            </span>
            {tour.hotelStars !== null && (
              /* Drawn as icons, not typed: Stolzl has no `★`, so the prototype's literal
                 character falls back to a system font and looks different per platform. */
              <StarRating
                value={tour.hotelStars}
                label={fill(copy.common.stars, { count: tour.hotelStars })}
              />
            )}
          </div>

          {/*
            The floor of the card.

            `mt-auto` rather than a fixed height: the rule is «whatever is above, this row is at
            the bottom», which holds for a card with no summary and for one with two lines of it.
            The rule above it is what makes the row read as a footer rather than as one more
            line of the body.
          */}
          <div className="mt-auto flex items-end justify-between gap-4 border-t border-line pt-4">
            <p className="text-bodySm text-muted">
              {copy.common.from}{' '}
              <span className="block text-h3 font-medium text-ink">
                {formatMoney(tour.priceFrom)}
              </span>
            </p>
            {/*
              An affordance, not a control. The whole card is already the link — a second one
              here would be a nested interactive element and a second tab stop for the same
              destination — so this is a `<span>` that moves on hover with the rest of the card.
            */}
            <span
              aria-hidden="true"
              className="inline-flex items-center gap-1.5 pb-1 text-bodySm font-semibold text-accent-text transition-[gap] duration-colour group-hover:gap-2.5"
            >
              {copy.common.more} →
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
