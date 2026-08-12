/**
 * WCAG relative luminance and contrast.
 *
 * Small enough to own rather than depend on, and `tokens.test.ts` uses it to enforce the
 * contrast contract on every build. Formulae are WCAG 2.1 §1.4.3.
 */

export type Hex = `#${string}`;

/** sRGB channel to linear light. */
function channelToLinear(value: number): number {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function hexToRgb(hex: Hex): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function relativeLuminance(hex: Hex): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** Contrast ratio between two opaque colours, 1 to 21. Order does not matter. */
export function contrastRatio(a: Hex, b: Hex): number {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (lighter + 0.05) / (darker + 0.05);
}

/** Two hex digits, lowercase-free, for `blendOver`. */
function toHexPair(value: number): string {
  return Math.round(value).toString(16).toUpperCase().padStart(2, '0');
}

/**
 * Flattens a translucent colour against an opaque backdrop.
 *
 * The design expresses every secondary text colour on a dark section as the brand cream at
 * some opacity — `rgba(253,249,243,.55)` and friends, forty literals across the package. A
 * ratio cannot be measured against a colour that is partly transparent, so the pair has to be
 * resolved first. `tokens.test.ts` uses this to hold those alphas to the same AA bar as every
 * opaque pair, which is a check the handoff never made.
 */
export function blendOver(fg: Hex, bg: Hex, alpha: number): Hex {
  const [fr, fg_, fb] = hexToRgb(fg);
  const [br, bg_, bb] = hexToRgb(bg);
  const mix = (f: number, b: number): string => toHexPair(f * alpha + b * (1 - alpha));
  return `#${mix(fr, br)}${mix(fg_, bg_)}${mix(fb, bb)}`;
}

/**
 * The minimum WCAG AA demands for a given text size.
 *
 * "Large" is >= 24px, or >= 18.66px when bold. The distinction matters here: the design uses
 * `sand-dark` both for 34px statistic numbers, where 3:1 is enough, and for 11px/700 section
 * eyebrows, where it is not. One corrected value serves both.
 */
export function requiredRatio(fontSizePx: number, bold = false): 3 | 4.5 {
  const isLarge = fontSizePx >= 24 || (bold && fontSizePx >= 18.66);
  return isLarge ? 3 : 4.5;
}
