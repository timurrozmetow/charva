/**
 * Money.
 *
 * Always whole minor units in an integer — cents for dollars, teňňe for manat — and never a
 * float anywhere near a price. Decision D-24. The builder multiplies a nightly rate by a
 * number of nights and then by a number of people, and doing that in floating point produces
 * quotes that differ between the client's instant estimate and the server's authoritative one
 * in the last cent, which is exactly the disagreement D-11 exists to make impossible.
 */

export const CURRENCIES = ['USD', 'TMT'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface Money {
  /** Whole minor units. 129_600 is $1,296.00. */
  minor: number;
  currency: Currency;
}

/** How many minor units make one major unit. Both currencies happen to use 100. */
export const MINOR_PER_MAJOR = 100;

/**
 * How each currency is written.
 *
 * The dollar sign follows the number with a space — `1 296 $` — which is what the design does
 * and what a Russian-speaking reader expects; it is not the Anglo-American `$1,296`.
 */
const SUFFIX: Record<Currency, string> = {
  USD: '$',
  TMT: 'TMT',
};

export function money(minor: number, currency: Currency): Money {
  if (!Number.isInteger(minor)) {
    throw new TypeError(`Money must be whole minor units, received ${String(minor)}`);
  }
  return { minor, currency };
}

/** For seeds and configuration, where writing 180 is clearer than writing 18_000. */
export function fromMajor(major: number, currency: Currency): Money {
  return money(Math.round(major * MINOR_PER_MAJOR), currency);
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new TypeError(`Cannot add ${a.currency} to ${b.currency}`);
  }
  return money(a.minor + b.minor, a.currency);
}

export function multiplyMoney(value: Money, factor: number): Money {
  if (!Number.isInteger(factor)) {
    throw new TypeError(`Money multiplies by whole numbers only, received ${String(factor)}`);
  }
  return money(value.minor * factor, value.currency);
}

export interface FormatMoneyOptions {
  /** Show the minor units even when they are zero. Off by default, as the design has them off. */
  alwaysShowMinor?: boolean;
}

/**
 * The only place a price becomes a string.
 *
 * Thousands are separated by a non-breaking space rather than the plain one the prototype
 * uses. It looks identical and it stops `1 296 $` from breaking across two lines, which the
 * plain space allows and which happens on the estimate panel at narrow widths.
 */
const NBSP = '\u00A0';

export function formatMoney(value: Money, options: FormatMoneyOptions = {}): string {
  const negative = value.minor < 0;
  const absolute = Math.abs(value.minor);
  const major = Math.trunc(absolute / MINOR_PER_MAJOR);
  const minor = absolute % MINOR_PER_MAJOR;

  const grouped = String(major).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const fraction =
    minor === 0 && options.alwaysShowMinor !== true ? '' : `,${String(minor).padStart(2, '0')}`;

  return `${negative ? '−' : ''}${grouped}${fraction}${NBSP}${SUFFIX[value.currency]}`;
}
