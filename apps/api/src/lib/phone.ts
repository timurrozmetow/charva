import { type CountryCode, parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Phone validation — anti-spam layer five, and the only one a genuine visitor ever notices.
 *
 * It is here for two reasons and the spam is the smaller one. A lead whose phone number cannot
 * be dialled is a lead that cannot be answered, and the manager finds out days later; the form
 * finding out immediately is worth the dependency on its own.
 *
 * Stored in E.164 — `+99365123456` — so the same person typing `65 12 34 56`, `+993 65 123456`
 * and `8 65 123456` produces one value, which is what makes the duplicate window in `hash.ts`
 * work at all.
 */

/**
 * Assumed when the number carries no country code.
 *
 * Both sites are written for an audience in Turkmenistan and the Umrah form is written for it
 * exclusively, so a bare `65 123456` is a Turkmen mobile. A number that does carry a `+` is
 * parsed as written, so a visitor calling from abroad is not forced into the wrong country.
 */
export const DEFAULT_COUNTRY: CountryCode = 'TM';

export interface ParsedPhone {
  /** E.164, digits and a leading plus. What goes in the column. */
  e164: string;
  country: string | undefined;
  isMobile: boolean;
}

/** Returns null for anything that is not a dialable number. */
export function parsePhone(
  input: string,
  country: CountryCode = DEFAULT_COUNTRY,
): ParsedPhone | null {
  const parsed = parsePhoneNumberFromString(input.trim(), country);
  if (!parsed?.isValid()) return null;

  const type = parsed.getType();
  return {
    e164: parsed.number,
    country: parsed.country,
    // Undefined type is common for valid numbers in smaller plans; treat it as acceptable
    // rather than rejecting a real number over metadata this library happens not to carry.
    isMobile: type === undefined || type === 'MOBILE' || type === 'FIXED_LINE_OR_MOBILE',
  };
}
