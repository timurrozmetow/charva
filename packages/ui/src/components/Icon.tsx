import { type SVGProps } from 'react';

import { cn } from '../cn';

/**
 * The icon set.
 *
 * Deliberately tiny and hand-drawn rather than a dependency. Every one of these replaces a
 * literal character the prototypes typed into the markup — `★ ☆ ✓ ✦ ▾ ▶` — none of which
 * exists in Stolzl. In a browser they silently fall back to whatever the operating system
 * supplies, so the rating stars on the reviews page look like Segoe on Windows, Apple Color
 * Emoji on macOS and Noto on Android. Drawing them makes them ours. Decision D-26.
 *
 * `globe` is already an SVG in the prototypes and is copied from there.
 *
 * The arrows the design uses — `→ ← ·` — *are* in the font, so they stay as text.
 */

const paths = {
  /** Rating star, filled. */
  star: 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.4 6.2 20.5l1.1-6.5L2.6 9.4l6.5-.9L12 2.6z',
  /** The dropdown tick next to the active language. */
  check: 'M4.5 12.5l5 5 10-11',
  /** The four-pointed bullet in the Umrah package composition. */
  diamond: 'M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z',
  /** The caret on the language switcher. */
  caretDown: 'M5 8.5l7 7 7-7',
  /** The play triangle on video cards and the video hero. */
  play: 'M8 5.2v13.6L19 12 8 5.2z',
  /**
   * The pause bars on the carousel's stop control.
   *
   * Not in the design, because the design has no way to stop either auto-rotating slider.
   * WCAG 2.2.2 requires one for anything that starts moving on its own and runs longer than
   * five seconds, and both of these run indefinitely.
   */
  pause: 'M8 5h3v14H8V5zm5 0h3v14h-3V5z',

  /*
   * The hotel fact row: what the room sleeps, how big it is, when you may arrive.
   *
   * Drawn here for the same reason as everything above — the alternative is a dependency
   * shipping six hundred glyphs to show five (decision D-26). All five are stroked, so they
   * take the weight of the text beside them rather than sitting as black blobs in a line of
   * light grey.
   */
  /** A bed, seen from the side. «1 двуспальная кровать». */
  bed: 'M3 7v11M3 12h18v6M21 18v-5a3 3 0 0 0-3-3h-7v5M7.5 10.5h.01',
  /** A person. The guest count. */
  guest: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  /** Three arcs and a dot. Wi-Fi, and by extension anything the hotel simply has. */
  wifi: 'M2.5 9a15 15 0 0 1 19 0M5.5 12.5a10 10 0 0 1 13 0M8.5 16a5.5 5.5 0 0 1 7 0M12 19.5h.01',
  /** A square with corner ticks: floor area in square metres. */
  area: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4',
  /** A clock face. Check-in and check-out. */
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2',
} as const;

export type IconName = keyof typeof paths | 'starHalf' | 'globe';

type Stroked = Extract<
  IconName,
  'check' | 'caretDown' | 'bed' | 'guest' | 'wifi' | 'area' | 'clock'
>;
const STROKED = new Set<string>([
  'check',
  'caretDown',
  'bed',
  'guest',
  'wifi',
  'area',
  'clock',
] satisfies Stroked[]);

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  name: IconName;
  /** Size in px. Defaults to 1em so an icon tracks the text it sits in. */
  size?: number | string;
  /**
   * Accessible name. Omit it for decoration — the icon is then hidden from assistive
   * technology, which is right for a caret next to a visible label and wrong for a lone
   * play button.
   */
  label?: string;
}

export function Icon({ name, size = '1em', label, className, ...rest }: IconProps) {
  const stroked = STROKED.has(name);

  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className: cn('inline-block shrink-0', className),
    ...(label ? { role: 'img' as const, 'aria-label': label } : { 'aria-hidden': true }),
    ...rest,
  };

  if (name === 'starHalf') {
    // Half a star for a 4.5 rating: the same outline, clipped down the middle.
    return (
      <svg {...common} fill="none">
        <defs>
          <clipPath id="charva-star-half">
            <rect x="0" y="0" width="12" height="24" />
          </clipPath>
        </defs>
        <path d={paths.star} fill="currentColor" clipPath="url(#charva-star-half)" />
        <path
          d={paths.star}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
          opacity="0.45"
        />
      </svg>
    );
  }

  if (name === 'globe') {
    // Copied from the prototypes' language switcher: a circle plus two meridians.
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" strokeLinecap="round" />
        <path d="M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
      </svg>
    );
  }

  return (
    <svg
      {...common}
      fill={stroked ? 'none' : 'currentColor'}
      {...(stroked
        ? {
            stroke: 'currentColor',
            strokeWidth: 2,
            strokeLinecap: 'round' as const,
            strokeLinejoin: 'round' as const,
          }
        : {})}
    >
      <path d={paths[name]} />
    </svg>
  );
}
