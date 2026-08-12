import { describe, expect, it } from 'vitest';

import { deriveTripState, type TripTiming } from './trip-status';

/**
 * The five states of a departure — decision D-13.
 *
 * The prototype has one. Once its hardcoded date passes, the countdown clamps to «00 дней
 * 00 часов» and sits there over a signup form that still accepts submissions, and nothing in
 * the design says what a group in the air is supposed to look like.
 */

const DEPART = new Date('2026-09-18T06:00:00Z');
const RETURN = new Date('2026-09-28T20:00:00Z');
const CLOSES = new Date('2026-09-04T00:00:00Z');

function trip(overrides: Partial<TripTiming> = {}): TripTiming {
  return {
    departAt: DEPART,
    returnAt: RETURN,
    signupClosesAt: CLOSES,
    seatsTotal: 45,
    seatsTaken: 33,
    ...overrides,
  };
}

describe('deriveTripState', () => {
  it('is open while the list is open and seats remain', () => {
    const state = deriveTripState(trip(), new Date('2026-08-12T10:00:00Z'));
    expect(state.status).toBe('open');
    expect(state.signupOpen).toBe(true);
  });

  it('is full when every seat is taken', () => {
    const state = deriveTripState(trip({ seatsTaken: 45 }), new Date('2026-08-12T10:00:00Z'));
    expect(state.status).toBe('full');
    expect(state.signupOpen).toBe(false);
    expect(state.seatsLeft).toBe(0);
  });

  it('is closed once the list shuts, even with seats left', () => {
    const state = deriveTripState(trip(), new Date('2026-09-10T00:00:00Z'));
    expect(state.status).toBe('closed');
    expect(state.seatsLeft).toBe(12);
  });

  it('prefers closed over full, because that is the reason a visitor can act on', () => {
    // Being told «мест нет» when the real reason is that the list shut a week ago sends
    // somebody looking for a cancellation that would not help them.
    const state = deriveTripState(trip({ seatsTaken: 45 }), new Date('2026-09-10T00:00:00Z'));
    expect(state.status).toBe('closed');
  });

  it('is departed once the group has left — the state the prototype has no idea about', () => {
    const state = deriveTripState(trip(), new Date('2026-09-20T00:00:00Z'));
    expect(state.status).toBe('departed');
    expect(state.signupOpen).toBe(false);
  });

  it('is completed once it has come back, which makes it a candidate for the archive', () => {
    const state = deriveTripState(trip(), new Date('2026-10-01T00:00:00Z'));
    expect(state.status).toBe('completed');
  });

  it('computes the seats bar rather than drawing the literal beside it', () => {
    // The prototype writes `width: 73%` next to a caption reading 33 / 45, which is 73.33%.
    const state = deriveTripState(trip(), new Date('2026-08-12T10:00:00Z'));
    expect(state.seatsPercent).toBe(73.3);
    expect(state.seatsLeft).toBe(12);
  });

  it('does not go past a hundred percent or below zero seats', () => {
    // Overbooking is a data-entry mistake, not a reason to draw a bar off the edge of the card.
    const state = deriveTripState(trip({ seatsTaken: 60 }), new Date('2026-08-12T10:00:00Z'));
    expect(state.seatsPercent).toBe(100);
    expect(state.seatsLeft).toBe(0);
  });

  it('treats a departure with no closing date as open until it leaves', () => {
    const state = deriveTripState(trip({ signupClosesAt: null }), new Date('2026-09-17T00:00:00Z'));
    expect(state.status).toBe('open');
  });
});
