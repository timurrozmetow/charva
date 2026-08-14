import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { faq, formToken, settings } from '../test/fixtures';
import { renderPage, stubApi } from '../test/renderPage';

import { ContactPage } from './ContactPage';

/**
 * The enquiry page.
 *
 * The prototype's two tabs change nothing at all — the fields are identical either way, and
 * `SCREENS.md` records the question as open. They are resolved by making the tab mean something,
 * so that is what these tests are about.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

async function render(path = '/ru/contact') {
  stubApi({
    '/global/settings': settings(),
    '/global/faq': faq(),
    '/forms/token': formToken(),
  });
  return renderPage(<ContactPage lang="ru" />, { path });
}

describe('the contact page', () => {
  it('makes the tab mean something: a question has no party size', async () => {
    const user = userEvent.setup();
    await render();

    expect(await screen.findByLabelText(/^Гостей/)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Общий вопрос' }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/^Гостей/)).not.toBeInTheDocument();
    });
  });

  it('puts the chosen tab in the URL, and the default one nowhere', async () => {
    const user = userEvent.setup();
    const { router } = await render();

    await user.click(await screen.findByRole('tab', { name: 'Общий вопрос' }));
    await waitFor(() => {
      expect(router.state.location.searchStr).toContain('kind=question');
    });

    // One page, one address: «заявка на тур» is the default and never reaches the address bar.
    await user.click(screen.getByRole('tab', { name: 'Заявка на тур' }));
    await waitFor(() => {
      expect(router.state.location.searchStr).not.toContain('kind');
    });
  });

  it('reads the tab back out of the URL, so a shared link opens the right form', async () => {
    await render('/ru/contact?kind=question');

    const tab = await screen.findByRole('tab', { name: 'Общий вопрос' });
    expect(tab).toHaveAttribute('aria-selected', 'true');
  });

  it('takes the phone number from settings rather than from the copy files', async () => {
    await render();

    // The prototype types it into two files with two different e-mail domains — question Q-12.
    const link = await screen.findByRole('link', { name: '+993 12 456 789' });
    expect(link).toHaveAttribute('href', 'tel:+99312456789');
  });

  it('opens the first FAQ row and keeps the rest collapsed', async () => {
    await render();

    expect(await screen.findByText('Для большинства стран — да.')).toBeInTheDocument();
    // The prototype leaves every answer in the DOM and merely restyles the border, so a screen
    // reader reads all six straight through as though the accordion were not there.
    expect(screen.queryByText('Апрель–май и сентябрь–октябрь.')).not.toBeInTheDocument();
  });
});
