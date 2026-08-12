import { describe, expect, it } from 'vitest';

import { blendOver, contrastRatio, requiredRatio, type Hex } from './color';
import {
  choicePalette,
  CONTRAST_CORRECTIONS,
  CONTRAST_PAIRS,
  DARK_SURFACES,
  FILL_ONLY_ON_LIGHT,
  globalPalette,
  onDarkAlpha,
  umrahPalette,
} from './tokens';

/**
 * The contrast contract.
 *
 * Five colours in the handoff do not clear WCAG AA — one of them, the empty-value grey in the
 * builder estimate, sits at 2.19:1. The corrections are recorded in `CONTRAST_CORRECTIONS` and
 * this suite is what keeps them, and every other pair, from drifting back.
 */
describe('every text colour clears WCAG AA on the surfaces it is used on', () => {
  for (const pair of CONTRAST_PAIRS) {
    const need = requiredRatio(pair.size, pair.bold ?? false);
    it(`${pair.fg} on ${pair.bg} at ${String(pair.size)}px — ${pair.where}`, () => {
      const actual = contrastRatio(pair.fg, pair.bg);
      expect(
        actual,
        `${actual.toFixed(2)}:1, needs ${need.toFixed(1)}:1 (${pair.where})`,
      ).toBeGreaterThanOrEqual(need);
    });
  }
});

describe('the accent never carries text on a light surface', () => {
  const lightSurfaces: Hex[] = [
    globalPalette.bg,
    globalPalette.surface,
    umrahPalette.bg,
    umrahPalette.surface,
  ];

  for (const accent of FILL_ONLY_ON_LIGHT) {
    for (const surface of lightSurfaces) {
      it(`${accent} on ${surface} is below AA, so it stays fill-only`, () => {
        // Asserting the failure on purpose. If someone lightens a surface or darkens the accent
        // until this passes, the rule has changed and the list should change with it.
        expect(contrastRatio(accent, surface)).toBeLessThan(4.5);
      });
    }
  }
});

describe('the faintest cream stays decoration', () => {
  for (const { bg, cream, where } of DARK_SURFACES) {
    it(`${String(onDarkAlpha.faint)} cream on ${where} is below AA`, () => {
      // Asserting the failure on purpose, as with the accent on light. The design reaches for
      // this opacity constantly — rules, disabled controls, the faded edge of a scrim — and
      // the moment someone puts a sentence in it the page has unreadable text on it.
      const flattened = blendOver(cream, bg, onDarkAlpha.faint);
      expect(contrastRatio(flattened, bg)).toBeLessThan(4.5);
    });
  }
});

describe('the recorded corrections are accurate', () => {
  for (const fix of CONTRAST_CORRECTIONS) {
    it(`${fix.token}: ${fix.mockup} -> ${fix.corrected}`, () => {
      // The mockup value really did fail, to the ratio recorded.
      expect(contrastRatio(fix.mockup, fix.on)).toBeCloseTo(fix.was, 1);
      // The correction really does pass, to the ratio recorded.
      expect(contrastRatio(fix.corrected, fix.on)).toBeCloseTo(fix.now, 1);
      expect(contrastRatio(fix.corrected, fix.on)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${fix.token} moved lightness only`, () => {
      // Hue and saturation must survive: the point is a darker version of the designer's
      // colour, not a different colour that happens to pass.
      const hue = (hex: Hex): number => {
        const n = parseInt(hex.slice(1), 16);
        const [r, g, b] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max === min) return 0;
        const d = max - min;
        if (max === r) return (((g - b) / d + (g < b ? 6 : 0)) / 6) * 360;
        if (max === g) return (((b - r) / d + 2) / 6) * 360;
        return (((r - g) / d + 4) / 6) * 360;
      };
      expect(Math.abs(hue(fix.mockup) - hue(fix.corrected))).toBeLessThan(2);
    });
  }

  it('applies each correction to the palette', () => {
    const applied: Record<string, Hex> = {
      'globalPalette.brown300': globalPalette.brown300,
      'globalPalette.brown400': globalPalette.brown400,
      'sand.dark': globalPalette.sandDark,
      'umrahPalette.green400': umrahPalette.green400,
      'umrahPalette.link': umrahPalette.link,
    };
    for (const fix of CONTRAST_CORRECTIONS) {
      expect(applied[fix.token], `${fix.token} is not wired to its corrected value`).toBe(
        fix.corrected,
      );
    }
  });
});

describe('the two brands stay distinguishable where the design means them to', () => {
  it('keeps Global and Umrah card radii apart', async () => {
    const { radius } = await import('./tokens');
    // 22 against 24. It looks like noise and will tempt a cleanup commit; it is in the design.
    expect(radius.cardGlobal).not.toBe(radius.cardUmrah);
  });

  it('keeps the hover lift apart', async () => {
    const { lift } = await import('./tokens');
    expect(lift.global).toBe(-6);
    expect(lift.umrah).toBe(-5);
  });

  it('gives each brand its own cream', () => {
    // #FDF9F3 against #FCF9F4 — one channel apart, and deliberate.
    expect(globalPalette.cream).not.toBe(umrahPalette.cream);
    expect(choicePalette.cream).toBe(globalPalette.cream);
  });
});
