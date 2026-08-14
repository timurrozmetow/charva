import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formToken } from '../test/fixtures';
import { renderPage, type StubbedCall, stubApi } from '../test/renderPage';

import { SignupForm } from './SignupForm';

/**
 * A place on the pilgrimage.
 *
 * The handoff's form submits nothing: the button is an `<a href="#">`, the consent box is a
 * `<span>`, and the only live state is which room chip is highlighted. Everything below is
 * behaviour that was designed, and the two that matter most are about the passport number and
 * about a list that is already closed.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

async function render(open = true): Promise<{ calls: StubbedCall[] }> {
  const calls = stubApi({
    '/forms/token': formToken(),
    '/umrah/signups': { signupId: 7, isDuplicate: false },
  });
  await renderPage(<SignupForm lang="tm" open={open} />, { path: '/tm/yazylmak' });
  return { calls };
}

async function fillIn(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText(/^Ady we familiýasy/), 'Meret Aýdogdyýew');
  await user.type(screen.getByLabelText(/^Telefon/), '+993 65 123456');
  await user.click(screen.getByRole('checkbox'));
}

describe('the signup form', () => {
  it('sends consent and a room code, and no price', async () => {
    const user = userEvent.setup();
    const { calls } = await render();

    await user.click(screen.getByRole('button', { name: '3 adamlyk' }));
    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Arzany ibermek' }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'POST')).toBe(true);
    });

    const sent = calls.find((call) => call.method === 'POST')?.body as Record<string, unknown>;
    expect(sent['consent']).toBe(true);
    // A code, so «3 adamlyk» can be renamed without changing what was booked — D-10.
    expect(sent['roomType']).toBe('triple');
    expect(Object.keys(sent)).not.toContain('price');
    expect(Object.keys(sent)).not.toContain('total');
  });

  it('leaves the passport number out when it was not given', async () => {
    const user = userEvent.setup();
    const { calls } = await render();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Arzany ibermek' }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'POST')).toBe(true);
    });

    /*
     * Optional, and absent rather than empty.
     *
     * A manager can take it by telephone, and asking for a passport number in a web form before
     * anybody has spoken to the pilgrim is a decision the owner has not made. When it is given
     * it is encrypted before it reaches the column and every decryption is logged — D-18,
     * question Q-13.
     */
    const sent = calls.find((call) => call.method === 'POST')?.body as Record<string, unknown>;
    expect(Object.keys(sent)).not.toContain('passportNumber');
  });

  it('says where the passport number goes, beside the field asking for it', async () => {
    await render();
    expect(
      await screen.findByText(/Passport belgisi şifrlenen görnüşde saklanýar/),
    ).toBeInTheDocument();
  });

  it('refuses to submit without consent, and says why', async () => {
    const user = userEvent.setup();
    const { calls } = await render();

    await user.type(screen.getByLabelText(/^Ady we familiýasy/), 'Meret');
    await user.type(screen.getByLabelText(/^Telefon/), '+993 65 123456');
    await user.click(screen.getByRole('button', { name: 'Arzany ibermek' }));

    expect(
      await screen.findByText('Razylyk bolmasa arzany kabul edip bilmeris.'),
    ).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('cannot be submitted at all once the list is closed', async () => {
    await render(false);

    // The API refuses too. A disabled button is a courtesy, not a rule — but a list that looks
    // open produces people who believe they are going.
    expect(await screen.findByRole('button', { name: 'Arzany ibermek' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Ýazylyş ýapyk');
  });
});
