import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { toursResponse } from '../test/fixtures';
import { renderPage, stubApi } from '../test/renderPage';

import { ToursPage } from './ToursPage';

/**
 * The catalogue.
 *
 * The assertions worth having are the three corrections, not the rendering: the chips come from
 * the data, the counter is counted, and the header figures are derived. Every one of those is a
 * literal in the prototype, and every one of them contradicts the rows underneath it.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

async function render(payload = toursResponse()) {
  stubApi({ '/global/tours': payload });
  return renderPage(<ToursPage lang="ru" />, { path: '/ru/tours' });
}

describe('the tours catalogue', () => {
  it('builds the filter chips from the facets the API counted', async () => {
    await render();

    // Never a hardcoded list: a chip exists only when rows exist behind it, so no chip can lead
    // to an empty grid. The prototype hardcodes six chips over nine rows in memory (D-15).
    const group = await screen.findByRole('group', { name: 'Фильтр по теме' });
    const chips = within(group).getAllByRole('button');

    expect(chips.map((chip) => chip.textContent.replace(/\d+$/, '').trim())).toEqual([
      'Все',
      'Классика',
      'Природа',
      'История',
    ]);
  });

  it('counts what it shows instead of printing «из 32»', async () => {
    await render();
    // The prototype renders «Показано {{shownCount}} из 32» with the denominator typed in,
    // beside nine rows of data. Decision D-6.
    // Twice on the page by design: beside the chips and under the grid, where «Показать ещё»
    // announces it after each press.
    expect(await screen.findAllByText('Показано 3 из 9')).toHaveLength(2);
    expect(screen.queryByText(/из 32/)).not.toBeInTheDocument();
  });

  it('derives the three figures in the header from the tours themselves', async () => {
    await render();

    await waitFor(() => {
      expect(screen.getByText('Маршрута')).toBeInTheDocument();
    });

    // 3, 6 and 8 days across the fixture → «3–8». The prototype prints «3–14» as a literal.
    expect(screen.getByText('3–8')).toBeInTheDocument();
    /*
     * The cheapest of the three, formatted by `formatMoney`.
     *
     * It appears twice — as the header figure and on the card it came from — which is the point:
     * one number, one formatter, two places, and no literal anywhere.
     */
    expect(screen.getAllByText('540 $')).toHaveLength(2);
  });

  it('translates a category code rather than showing the database value', async () => {
    // The API answers `label: code` on purpose — a Russian label in the database could not be
    // translated. The words are interface copy (D-23).
    await render();
    const group = await screen.findByRole('group', { name: 'Фильтр по теме' });
    expect(within(group).queryByText('classic')).not.toBeInTheDocument();
    expect(within(group).getByText('Классика')).toBeInTheDocument();
  });

  it('puts the chosen filter in the URL', async () => {
    const { router } = await render();
    await screen.findByRole('group', { name: 'Фильтр по теме' });

    await userEvent.click(screen.getByRole('button', { name: /Природа/ }));

    // A filtered catalogue that cannot be linked to is one nobody can send to the person they
    // are travelling with.
    await waitFor(() => {
      expect(router.state.location.searchStr).toContain('category=nature');
    });
  });

  it('keeps a default out of the URL', async () => {
    const { router } = await render();
    await screen.findByRole('group', { name: 'Фильтр по теме' });

    await userEvent.click(screen.getByRole('button', { name: /Природа/ }));
    await waitFor(() => {
      expect(router.state.location.searchStr).toContain('category=nature');
    });

    await userEvent.click(screen.getByRole('button', { name: /Все/ }));
    // `/ru/tours` and `/ru/tours?category=all` are the same page and should be one address.
    await waitFor(() => {
      expect(router.state.location.searchStr).not.toContain('category');
    });
  });

  it('gives every card a link named by its heading', async () => {
    await render();
    const link = await screen.findByRole('link', { name: 'Классический Туркменистан' });
    expect(link).toHaveAttribute('href', '/ru/tours/klassicheskiy-turkmenistan');
  });

  it('shows the tag and the category as the different fields they are', async () => {
    // Tour 2 is tagged «Пустыня» and categorised «Природа». The pill is never the filter.
    await render();
    expect(await screen.findByText('Пустыня')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Фильтр по теме' });
    expect(within(group).getByText('Природа')).toBeInTheDocument();
  });

  it('offers a way out when a filter empties the grid', async () => {
    await render(
      toursResponse({
        items: [],
        meta: { page: 1, perPage: 9, total: 0, totalPages: 0, hasMore: false },
      }),
    );

    // A state the prototype cannot reach — its filters run over nine rows and every chip
    // matches something. With a real catalogue and an unpublished tour it happens on day one.
    expect(await screen.findByText('Ничего не нашлось')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Все' })).toBeInTheDocument();
  });

  it('offers a retry rather than an error code when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    await renderPage(<ToursPage lang="ru" />, { path: '/ru/tours' });

    expect(await screen.findByText('Не удалось загрузить')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Повторить' })).toBeInTheDocument();
  });

  it('renders its heading and lead before the request resolves', async () => {
    stubApi({ '/global/tours': toursResponse() });
    await renderPage(<ToursPage lang="ru" />, { path: '/ru/tours' });

    // Copy is in the bundle; only the rows come from the network.
    expect(
      screen.getByRole('heading', { name: 'Готовые туры по Туркменистану', level: 1 }),
    ).toBeInTheDocument();
  });
});
