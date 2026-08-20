import { type HotelDetail, type Lang } from '@charva/contracts';
import { cn, Icon, ImageSlot, Lightbox } from '@charva/ui';
import { useState } from 'react';

import { copyFor, fill, plural } from '../i18n';

export interface HotelShowcaseProps {
  hotel: HotelDetail;
  lang: Lang;
}

interface Shot {
  src: string;
  alt: string;
  caption: string;
}

/**
 * One large photograph, a strip of thumbnails under it, and the lightbox behind both.
 *
 * The page used to show the cover alone at 480 pixels tall. A hotel is chosen by looking at it:
 * a visitor wants the room, the bathroom, the breakfast and the view, and wants them one after
 * another without scrolling back and forth between a hero at the top and a grid at the bottom.
 * So the gallery leads the page, and the grid further down becomes the overflow rather than the
 * only place the photographs live.
 *
 * The cover is the first thumbnail rather than something separate: it is the hotel's best
 * photograph, which is what a first frame is for, and treating it as a different kind of thing
 * is what made the page show it twice.
 */
export function HotelShowcase({ hotel, lang }: HotelShowcaseProps) {
  const copy = copyFor(lang);
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState<number | null>(null);

  const shots: Shot[] = [
    ...(hotel.cover === null
      ? []
      : [{ src: hotel.cover.url, alt: hotel.cover.alt, caption: hotel.name }]),
    ...hotel.gallery.map((shot) => ({
      src: shot.media.url,
      alt: shot.media.alt,
      caption: shot.caption,
    })),
  ];

  // Nothing uploaded yet: the branded placeholder carries the brief, which is what makes the
  // page presentable before question Q-1 is answered (decision D-21).
  if (shots.length === 0) {
    return (
      <ImageSlot
        slotKey={`hotel-cover-${hotel.slug}`}
        brief={hotel.name}
        media={null}
        ratio="16/9"
        priority
        className="h-[480px] w-full rounded-panel lap:h-[360px] mob:h-[220px]"
      />
    );
  }

  const current = shots[Math.min(active, shots.length - 1)];

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setZoomed(active);
        }}
        className="block w-full overflow-hidden rounded-panel"
        // The gallery page's strings, not a second set: one photograph viewer, one vocabulary.
        aria-label={copy.gallery.openPhoto}
      >
        <img
          src={current?.src ?? ''}
          alt={current?.alt ?? ''}
          // The first photograph of a hotel page is its largest element and its LCP, so it is
          // never lazy and never waits behind the thumbnails.
          //
          // Lowercase and spread: React 18 does not know the camel-cased prop, warns, and drops
          // the attribute — so the spelling that looks right is the one that does nothing (D-94).
          {...({ fetchpriority: 'high' } as Record<string, string>)}
          className="h-[520px] w-full object-cover lap:h-[400px] mob:h-[240px]"
        />
      </button>

      {shots.length > 1 && (
        <ul className="mt-3 flex list-none gap-3 overflow-x-auto p-0 pb-1">
          {shots.map((shot, index) => (
            <li key={shot.src} className="shrink-0">
              <button
                type="button"
                aria-current={index === active ? 'true' : undefined}
                onClick={() => {
                  setActive(index);
                }}
                className={cn(
                  'block overflow-hidden rounded-media border-2 transition-colors duration-colour',
                  index === active
                    ? 'border-accent'
                    : 'border-transparent hover:border-line-strong',
                )}
              >
                <img
                  src={shot.src}
                  alt={shot.alt}
                  loading="lazy"
                  className="h-[74px] w-[104px] object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Lightbox
        items={shots.map((shot, index) => ({
          id: String(index),
          src: shot.src,
          alt: shot.alt,
          caption: shot.caption,
        }))}
        index={zoomed}
        onIndexChange={setZoomed}
        onClose={() => {
          setZoomed(null);
        }}
        labels={{
          close: copy.gallery.lightbox.close,
          previous: copy.gallery.lightbox.previous,
          next: copy.gallery.lightbox.next,
          counter: (position, total) =>
            fill(copy.gallery.lightbox.counter, { current: position, total }),
        }}
      />
    </div>
  );
}

export interface HotelFactsProps {
  hotel: HotelDetail;
  lang: Lang;
}

/**
 * The row of icons under the name — what the hotel is, in six glances.
 *
 * Every one of them is a column that was already on the page as a word in a table, and a table
 * is what a visitor reads last. Only the facts that exist are drawn: a camp has no star rating
 * and a hotel nobody has given a check-in time simply shows five.
 */
export function HotelFacts({ hotel, lang }: HotelFactsProps) {
  const copy = copyFor(lang);

  const sleeps = hotel.rooms.reduce((most, room) => Math.max(most, room.capacity), 0);
  const largest = hotel.rooms.reduce((most, room) => Math.max(most, room.sizeSqm ?? 0), 0);

  /*
   * Each fact once, and only the ones the row actually holds.
   *
   * The first version put the class here as well as in the line above the photographs and in
   * the stars beside it, so a five-star hotel said «5 ★» three times in four centimetres. A
   * fact repeated is a fact the reader stops trusting the layout about.
   */
  const facts: { icon: 'bed' | 'guest' | 'area' | 'clock' | 'star'; label: string }[] = [
    ...(hotel.rooms.length === 0
      ? []
      : [{ icon: 'bed' as const, label: plural(copy.common.roomKinds, hotel.rooms.length, lang) }]),
    ...(sleeps === 0
      ? []
      : [{ icon: 'guest' as const, label: plural(copy.common.guests, sleeps, lang) }]),
    ...(largest === 0
      ? []
      : [{ icon: 'area' as const, label: `${copy.common.upToSize} ${String(largest)} м²` }]),
    ...(hotel.checkIn === null
      ? []
      : [{ icon: 'clock' as const, label: `${copy.hotel.facts.checkIn} ${hotel.checkIn}` }]),
    ...(hotel.checkOut === null
      ? []
      : [{ icon: 'clock' as const, label: `${copy.hotel.facts.checkOut} ${hotel.checkOut}` }]),
  ];

  if (facts.length === 0) return null;

  return (
    <ul className="m-0 grid list-none grid-cols-5 gap-6 p-0 lap:grid-cols-3 mob:grid-cols-2">
      {facts.map((fact) => (
        <li key={fact.label} className="flex flex-col items-center gap-2 text-center">
          <Icon name={fact.icon} size={26} className="text-accent-text" />
          <span className="text-bodySm font-light text-body">{fact.label}</span>
        </li>
      ))}
    </ul>
  );
}

export interface HotelEquipmentProps {
  hotel: HotelDetail;
  lang: Lang;
}

/**
 * «Оснащение» — the amenities as a checklist rather than a paragraph of commas.
 *
 * Two columns with a tick against each, because that is how somebody comparing two hotels reads
 * it: down one column looking for the thing they need, not along a sentence.
 */
export function HotelEquipment({ hotel, lang }: HotelEquipmentProps) {
  const copy = copyFor(lang);
  if (hotel.amenities.length === 0) return null;

  return (
    <div className="grid grid-cols-[200px_1fr] gap-10 border-t border-line py-11 tab:grid-cols-1 tab:gap-5">
      <h2 className="m-0 text-body font-medium text-ink">{copy.hotel.amenitiesTitle}</h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-x-10 gap-y-3 p-0 mob:grid-cols-1">
        {hotel.amenities.map((amenity) => (
          <li key={amenity.code} className="flex items-start gap-3">
            <Icon name="check" size={16} className="mt-1 shrink-0 text-accent" />
            <span className="text-bodySm font-light text-body">{amenity.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
