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
    await render();

    expect(await screen.findByText('Стоимость')).toBeInTheDocument();
    expect(screen.getByText(/За человека при двухместном размещении/)).toBeInTheDocument();
  });
});
