import { describe, expect, it } from 'vitest';

import { minTapTarget } from '../tokens';

import { buttonClass, type ButtonSize, type ButtonVariant } from './Button';

const VARIANTS: ButtonVariant[] = ['solid', 'dark', 'outline', 'ghost'];
const SIZES: ButtonSize[] = ['sm', 'md', 'lg'];

describe('buttonClass', () => {
  it('defaults to the filled sand button at the middle size', () => {
    const classes = buttonClass();
    expect(classes).toContain('bg-accent');
    expect(classes).toContain('text-accent-on');
    expect(classes).toContain('uppercase');
  });

  it('keeps every combination above the 44px tap target', () => {
    // README §10 sets the minimum, and the small size — the navigation CTA, present on every
    // page of both sites — is 41px of line box and padding without the floor.
    expect(minTapTarget).toBe(44);
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        expect(buttonClass({ variant, size }), `${variant}/${size}`).toContain('min-h-tap');
      }
    }
  });

  it('makes every combination a pill', () => {
    for (const variant of VARIANTS) {
      for (const size of SIZES) {
        expect(buttonClass({ variant, size })).toContain('rounded-full');
      }
    }
  });

  it('leaves only the small size in sentence case', () => {
    // The navigation CTA is the one button in the whole handoff that is not uppercase.
    expect(buttonClass({ size: 'sm' })).not.toContain('uppercase');
    expect(buttonClass({ size: 'md' })).toContain('uppercase');
    expect(buttonClass({ size: 'lg' })).toContain('uppercase');
  });

  it('never lets a colour token reach the class list directly', () => {
    // A hex here would be a colour that survives a theme switch, which is the one thing the
    // whole variable layer exists to prevent.
    for (const variant of VARIANTS) {
      expect(buttonClass({ variant })).not.toMatch(/#[0-9A-Fa-f]{3,6}/);
    }
  });

  it('dims and disables through both the attribute and the ARIA state', () => {
    // A disabled <button> and an <a aria-disabled> have to look the same; the second cannot
    // carry the `disabled` attribute at all.
    const classes = buttonClass();
    expect(classes).toContain('disabled:opacity-45');
    expect(classes).toContain('aria-disabled:opacity-45');
  });

  it('puts the caller class last so an override wins', () => {
    const classes = buttonClass({ className: 'hover:bg-dark-alt' });
    expect(classes.endsWith('hover:bg-dark-alt')).toBe(true);
  });

  it('grows to the full column only when asked', () => {
    expect(buttonClass()).not.toContain('w-full');
    expect(buttonClass({ fullWidth: true })).toContain('w-full');
  });
});
