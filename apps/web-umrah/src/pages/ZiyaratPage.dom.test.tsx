import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ziyarat } from '../test/fixtures';
import { renderPage, stubApi } from '../test/renderPage';

import { ZiyaratPage } from './ZiyaratPage';

/**
 * The places of ziyarat, and the missing chip that produced decision D-15.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

async function render(path = '/tm/ziyarat') {
  stubApi({ '/umrah/ziyarat': ziyarat() });
  return renderPage(<ZiyaratPage lang="tm" />, { path });
}

describe('the ziyarat page', () => {
  it('offers a chip for Jidda, because the chips come from the data', async () => {
    await render();

    /*
     * The whole point.
     *
     * The prototype hardcodes `['Ählisi', 'Mekge', 'Medine', 'Bedir']` while its own list
     * contains a place in Jidda, so that place is reachable only through «Ählisi» and nobody
     * would ever see it from the code. Counting the cities makes both failures impossible: no
     * chip without rows, no rows without a chip.
     */
    const group = await screen.findByRole('group', { name: 'Şäher boýunça süzgüç' });
    const chips = within(group).getAllByRole('button');

    expect(chips.map((chip) => chip.textContent.replace(/\d+$/, '').trim())).toEqual([
      'Ählisi',
      'Mekge',
      'Medine',
      'Bedir',
      'Jidda',
    ]);
  });

  it('counts what it shows instead of printing «/ 9»', async () => {
    await render();
    expect(await screen.findByText('Görkezildi 4 / 4')).toBeInTheDocument();
  });

  it('puts the chosen city in the URL and the default nowhere', async () => {
    const user = userEvent.setup();
    const { router } = await render();

    await user.click(await screen.findByRole('button', { name: /Jidda/ }));
    await waitFor(() => {
      expect(router.state.location.searchStr).toContain('city=jidda');
    });

    await user.click(screen.getByRole('button', { name: /Ählisi/ }));
    await waitFor(() => {
      expect(router.state.location.searchStr).not.toContain('city');
    });
  });

  it('makes every place a link, because a place is a page', async () => {
    await render();

    // On the route page the handoff's cards are plain `<div>`s — no detail page was drawn — and
    // the same card on the homepage is an `<a>`. One of the two had to be wrong.
    const link = await screen.findByRole('link', { name: /Masjid al-Haram/ });
    expect(link).toHaveAttribute('href', '/tm/ziyarat/masjid-al-haram');
  });

  it('renders the Turkmen heading, not the Russian one', async () => {
    await render();

    // The prototype's H1 is «Куда мы пойдём» on a Turkmen page — question Q-3.
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Ziýarat ýerleri');
  });
});
