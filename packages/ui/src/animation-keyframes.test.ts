import { describe, expect, it } from 'vitest';

import { charvaPreset } from './tailwind-preset';

/**
 * Every animation the preset declares must name a `@keyframes` block the preset also defines.
 *
 * This exists because one of them did not, and nothing anywhere noticed. `fade-up` was written
 * as `'"fadeUp" 900ms ease both'`, with the name quoted. That is valid CSS — `animation-name`
 * accepts a string as well as an identifier — but Tailwind resolves which keyframes block to
 * emit by matching the first whitespace-delimited token of this value against a key in
 * `theme.keyframes`, and `"fadeUp"` with its quotes matches nothing. The utility compiled, the
 * rule shipped, and it pointed at a block that was never written to the stylesheet. Under
 * `animation-fill-mode: both` an animation with no keyframes has no effect at all, so the two
 * halves of the chooser rendered at their final values and looked, to anyone reviewing the
 * page, exactly like an animation that had already finished.
 *
 * D-32's class audit cannot catch this. It asks whether a class produces CSS; this one produced
 * a perfectly good rule. The question that catches it is whether the name inside that rule
 * resolves — which is a question about the preset alone, so it is answered here rather than
 * against compiled output.
 */
describe('preset animations', () => {
  const theme = charvaPreset.theme.extend;
  const animations = theme.animation as Record<string, string>;
  const keyframes = theme.keyframes as Record<string, unknown>;

  it('declares at least the four the package uses', () => {
    // A guard on the guard: if `animation` ever came back empty — a rename, a bad merge — every
    // assertion below would pass by iterating nothing.
    expect(Object.keys(animations)).toEqual(
      expect.arrayContaining(['drop-in', 'pulse', 'fade-up', 'page-in']),
    );
  });

  it.each(Object.entries(animations))('%s names a keyframes block that exists', (_name, value) => {
    const first = value.trim().split(/\s+/)[0] ?? '';

    // The unquoted form is the only one Tailwind matches. Asserting it separately from the
    // lookup below is what makes a failure readable: quoting the name and misspelling it are
    // different mistakes with the same symptom.
    expect(first).not.toMatch(/["']/);

    // `spin` is Tailwind's own and is not redeclared here; anything else must be ours.
    if (first === 'spin') return;
    expect(Object.keys(keyframes)).toContain(first);
  });
});
