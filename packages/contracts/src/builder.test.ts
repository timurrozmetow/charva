import { describe, expect, it } from 'vitest';

import { BUILDER_DEFAULTS, BUILDER_STEPS, MULTI_STEPS, selectionCounts } from './builder';

/**
 * What is left of the builder once it stopped pricing.
 *
 * This file used to test `quote()` — twelve assertions about rates, per-city fees, a breakdown
 * that adds up, and twenty random selections matching the prototype. All of it went with the
 * function on 2026-09-11, when the owner took pricing off the site and then out of the enquiry:
 * an operator works a selection out and sends a price back.
 *
 * The rates were the designer's invention that question Q-10 never confirmed, so those tests
 * were proving that an arbitrary formula was applied consistently — true, and worth nothing to
 * anybody. What survives is the distinction the formula was built around and that outlived it:
 * `numericValue` is what an option *means* as a number, never what it costs. «7 дней» is seven
 * nights. That is decision D-10, and it is still the thing that can silently go wrong.
 */

const OPTIONS = [
  { code: 'nights_7', numericValue: 7 },
  { code: 'nights_14', numericValue: 14 },
  { code: 'pax_2', numericValue: 2 },
  // «6–10» means eight — a label is not a number, which is why the column exists.
  { code: 'pax_6_10', numericValue: 8 },
  // Food, transport and a guide are questions for the manager: they count as nothing.
  { code: 'food_halal', numericValue: null },
  { code: 'dest_ashgabat', numericValue: null },
];

describe('selectionCounts', () => {
  it('falls back to the defaults while those steps are unanswered', () => {
    // Six and two are what the panel shows before the visitor reaches the steps that set them.
    expect(selectionCounts({}, OPTIONS)).toEqual({ nights: 6, pax: 2 });
    expect(selectionCounts({}, OPTIONS)).toEqual({
      nights: BUILDER_DEFAULTS.defaultNights,
      pax: BUILDER_DEFAULTS.defaultPax,
    });
  });

  it('reads what an option means as a number, not what it is labelled', () => {
    expect(selectionCounts({ dates: 'nights_7' }, OPTIONS).nights).toBe(7);
    expect(selectionCounts({ dates: 'nights_14' }, OPTIONS).nights).toBe(14);
    // The prototype keys this by «6–10», with a real en dash. The code says eight.
    expect(selectionCounts({ people: 'pax_6_10' }, OPTIONS).pax).toBe(8);
  });

  it('keeps the two counts independent', () => {
    expect(selectionCounts({ dates: 'nights_7', people: 'pax_6_10' }, OPTIONS)).toEqual({
      nights: 7,
      pax: 8,
    });
  });

  it('falls back for an option that carries no number', () => {
    // `dest_ashgabat` is a place, not a duration. Reading it as one would be the mistake a
    // single `price_modifier` column forces, which is what D-10 separated.
    expect(selectionCounts({ dates: 'dest_ashgabat' }, OPTIONS).nights).toBe(6);
  });

  it('falls back for a code that no longer exists', () => {
    // An editor can retire an option while somebody holds its code in a shared URL (D-58).
    // The panel answers with the default rather than with nothing.
    expect(selectionCounts({ dates: 'nights_21' }, OPTIONS)).toEqual({ nights: 6, pax: 2 });
  });

  it('takes the first of a multi-answer step', () => {
    // Neither `dates` nor `people` is a multi step, but a selection arriving from a URL can
    // carry an array for any of them, and an array is what `chosen` normalises.
    expect(selectionCounts({ dates: ['nights_14', 'nights_7'] }, OPTIONS).nights).toBe(14);
  });

  it('accepts an empty option list', () => {
    // The first render, before `GET /builder/config` has answered.
    expect(selectionCounts({ dates: 'nights_7' }, [])).toEqual({ nights: 6, pax: 2 });
  });
});

describe('the step list', () => {
  it('has nine steps, and every multi step is one of them', () => {
    expect(BUILDER_STEPS).toHaveLength(9);
    for (const step of MULTI_STEPS) {
      expect(BUILDER_STEPS as readonly string[]).toContain(step);
    }
  });

  it('keys everything by stable ASCII', () => {
    // These codes go into a URL that gets shared and into the enquiry that is stored, so a
    // rename is a broken link and a mismatched record — D-10.
    for (const step of BUILDER_STEPS) expect(step).toMatch(/^[a-z_]+$/);
  });
});
