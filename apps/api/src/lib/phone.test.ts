import { describe, expect, it } from 'vitest';

import { parsePhone } from './phone';

/**
 * Anti-spam layer five, which is here mostly for a reason that has nothing to do with spam: a
 * lead whose number cannot be dialled is a lead nobody can answer, and the manager finds out
 * days later.
 */

describe('parsePhone', () => {
  it('reads a Turkmen mobile written the several ways people write it', () => {
    // Turkmenistan is assumed when there is no country code, because both sites are written for
    // an audience there and the Umrah form exclusively so.
    for (const written of ['+993 65 123456', '65 123456', '65123456', '+99365123456']) {
      expect(parsePhone(written)?.e164, written).toBe('+99365123456');
    }
  });

  it('normalises to one value, which is what makes the duplicate window work', () => {
    const spaced = parsePhone('+993 65 12 34 56')?.e164;
    const bare = parsePhone('65123456')?.e164;
    expect(spaced).toBe(bare);
  });

  it('keeps a foreign number as written rather than forcing it into Turkmenistan', () => {
    expect(parsePhone('+90 532 123 45 67')?.country).toBe('TR');
    expect(parsePhone('+7 916 123-45-67')?.country).toBe('RU');
  });

  it('returns null for what is not a number at all', () => {
    for (const rubbish of ['', 'позвоните мне', '123', '+++', 'ноль']) {
      expect(parsePhone(rubbish), rubbish).toBeNull();
    }
  });

  it('trims, because a pasted number carries whitespace', () => {
    expect(parsePhone('  +993 65 123456  ')?.e164).toBe('+99365123456');
  });
});
