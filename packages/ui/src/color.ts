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
