import { describe, expect, it } from 'vitest';

import { issueFormToken, MAX_FILL_SECONDS, MIN_FILL_SECONDS, verifyFormToken } from './form-token';

/**
 * Anti-spam layer three, which is the only one of the five that costs a visitor nothing and
 * the only one that needs no storage at all.
 */

const SECRET = 'a-secret-nobody-else-has';
const NOW = 1_800_000_000_000;

describe('the time trap', () => {
  it('accepts a form a person plausibly filled in', () => {
    const { token } = issueFormToken(SECRET, NOW);
    expect(verifyFormToken(token, SECRET, NOW + 30_000)).toBe('ok');
  });

  it('refuses one returned faster than anybody could type', () => {
    const { token } = issueFormToken(SECRET, NOW);
    expect(verifyFormToken(token, SECRET, NOW + 1_000)).toBe('too_fast');
    // Three seconds is the boundary and it is inclusive: a slow bot is still a bot, but a fast
    // person tabbing through a two-field form should not be punished for it.
    expect(verifyFormToken(token, SECRET, NOW + MIN_FILL_SECONDS * 1000)).toBe('ok');
  });

  it('refuses one from a page that has been open for hours', () => {
    const { token } = issueFormToken(SECRET, NOW);
    expect(verifyFormToken(token, SECRET, NOW + (MAX_FILL_SECONDS + 1) * 1000)).toBe('expired');
  });

  it('refuses a timestamp somebody wrote themselves', () => {
    // The whole point: the server keeps no record of what it issued, so the signature is what
    // makes a timestamp trustworthy. Without it the trap is a suggestion.
    const forged = `${String(Math.floor(NOW / 1000) - 60)}.notarealsignature`;
    expect(verifyFormToken(forged, SECRET, NOW)).toBe('bad_signature');
  });

  it('refuses a token signed with a different secret', () => {
    const { token } = issueFormToken('some-other-deployment', NOW);
    expect(verifyFormToken(token, SECRET, NOW + 30_000)).toBe('bad_signature');
  });

  it('refuses rubbish without throwing', () => {
    for (const rubbish of ['', '.', 'nodot', '.onlysignature', 'abc.def', '-5.x']) {
      expect(['malformed', 'bad_signature']).toContain(verifyFormToken(rubbish, SECRET, NOW));
    }
  });

  it('tells the caller which failure it was', () => {
    // Distinct verdicts because they mean different things operationally: a week of `too_fast`
    // says the traps are working, a week of `expired` says the window is too short and real
    // people are losing what they typed.
    const { token } = issueFormToken(SECRET, NOW);
    const verdicts = new Set([
      verifyFormToken(token, SECRET, NOW),
      verifyFormToken(token, SECRET, NOW + 30_000),
      verifyFormToken(token, SECRET, NOW + (MAX_FILL_SECONDS + 1) * 1000),
    ]);
    expect(verdicts).toEqual(new Set(['too_fast', 'ok', 'expired']));
  });
});
