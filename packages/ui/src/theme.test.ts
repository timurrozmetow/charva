import { describe, expect, it } from 'vitest';

import { buildThemeCss, darkSurface, themes } from './theme';

/**
 * The theme layer's contract.
 *
 * Two things can break here silently. A theme can stop defining a role, and a page then
 * renders a colour of `var(--c-something)` with no fallback, which computes to nothing and
 * inherits — usually black on black. And the dark-surface block can come to reference a
 * variable that no longer exists, which fails exactly the same way and only on the pages that
 * happen to have a dark section.
 */
describe('every theme defines every role', () => {
  const roles = Object.keys(themes.global).sort();

  for (const [name, vars] of Object.entries(themes)) {
    it(`${name} defines the same set as global`, () => {
      expect(Object.keys(vars).sort()).toEqual(roles);
    });

    it(`${name} leaves no role empty`, () => {
      for (const [role, value] of Object.entries(vars)) {
        expect(value, `${name}.${role} is empty`).not.toBe('');
      }
    });
  }
});

describe('the dark-surface block', () => {
  const referenced = Object.values(darkSurface)
    .flatMap((value) => [...value.matchAll(/var\((--c-[a-z-]+)\)/g)])
    .map((match) => match[1]);

  it('references only roles that exist', () => {
    // Every value points at another variable rather than a literal — that is what lets one
    // block serve all three brands. It only works while the names it points at are real.
    expect(referenced.length).toBeGreaterThan(0);
    for (const name of referenced) {
      expect(Object.keys(themes.global), `${String(name)} is not a theme role`).toContain(name);
    }
  });

  it('overrides only roles that exist', () => {
    for (const name of Object.keys(darkSurface)) {
      expect(Object.keys(themes.global), `${name} is not a theme role`).toContain(name);
    }
  });

  it('flips the border base but not the shadow base', () => {
    // A dark section needs light borders and still needs dark shadows. One variable for both
    // would put a cream glow under every card in the video section.
    expect(darkSurface['--c-border-rgb']).toBe('var(--c-cream-rgb)');
    expect(darkSurface['--c-ink-rgb']).toBeUndefined();
  });

  it('does not touch the accent fill or the text on it', () => {
    // The sand button looks the same on both surfaces; only the *text* accent changes.
    expect(darkSurface['--c-accent']).toBeUndefined();
    expect(darkSurface['--c-on-accent']).toBeUndefined();
    expect(darkSurface['--c-accent-text']).toBe('var(--c-accent)');
  });
});

describe('the generated stylesheet', () => {
  const css = buildThemeCss();

  it('makes Global the default so a missing data-theme still renders', () => {
    expect(css).toContain(':root, [data-theme="global"] {');
  });

  it('carries all three themes and the dark surface', () => {
    for (const selector of [
      '[data-theme="umrah"] {',
      '[data-theme="choice"] {',
      '[data-surface="dark"] {',
    ]) {
      expect(css).toContain(selector);
    }
  });

  it('puts the dark surface after the themes it reads from', () => {
    // Custom properties do not cascade by source order the way declarations do, but the block
    // is still easier to reason about — and to read in devtools — after what it overrides.
    expect(css.indexOf('[data-surface="dark"]')).toBeGreaterThan(
      css.indexOf('[data-theme="choice"]'),
    );
  });

  it('gives each site its own hero size', () => {
    // 82 / 72 / 64. This is the one type role where the three sites genuinely disagree, and
    // making it a variable is what keeps a `site` prop off every homepage headline.
    const sizes = Object.values(themes).map((vars) => vars['--c-hero-size']);
    expect(new Set(sizes).size).toBe(3);
  });
});
