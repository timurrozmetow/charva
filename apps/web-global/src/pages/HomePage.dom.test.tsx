import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { builderConfig } from '../test/builderFixture';
import { formToken, home } from '../test/fixtures';
import { renderPage, stubApi } from '../test/renderPage';

import { HomePage } from './HomePage';

/**
 * The homepage.
 *
 * Its interesting properties are the ones the prototype gets wrong by having two copies of
 * everything: the counters above the sections, the builder in section three, and the cards.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

async function render(payload = home()) {
  stubApi({
    '/global/home': payload,
    '/global/builder/config': builderConfig(),
    '/forms/token': formToken(),
  });
  return renderPage(<HomePage lang="ru" />, { path: '/ru' });
}

describe('the homepage', () => {
  it('counts the catalogue instead of printing «32 маршрута»', async () => {
    await render();

    // The literals in the handoff stand above nine rows of data — decision D-6, question Q-5.
    const tours = await screen.findByRole('link', { name: /Все маршруты/ });
    expect(tours).toHaveTextContent('Все маршруты · 9');
    expect(screen.queryByText(/32/)).not.toBeInTheDocument();
    expect(screen.queryByText(/46 отелей/)).not.toBeInTheDocument();
  });

  it('builds the hero from the slides, so a caption belongs to the slide it is on', async () => {
    await render();

    /*
     * The rail names the slides, not the places.
     *
     * The fixture's slides are «Дарваза» and «Йангыкала»; its places, deliberately, are «Кратер
     * Дарваза» and «Каньоны Йангыкала» — the same two subjects under different names. The first
     * version of this page took the hero from the places, so it printed the place's name over
     * the photograph and «change the caption» meant renaming a row on `/turkmenistan`. Asserting
     * the short names is what makes that regression visible: they exist nowhere else.
     */
    expect(await screen.findByRole('button', { name: /Дарваза/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Йангыкала/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Кратер Дарваза/ })).not.toBeInTheDocument();
  });

  it('mounts the same builder as `/builder`, writing into this page’s URL', async () => {
    const { router } = await render();

    // Not a copy. The prototype's second builder renders its heading at weight 400 through a
    // duplicated property and offers different options on step two.
    expect(await screen.findByRole('navigation', { name: 'Шаги сборщика' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/ru');
  });

  it('marks the hero position while there is no photograph to put in it', async () => {
    const { container } = await render();

    /*
     * 174 positions and no pictures — decision D-21, question Q-1.
     *
     * The slot renders its key rather than collapsing, so the layout is real and the gap is a
     * row in a table with a status. The Russian brief beside it stays off by default: an art
     * direction note in the middle of a Turkish page is worse than a plain rectangle.
     */
    await screen.findByRole('button', { name: /Дарваза/ });
    expect(container.querySelector('[data-slot="hero-1"]')).not.toBeNull();
  });
});
