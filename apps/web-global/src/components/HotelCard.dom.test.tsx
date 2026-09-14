import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { hotel } from '../test/fixtures';
import { renderPage } from '../test/renderPage';

import { HotelCard } from './HotelCard';

/**
 * The card in a grid of cards.
 *
 * Everything asserted here is the kind of fault that is invisible in one card and obvious in
 * twelve: a fact printed twice, a row silently cut, a card that ends without ending.
 */

function render(data = hotel()) {
  return renderPage(<HotelCard hotel={data} lang="ru" />, { path: '/ru/hotels' });
}

describe('a hotel card', () => {
  it('states the class once — drawn, or written, never both', async () => {
    /*
     * `filterKey` is `5star` for a five-star hotel and `hotelFilters` renders that as «5 ★».
     * Beside a row of five drawn stars that is one fact twice on one line (D-120), and the
     * first version of this card did exactly that.
     */
    await render(hotel({ stars: 5, filterKey: '5star' }));

    expect(await screen.findByLabelText('5 ★')).toBeInTheDocument();
    // The drawn rating carries the accessible name; the words must not appear as well.
    expect(screen.queryByText('5 ★')).not.toBeInTheDocument();
  });

  it('writes the class out when there are no stars to draw', async () => {
    // A camp has a class and no rating — which is the whole reason `stars` and `category` are
    // two columns rather than one display string (the prototype gives a yurt camp «3★»).
    await render(hotel({ stars: null, filterKey: 'camp', category: 'camp' }));

    expect(await screen.findByText('Кемп')).toBeInTheDocument();
  });

  it('says how many amenities it is not showing', async () => {
    // A hotel with seven and a hotel with three looked identical once the row was cut at three.
    await render(
      hotel({
        amenities: ['pool', 'wifi', 'spa', 'gym', 'bar'].map((code) => ({
          code,
          name: code,
          icon: null,
        })),
      }),
    );

    expect(await screen.findByText('+2')).toBeInTheDocument();
  });

  it('shows no overflow chip when everything fits', async () => {
    await render(
      hotel({
        amenities: [{ code: 'pool', name: 'Бассейн', icon: null }],
      }),
    );

    await screen.findByText('Бассейн');
    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it('is one link, named by the hotel', async () => {
    // The prototype makes every card an `<a href="#">` around a div tree with no accessible
    // name. One link per card, and the affordance inside it is not a second one.
    const { container } = await render();

    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Ýyldyz Hotel');
  });
});
