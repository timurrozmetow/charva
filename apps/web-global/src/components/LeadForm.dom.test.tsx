import { HONEYPOT_FIELD } from '@charva/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formToken } from '../test/fixtures';
import { renderPage, type StubbedCall, stubApi, StubFailure } from '../test/renderPage';

import { LeadForm } from './LeadForm';

/**
 * The form the handoff does not have.
 *
 * Its submit button is an `<a href="#">`, its consent box is a styled `<span>` and no input is
 * controlled, so there is nothing here to compare against — every assertion below is about a
 * property that was designed rather than transcribed.
 *
 * What is worth testing is not that the fields render. It is that consent leaves the browser,
 * that the honeypot is present and unreachable, that a refusal is explained, and that a
 * submission which has not been made cannot look like one that has.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

async function render(
  props: Partial<Parameters<typeof LeadForm>[0]> = {},
  routes: Record<string, unknown> = {},
): Promise<{ calls: StubbedCall[] }> {
  const calls = stubApi({
    '/forms/token': formToken(),
    '/global/leads': { leadId: 42, isDuplicate: false },
    ...routes,
  });

  await renderPage(<LeadForm lang="ru" kind="tour" {...props} />, { path: '/ru/contact' });
  return { calls };
}

/** Fills the two fields that are required and ticks the box. */
async function fillIn(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.type(screen.getByLabelText(/^Имя/), 'Мерет');
  await user.type(screen.getByLabelText(/^Телефон/), '+993 65 123456');
  await user.click(screen.getByRole('checkbox'));
}

describe('the lead form', () => {
  it('asks for the signed token when it mounts, not when it submits', async () => {
    const { calls } = await render();

    /*
     * Anti-spam layer three, and the whole mechanism is the gap between the two moments.
     *
     * The token carries the time it was issued and the API refuses anything that comes back
     * inside three seconds. Fetching it at submit time would hand every bot a fresh one.
     */
    await waitFor(() => {
      expect(calls.some((call) => call.url.includes('/forms/token'))).toBe(true);
    });
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('sends consent, the kind and the token — and never a price', async () => {
    const user = userEvent.setup();
    const { calls } = await render({ kind: 'builder', selection: { dates: 'nights_7' } });

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'POST')).toBe(true);
    });

    const sent = calls.find((call) => call.method === 'POST')?.body as Record<string, unknown>;
    expect(sent['consent']).toBe(true);
    expect(sent['kind']).toBe('builder');
    expect(sent['formToken']).toBe('stub.token.signature');
    expect(sent['selection']).toEqual({ dates: 'nights_7' });

    // There is no field for a total and there must never be one: the server prices the codes
    // from the database, because a number that arrived from a browser is one the sender chose.
    expect(Object.keys(sent)).not.toContain('total');
    expect(Object.keys(sent)).not.toContain('price');
  });

  it('refuses to submit without consent, and says why', async () => {
    const user = userEvent.setup();
    const { calls } = await render();

    await user.type(screen.getByLabelText(/^Имя/), 'Мерет');
    await user.type(screen.getByLabelText(/^Телефон/), '+993 65 123456');
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));

    expect(await screen.findByText('Без согласия мы не сможем перезвонить.')).toBeInTheDocument();
    expect(calls.some((call) => call.method === 'POST')).toBe(false);
  });

  it('carries a honeypot that no person can reach', async () => {
    await render();

    // Layer two. Present in the DOM because a field that is not rendered is a field many bots
    // skip; off-screen, `aria-hidden` and out of the tab order so nobody else ever meets it.
    const honeypot = document.querySelector(`input[name="${HONEYPOT_FIELD}"]`);
    expect(honeypot).not.toBeNull();
    expect(honeypot?.getAttribute('tabindex')).toBe('-1');
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('replaces itself with a confirmation rather than clearing the fields', async () => {
    const user = userEvent.setup();
    await render();

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));

    // An emptied form is indistinguishable from one that failed and reset. The confirmation
    // names the number that will be called, which is the fact the sender wants confirmed.
    expect(await screen.findByText('Заявка принята')).toBeInTheDocument();
    expect(screen.getByText(/\+993 65 123456/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Отправить заявку' })).not.toBeInTheDocument();
  });

  it('explains a rate limit differently from a dropped connection', async () => {
    const user = userEvent.setup();
    await render({}, { '/global/leads': new StubFailure(429, 'rate_limited') });

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));

    // «Проверьте соединение» would send somebody to restart their router over a limit that
    // clears itself in ten minutes.
    expect(
      await screen.findByText(
        'Слишком много попыток с этого адреса. Попробуйте через десять минут.',
      ),
    ).toBeInTheDocument();
  });

  it('drops the party size and the topics on a general question', async () => {
    await render({ kind: 'question' });

    // The prototype's two tabs change nothing at all — same fields either way — and
    // `SCREENS.md` leaves the question open. A question about visas has no party size.
    expect(screen.queryByLabelText(/^Гостей/)).not.toBeInTheDocument();
    expect(screen.queryByText('Что нужно')).not.toBeInTheDocument();
    expect(screen.queryByText('Дополнительно')).not.toBeInTheDocument();
  });

  it('lets one kind of trip be asked for at a time, and any number of services', async () => {
    /*
     * The five chips used to be five independent toggles, so a lead could arrive asking for a
     * ready tour *and* a custom route *and* a hotel on its own — three answers to one question.
     * The kind is now a radio group; the visa and the transfer stay free and, crucially, ride
     * through a change of kind untouched.
     */
    const user = userEvent.setup();
    const { calls } = await render({ kind: 'tour', showTopics: true });

    await user.click(screen.getByRole('radio', { name: 'Готовый тур' }));
    await user.click(screen.getByRole('button', { name: 'Виза' }));
    await user.click(screen.getByRole('radio', { name: 'Свой маршрут' }));

    expect(screen.getByRole('radio', { name: 'Свой маршрут' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Готовый тур' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Виза' })).toHaveAttribute('aria-pressed', 'true');

    await fillIn(user);
    await user.click(screen.getByRole('button', { name: 'Отправить заявку' }));

    await waitFor(() => {
      expect(calls.some((call) => call.method === 'POST')).toBe(true);
    });
    const sent = calls.find((call) => call.method === 'POST')?.body as { topics?: string[] };
    expect(sent.topics).toEqual(['custom_route', 'visa']);
  });
});
