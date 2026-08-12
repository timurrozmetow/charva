import { describe, expect, it } from 'vitest';

import { addMoney, formatMoney, fromMajor, money, multiplyMoney } from './money';

describe('money', () => {
  it('refuses anything that is not whole minor units', () => {
    // The one rule that keeps the client's estimate and the server's quote identical.
    expect(() => money(12.5, 'USD')).toThrow(TypeError);
    expect(() => multiplyMoney(money(100, 'USD'), 1.5)).toThrow(TypeError);
  });

  it('refuses to add two currencies', () => {
    expect(() => addMoney(money(100, 'USD'), money(100, 'TMT'))).toThrow(TypeError);
  });

  it('converts from major units for seeds and configuration', () => {
    expect(fromMajor(180, 'USD').minor).toBe(18_000);
    expect(fromMajor(8_575, 'TMT').minor).toBe(857_500);
  });
});

/** Written as an escape everywhere below: the difference is invisible in a diff. */
const NBSP = '\u00A0';

describe('formatMoney', () => {
  it('writes the amount the way the design does', () => {
    // `1 296 $`, not `$1,296` — the suffix and the space are what a Russian-speaking reader
    // expects, and the design uses them throughout.
    expect(formatMoney(money(129_600, 'USD'))).toBe(`1${NBSP}296${NBSP}$`);
    expect(formatMoney(money(54_000, 'USD'))).toBe(`540${NBSP}$`);
    expect(formatMoney(money(857_500, 'TMT'))).toBe(`8${NBSP}575${NBSP}TMT`);
  });

  it('separates thousands with a space that does not break', () => {
    // A plain space lets `1 296 $` wrap between the digits, which happens in the estimate
    // panel at narrow widths. Visually identical, and it holds together.
    expect(formatMoney(money(129_600, 'USD'))).toContain(NBSP);
    // No ordinary space anywhere in the output — that is what would let it wrap.
    expect(formatMoney(money(129_600, 'USD'))).not.toContain(' ');
  });

  it('groups every thousand, however many', () => {
    expect(formatMoney(money(100_000_000, 'TMT'))).toBe(`1${NBSP}000${NBSP}000${NBSP}TMT`);
    expect(formatMoney(money(99_900, 'USD'))).toBe(`999${NBSP}$`);
  });

  it('hides the minor units when they are zero, as the design does', () => {
    expect(formatMoney(money(54_000, 'USD'))).toBe(`540${NBSP}$`);
    expect(formatMoney(money(54_050, 'USD'))).toBe(`540,50${NBSP}$`);
    expect(formatMoney(money(54_000, 'USD'), { alwaysShowMinor: true })).toBe(`540,00${NBSP}$`);
  });

  it('handles zero and negatives without producing nonsense', () => {
    // A refund line in the admin, and the first render of an empty estimate.
    expect(formatMoney(money(0, 'USD'))).toBe(`0${NBSP}$`);
    expect(formatMoney(money(-12_050, 'USD'))).toBe(`−120,50${NBSP}$`);
  });
});
