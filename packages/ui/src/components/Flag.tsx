import { type ReactElement, type SVGProps } from 'react';

import { cn } from '../cn';

/**
 * Flags for the language switcher.
 *
 * Drawn rather than typed, for the same reason the icons are (D-26) — and here the reason is
 * sharper. The emoji flags `🇷🇺 🇬🇧 🇹🇷 🇹🇲` are regional-indicator pairs, and **Windows has
 * never shipped glyphs for them**: on the machine this project is built on, and on most of the
 * machines it will be read on, they render as the bare letters `RU`, `GB`, `TR`, `TM`. A flag
 * that shows as two letters next to a language code that is already two letters is worse than
 * no flag.
 *
 * Simplified on purpose. At sixteen pixels the Turkmen carpet guls and the Union Jack's exact
 * proportions are a smear either way, so each of these keeps the one thing that identifies the
 * flag at a glance — the tricolour, the crescent, the green field with its stripe — and drops
 * detail it cannot honestly draw. Every flag icon set makes the same trade.
 *
 * A caveat worth writing down: a flag is a country and a language is not. English is drawn as
 * the United Kingdom because that is the convention a visitor expects, not because English
 * belongs there.
 */

export type FlagCode = 'ru' | 'en' | 'tr' | 'tm';

export interface FlagProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  code: FlagCode;
  /** Width in pixels; the height follows the 4:3 the switcher draws. */
  size?: number;
}

export function Flag({ code, size = 20, className, ...rest }: FlagProps) {
  const height = Math.round((size / 4) * 3);

  return (
    <svg
      viewBox="0 0 20 15"
      width={size}
      height={height}
      // Decoration: the language's name is right beside it, in its own language, and a screen
      // reader announcing «flag of the Russian Federation, Русский» says the same thing twice.
      aria-hidden="true"
      focusable="false"
      className={cn('shrink-0 rounded-[2px]', className)}
      {...rest}
    >
      {FLAGS[code]}
      {/*
        A hairline inside the edge.

        Two of these flags are white at the top and the switcher's panel is near-white, so
        without it the Russian flag looks like a blue-and-red rectangle floating in space.
      */}
      <rect
        x="0.25"
        y="0.25"
        width="19.5"
        height="14.5"
        rx="1.75"
        fill="none"
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="0.5"
      />
    </svg>
  );
}

const FLAGS: Record<FlagCode, ReactElement> = {
  /** Three equal bands: white, blue, red. */
  ru: (
    <g>
      <rect width="20" height="15" rx="2" fill="#FFFFFF" />
      <path d="M0 5h20v5H0z" fill="#0039A6" />
      <path d="M0 10h20v3a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-3z" fill="#D52B1E" />
    </g>
  ),

  /**
   * The Union Jack, at the only fidelity sixteen pixels allows.
   *
   * The white fimbriations around the red saltire are what make it readable as itself rather
   * than as a red cross on blue, so they are kept even though they are half a pixel wide.
   */
  en: (
    <g>
      <rect width="20" height="15" rx="2" fill="#012169" />
      <path d="M0 0l20 15M20 0L0 15" stroke="#FFFFFF" strokeWidth="3" />
      <path d="M0 0l20 15M20 0L0 15" stroke="#C8102E" strokeWidth="1.6" />
      <path d="M10 0v15M0 7.5h20" stroke="#FFFFFF" strokeWidth="5" />
      <path d="M10 0v15M0 7.5h20" stroke="#C8102E" strokeWidth="3" />
    </g>
  ),

  /** Red field, white crescent and star. */
  tr: (
    <g>
      <rect width="20" height="15" rx="2" fill="#E30A17" />
      <circle cx="8" cy="7.5" r="3.4" fill="#FFFFFF" />
      <circle cx="9.2" cy="7.5" r="2.7" fill="#E30A17" />
      <path d="M12.6 7.5l2.6-.85-1.6 2.2v-2.7l1.6 2.2-2.6-.85z" fill="#FFFFFF" />
    </g>
  ),

  /**
   * Green field, crescent and five stars, and the carpet stripe as a stripe.
   *
   * The five guls of the real flag are among the most intricate emblems on any national flag —
   * five distinct carpet patterns, one per tribe. Drawing an approximation of them at this size
   * would produce five smudges and misrepresent them; the stripe is drawn as the field it is,
   * with the five divisions marked.
   */
  tm: (
    <g>
      <rect width="20" height="15" rx="2" fill="#28AE66" />
      <path d="M2.6 0h3.2v15H2.6z" fill="#B7472A" />
      <g fill="#FFFFFF" opacity="0.9">
        <rect x="3.3" y="1.2" width="1.8" height="2.1" rx="0.4" />
        <rect x="3.3" y="3.9" width="1.8" height="2.1" rx="0.4" />
        <rect x="3.3" y="6.6" width="1.8" height="2.1" rx="0.4" />
        <rect x="3.3" y="9.3" width="1.8" height="2.1" rx="0.4" />
        <rect x="3.3" y="12" width="1.8" height="2.1" rx="0.4" />
      </g>
      <circle cx="10.8" cy="5.4" r="2.5" fill="#FFFFFF" />
      <circle cx="11.9" cy="5.4" r="2.1" fill="#28AE66" />
      <g fill="#FFFFFF">
        <circle cx="14.4" cy="3" r="0.5" />
        <circle cx="15.8" cy="4.3" r="0.5" />
        <circle cx="16.2" cy="6.1" r="0.5" />
        <circle cx="15.3" cy="7.6" r="0.5" />
        <circle cx="13.8" cy="8.2" r="0.5" />
      </g>
    </g>
  ),
};
