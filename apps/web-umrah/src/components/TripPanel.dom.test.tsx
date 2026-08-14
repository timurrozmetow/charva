import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { trip } from '../test/fixtures';
import { renderPage } from '../test/renderPage';

import { TripPanel } from './TripPanel';

/**
 * The six states of a departure.
 *
 * The prototype knows one — a departure in the future with seats left — and reaches the others
 * by arithmetic accident: `Math.max(0, TARGET - now)` clamps to zero, so the morning after a
 * group leaves the page shows `00 00 00 00` beside a signup form that still accepts
 * submissions. Decision D-13; two of these states have no design at all, question Q-4.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

function render(props: Parameters<typeof TripPanel>[0]) {
  return renderPage(<TripPanel {...props} />, { path: '/tm' });
}

describe('the departure panel', () => {
  it('draws the bar from the two numbers rather than from a literal', async () => {
    await render({ trip: trip(), next: null, lang: 'tm' });

    // 33 of 45 is 73.33%. The prototype writes `width: 73%` beside a caption reading `33 / 45`,
    // so the bar and the number under it disagree — and the bar never moves whatever sells.
    const bar = await screen.findByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '33');
    expect(bar).toHaveAttribute('aria-valuemax', '45');
    expect(screen.getByText('33 / 45 adam')).toBeInTheDocument();
  });

  it('shows the clock while the group has not left', async () => {
    const { container } = await render({ trip: trip(), next: null, lang: 'tm' });

    expect(container.querySelector('[data-state="open"]')).not.toBeNull();
    expect(await screen.findByText('Ugramaga galdy')).toBeInTheDocument();
  });

  it('keeps the clock but says why the list is shut when it is full', async () => {
    const { container } = await render({
      trip: trip({ status: 'full', seatsTaken: 45, seatsLeft: 0, signupOpen: false }),
      next: null,
      lang: 'tm',
    });

    expect(container.querySelector('[data-state="full"]')).not.toBeNull();
    expect(screen.getByText('Ugramaga galdy')).toBeInTheDocument();
    expect(screen.getByText(/Ähli ýerler eýelendi/)).toBeInTheDocument();
  });

  it('removes the clock once the group is in the air, and promotes the next one', async () => {
    const { container } = await render({
      trip: trip({ status: 'departed' }),
      next: trip({ id: 2, departAt: '2099-12-01T06:00:00.000Z' }),
      lang: 'tm',
    });

    // Not a frozen `00 00 00 00`: there is nothing to count down to any more.
    expect(container.querySelector('[data-state="departed"]')).not.toBeNull();
    expect(screen.queryByText('Ugramaga galdy')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Topar ýolda')).toBeInTheDocument();
    expect(screen.getByText('Indiki topar: 01.12.2099')).toBeInTheDocument();
  });

  it('says so when there is no departure at all, and still offers a way in', async () => {
    // The state that happens a fortnight after launch, the first time a group returns before
    // the next has been announced. Nobody drew it.
    const { container } = await render({ trip: null, next: null, lang: 'tm' });

    expect(container.querySelector('[data-state="none"]')).not.toBeNull();
    expect(screen.getByText('Indiki topar heniz yglan edilmedi')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ýazylmak' })).toBeInTheDocument();
  });

  it('renders the date in Ashgabat, not in whoever is reading', async () => {
    // `depart_at` is stored UTC, and a pilgrim abroad must not see a date one day off the one
    // printed on their ticket.
    await render({ trip: trip({ departAt: '2099-09-17T21:00:00.000Z' }), next: null, lang: 'tm' });

    expect(await screen.findByText('18.09.2099')).toBeInTheDocument();
  });
});
