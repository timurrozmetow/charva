import { type HTMLAttributes } from 'react';

import { cn } from '../cn';

import { type BlockTag } from './Container';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<CardPadding, string> = {
  /** A media card: the photograph runs to the edge and the text block pads itself. */
  none: '',
  sm: 'p-6',
  /** Panels: the contact card, the summary card. */
  md: 'p-11 tab:p-8 mob:p-6',
  /** Large CTA blocks. */
  lg: 'p-[52px] tab:p-10 mob:p-6',
};

export interface CardStyleProps {
  padding?: CardPadding | undefined;
  /**
   * Lift and shadow on hover.
   *
   * Only for a card that is itself a link or a button. A card that lifts under the cursor and
   * does nothing when clicked is a promise the page does not keep.
   */
  interactive?: boolean | undefined;
  className?: string | undefined;
}

/**
 * The class list on its own, for the many cards that are a router `<Link>`.
 *
 * The radius, the hairline opacity, the lift and the shadow all come from the theme: 22px and
 * -6px and a -26px spread on Global against 24px and -5px and -28px on Umrah. Those look like
 * noise, they are in the design, and written as literals they would not survive the first
 * tidying commit.
 */
export function cardClass({
  padding = 'none',
  interactive = false,
  className,
}: CardStyleProps = {}): string {
  return cn(
    'overflow-hidden rounded-card border border-line bg-surface',
    PADDING[padding],
    interactive && [
      /*
       * Two durations on one transition, in the order the properties are listed: the transform
       * answers in 160ms, the shadow follows over 320.
       *
       * They are different events. The transform now carries two things — the hover lift and,
       * new here, the press — and a press is a direct answer to a finger, so it has to be the
       * fast one; a card that takes a third of a second to admit it was tapped reads as a card
       * that was not tapped. The shadow is the slower half of the same gesture and looks wrong
       * hurried. The design's 320ms is still the lift's number, and the shadow keeps it.
       */
      'transition-[transform,box-shadow] [transition-duration:160ms,320ms] ease-lift',
      'hover:translate-y-lift hover:shadow-card',
      // Slighter than a button's 0.97: this is a much larger object, and the same ratio on a
      // 436px card is a shove rather than an acknowledgement.
      'active:scale-[0.985]',
      // The lift is decoration; under reduced motion the shadow alone carries the state.
      'motion-reduce:hover:translate-y-0',
    ],
    className,
  );
}

export interface CardProps extends HTMLAttributes<HTMLElement>, CardStyleProps {
  as?: BlockTag;
}

export function Card({ as: Tag = 'div', padding, interactive, className, ...rest }: CardProps) {
  return <Tag className={cardClass({ padding, interactive, className })} {...rest} />;
}
