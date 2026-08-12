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
} as const;

export type IconName = keyof typeof paths | 'starHalf' | 'globe';

type Stroked = Extract<IconName, 'check' | 'caretDown'>;
const STROKED = new Set<string>(['check', 'caretDown'] satisfies Stroked[]);

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
