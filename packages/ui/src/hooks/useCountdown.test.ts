import { describe, expect, it } from 'vitest';

import { splitDuration } from './useCountdown';

/**
 * The prototypes get this wrong in three separate ways, and all three are user-visible:
 * Choice and the signup badge round up while the Umrah clock rounds down, so one departure
 * shows two different day counts; the signup badge never re-renders at all; and once the
 * departure passes the clock sits at zeros forever with no departed state.
 */
describe('splitDuration', () => {
  const HOUR = 3_600_000;
  const DAY = 24 * HOUR;

  it('floors rather than rounding, so every page agrees', () => {
    // 38 days and 23 hours is 38 days, not 39. Ceil would say 39 here and floor 38 elsewhere.
    const d = splitDuration(38 * DAY + 23 * HOUR);
    expect(d.days).toBe(38);
    expect(d.hours).toBe(23);
  });

  it('splits a duration into its parts', () => {
    const d = splitDuration(2 * DAY + 3 * HOUR + 4 * 60_000 + 5000);
    expect(d).toMatchObject({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it('clamps a past target to zero instead of going negative', () => {
    const d = splitDuration(-5 * DAY);
    expect(d).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 0, hasPassed: true });
  });

  it('reports the moment of departure as passed', () => {
    expect(splitDuration(0).hasPassed).toBe(true);
    expect(splitDuration(1).hasPassed).toBe(false);
  });

  it('lets a day count exceed 99', () => {
    // The design pads to two digits. A group announced a year out is a three-digit number and
    // the cell has to survive it.
    expect(splitDuration(400 * DAY).days).toBe(400);
  });

  it('never rolls an hour into 24 or a minute into 60', () => {
    for (const ms of [DAY - 1, 2 * DAY - 1, 59_999, 3_599_999]) {
      const d = splitDuration(ms);
      expect(d.hours).toBeLessThan(24);
      expect(d.minutes).toBeLessThan(60);
      expect(d.seconds).toBeLessThan(60);
    }
  });
});
