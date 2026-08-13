import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { renderWithRouter } from '../test/renderWithRouter';

import { ChoiceNav } from './ChoiceNav';

/**
 * The language chooser, which in the prototypes switches nothing.
 *
 * Its menu changes only its own label — the headings, the lead and the chips stay Russian in
 * every language — and it does not close on Escape, does not close when you click elsewhere,
 * and never returns focus to the button. Here each entry is a real link to a real URL, so a
 * translation can be shared, bookmarked, opened in a new tab and crawled.
 */

describe('ChoiceNav', () => {
  it('offers the four languages the chooser supports, as links', async () => {
    await renderWithRouter(<ChoiceNav lang="ru" />);

    await userEvent.click(screen.getByRole('button', { name: /Язык/ }));

    for (const [name, href] of [
      ['Русский', '/ru'],
      ['English', '/en'],
      ['Türkçe', '/tr'],
      ['Türkmen', '/tm'],
    ]) {
      expect(screen.getByRole('link', { name: new RegExp(name!) })).toHaveAttribute('href', href!);
    }
  });

  it('marks the language already in the URL', async () => {
    await renderWithRouter(<ChoiceNav lang="tm" />, { path: '/tm' });
    await userEvent.click(screen.getByRole('button', { name: /Dil/ }));

    // `page` rather than `true`: the router supplies it, and it is the more specific of the two
    // — each language really is a page, and a screen reader announces it as «current page».
    expect(screen.getByRole('link', { name: /Türkmen/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /English/ })).not.toHaveAttribute('aria-current');
  });

  it('opens and closes from the keyboard alone', async () => {
    await renderWithRouter(<ChoiceNav lang="ru" />);
    const trigger = screen.getByRole('button', { name: /Язык/ });

    await userEvent.tab();
    await userEvent.tab();
    expect(trigger).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Escape closes it and puts focus back where it came from — neither happens in the
    // prototype, where the open list simply hangs over the page until a reload.
    await userEvent.keyboard('{Escape}');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('labels the switcher in the language being read', async () => {
    await renderWithRouter(<ChoiceNav lang="tm" />, { path: '/tm' });
    expect(screen.getByRole('button', { name: /Dil/ })).toBeInTheDocument();
  });

  it('gives the logo an accessible name that says where it goes', async () => {
    await renderWithRouter(<ChoiceNav lang="ru" />);
    expect(screen.getByRole('link', { name: 'На главную Charva' })).toBeInTheDocument();
  });
});
