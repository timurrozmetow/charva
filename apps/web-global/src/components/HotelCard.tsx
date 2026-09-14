import { type HotelCard as HotelCardData, type Lang } from '@charva/contracts';
import { Badge, cardClass, imageSizes, ImageSlot, StarRating } from '@charva/ui';
import { Link } from '@tanstack/react-router';

import { copyFor, fill } from '../i18n';
import { path } from '../lib/routes';

export interface HotelCardProps {
  hotel: HotelCardData;
  lang: Lang;
  priority?: boolean;
}

/** How many amenity chips fit on one card before the row starts wrapping into a wall. */
const CHIPS = 3;

/**
 * One hotel.
 *
 * Different from the tour card in the ways the design makes them different: the pill shows the
 * *city* rather than a tag, and the amenities are a row of chips.
 *
 * `stars` and `category` are separate fields, and this is the card where that matters. The
 * prototype gives the yurt camp a display string of «Юрта» and a filter key of «Кемп», and the
 * boutique «Бутик» for both — two facts about one row that cannot both be true. Here a camp has
 * no stars at all, so there is nothing to contradict.
 *
 * The layout was rebuilt when the price came off. A card is a small argument for clicking it,
 * and this one used to end its argument with «от 96 $»; when the owner removed hotel prices the
 * card simply stopped — three grey chips and then the edge, with nothing saying there was more
 * behind it. What replaced the price is not another number but the two things that actually
 * distinguish one hotel here from another now: what kind of place it is, and what it has. The
 * class sits beside the stars where the price used to be read, the amenity row says how many
 * more there are rather than silently cutting at three, and the card ends on a rule and a
 * «Подробнее →» so that it ends on purpose.
 *
 * `h-full` and `mt-auto`, as on the tour card and for the same reason: hotel summaries came
 * from the operator's own site and are all different lengths, so without them a row of cards
 * is a row of different heights with the chips landing wherever they land.
 */
export function HotelCard({ hotel, lang, priority = false }: HotelCardProps) {
  const copy = copyFor(lang);
  const headingId = `hotel-${String(hotel.id)}`;
  const filters: Record<string, string> = copy.hotelFilters;
  const kind = filters[hotel.filterKey] ?? '';
  const extra = hotel.amenities.length - CHIPS;

  return (
    <article className={cardClass({ interactive: true, className: 'group flex h-full flex-col' })}>
      <Link
        to={path.hotel(lang, hotel.slug)}
        aria-labelledby={headingId}
        className="flex flex-1 flex-col no-underline"
      >
        <div className="relative">
          <ImageSlot
            slotKey={`hotel-cover-${hotel.slug}`}
            brief={hotel.name}
            media={
              hotel.cover === null
                ? null
                : {
                    src: hotel.cover.url,
                    alt: hotel.cover.alt,
                    ...(hotel.cover.lqip === null ? {} : { lqip: hotel.cover.lqip }),
                    ...(hotel.cover.width === null ? {} : { width: hotel.cover.width }),
                    ...(hotel.cover.height === null ? {} : { height: hotel.cover.height }),
                  }
            }
            ratio="4/3"
            priority={priority}
            sizes={imageSizes.cardGrid}
            className="h-[220px] w-full rounded-media"
          />

          {hotel.city !== '' && (
            <Badge variant="scrim" className="absolute left-4 top-4">
              {hotel.city}
            </Badge>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-5">
          {/*
            The class, drawn or written — never both.

            `filterKey` is `5star` for a five-star hotel, and `hotelFilters` renders that as
            «5 ★». Putting it beside the stars would print one fact twice on one line, which is
            the trap D-120 is about and which the first version of this card walked straight
            into. So: stars when there are stars, the word when there are none — which is
            exactly the pair `stars` and `category` exist to express.
          */}
          {hotel.stars !== null ? (
            <StarRating
              value={hotel.stars}
              label={fill(copy.common.stars, { count: hotel.stars })}
            />
          ) : (
            kind !== '' && <span className="text-label font-bold uppercase text-muted">{kind}</span>
          )}

          <h3 id={headingId} className="text-cardTitle font-medium text-ink">
            {hotel.name}
          </h3>

          {hotel.summary !== '' && (
            <p className="line-clamp-2 text-bodySm text-body">{hotel.summary}</p>
          )}

          {hotel.amenities.length > 0 && (
            <ul className="flex list-none flex-wrap gap-2 p-0">
              {hotel.amenities.slice(0, CHIPS).map((amenity) => (
                <li
                  key={amenity.code}
                  className="rounded-full bg-line-soft px-3 py-1.5 text-label font-semibold text-body"
                >
                  {amenity.name}
                </li>
              ))}
              {/* «+4» rather than a silent cut: a hotel with seven amenities and one with three
                  looked identical on the card, which is the opposite of what the row is for. */}
              {extra > 0 && (
                <li className="rounded-full bg-line-soft px-3 py-1.5 text-label font-semibold text-muted">
                  +{extra}
                </li>
              )}
            </ul>
          )}

          {/*
            The floor of the card — a rule and an affordance, where the price used to be.

            No «цена по запросу» in its place: a line whose only content is that there is no
            content earns its space from nobody, and a visitor who wants a figure will ask
            either way. What the row does instead is end the card deliberately.
          */}
          <div className="mt-auto flex items-center justify-end border-t border-line pt-4">
            <span
              aria-hidden="true"
              className="inline-flex items-center gap-1.5 text-bodySm font-semibold text-accent-text transition-[gap] duration-colour group-hover:gap-2.5"
            >
              {copy.common.more} →
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
