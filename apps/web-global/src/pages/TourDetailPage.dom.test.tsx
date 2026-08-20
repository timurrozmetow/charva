import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { formToken, tourDetail } from '../test/fixtures';
import { renderPage, stubApi } from '../test/renderPage';

import { TourDetailPage } from './TourDetailPage';

/**
 * The tour's own page.
 *
 * There is nothing to compare against: every card in the handoff links to `#`, so no detail
 * page was ever drawn. What is worth asserting is the behaviour a page reached by a link from
 * anywhere has to get right — the programme it exists for, a wrong address answered honestly,
 * and an enquiry that says which tour it is about.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

async function render(payload: unknown = tourDetail()) {
  stubApi({ '/global/tours/': payload, '/forms/token': formToken() });
  return renderPage(<TourDetailPage lang="ru" slug="klassicheskiy-turkmenistan" />, {
    path: '/ru/tours/klassicheskiy-turkmenistan',
  });
}

describe('a tour detail page', () => {
  it('renders the programme day by day', async () => {
    await render();

    expect(await screen.findByText('Программа по дням')).toBeInTheDocument();
    expect(screen.getByText('День 1')).toBeInTheDocument();
    expect(screen.getByText('Прилёт в Ашхабад')).toBeInTheDocument();
    expect(screen.getByText('День 2')).toBeInTheDocument();
  });

  it('splits the body into paragraphs instead of rendering it as markup', async () => {
    const { container } = await render();

    // `dangerouslySetInnerHTML` on an editor-written column would make every admin account one
    // stored script away from every visitor's session, for markup nobody has asked for.
    await screen.findByText('Первый абзац о маршруте.');
    expect(container.querySelectorAll('p')).not.toHaveLength(0);
    expect(screen.getByText('Второй абзац, отделённый пустой строкой.')).toBeInTheDocument();
  });

  it('answers a slug that no longer exists with the not-found page, not a retry', async () => {
    // `stubApi` answers an unstubbed route with the API's own 404 envelope.
    stubApi({ '/forms/token': formToken() });
    await renderPage(<TourDetailPage lang="ru" slug="net-takogo" />, {
      path: '/ru/tours/net-takogo',
    });

    // «Проверьте соединение и попробуйте ещё раз» would send somebody to restart their router
    // over a tour that was simply unpublished.
    expect(await screen.findByText('Страница не найдена')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Повторить' })).not.toBeInTheDocument();
  });

  it('tells the manager which page the enquiry came from, in the open', async () => {
    await render();

    // Rendered above the fields as well as prepended to the message: an enquiry should not
    // carry anything the sender cannot see.
    expect(
      await screen.findByText('Заявка со страницы «Классический Туркменистан»'),
    ).toBeInTheDocument();
  });

  it('prices per person and says so, rather than implying a total', async () => {
    await render(tourDetail({ prices: [] }));

    expect(await screen.findByText('Стоимость')).toBeInTheDocument();
    expect(screen.getByText(/За человека при двухместном размещении/)).toBeInTheDocument();
  });
});

describe('what the price covers', () => {
  it('prints what a party of one pays and what a party of two pays', async () => {
    await render();

    expect(await screen.findByText('1 человек')).toBeInTheDocument();
    expect(screen.getByText('2 человека')).toBeInTheDocument();
    // The plural agrees with the number rather than being «2 человек», which is what a single
    // hard-coded word would have produced.
    expect(screen.getByText(/1 000/)).toBeInTheDocument();
    expect(screen.getByText(/930/)).toBeInTheDocument();
  });

  it('drops the hedge once it can name the figure', async () => {
    /*
     * «Итог зависит от дат и числа гостей» is what the page says when it cannot say what the
     * total is. With the tiers on screen it is an apology for an answer already given, and two
     * sentences about the same thing is how a reader learns to skip both.
     */
    await render();

    await screen.findByText('1 человек');
    expect(screen.getByText(/Чем больше группа, тем ниже цена/)).toBeInTheDocument();
    expect(screen.queryByText(/Итог зависит от дат/)).not.toBeInTheDocument();
  });

  it('lists what is included and what is not, as two lists rather than one', async () => {
    await render();

    expect(await screen.findByText('Что входит в стоимость')).toBeInTheDocument();
    expect(screen.getByText('Что не входит')).toBeInTheDocument();
    expect(screen.getByText('Профессиональный англоговорящий гид')).toBeInTheDocument();
    expect(screen.getByText('Страховка')).toBeInTheDocument();
  });

  it('says nothing at all about the composition when nobody has written one', async () => {
    // Eight of the nine demo tours have neither list. A heading over an empty column reads as a
    // page that failed to load rather than as a tour whose sheet has not been typed in yet.
    await render(tourDetail({ included: [], excluded: [], prices: [] }));

    await screen.findByText('Программа по дням');
    expect(screen.queryByText('Что входит в стоимость')).not.toBeInTheDocument();
    expect(screen.queryByText('Что не входит')).not.toBeInTheDocument();
  });

  it('renders a day written as a list as a list, not as one run-on sentence', async () => {
    const { container } = await render(
      tourDetail({
        itinerary: [
          {
            dayNumber: 1,
            title: 'Куняургенч — Дарваза',
            description: 'Встреча гида на границе.\nОбед в Дашогузе.\nНочь в юртовом лагере.',
            city: 'Дарваза',
            media: null,
          },
        ],
      }),
    );

    await screen.findByText('Куняургенч — Дарваза');
    // Three items, each its own line: run together, «Обед в Дашогузе.» lands in the middle of a
    // sentence about the border.
    expect(screen.getByText('Обед в Дашогузе.')).toBeInTheDocument();
    expect(container.querySelectorAll('ol li ul li')).toHaveLength(3);
  });
});
