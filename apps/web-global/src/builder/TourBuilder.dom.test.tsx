import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { builderConfig } from '../test/builderFixture';
import { renderPage, stubApi } from '../test/renderPage';

import { TourBuilder } from './TourBuilder';

/**
 * The builder.
 *
 * The price on screen comes from `quote()` in `@charva/contracts` — the same pure function the
 * server runs — so the assertions here are about the machine around it: that a click moves the
 * number without a round trip, that the selection ends up in the URL, and that nine steps are
 * reachable from a keyboard. The arithmetic itself, and its agreement with the server over
 * twenty random selections, is proven in `apps/api/src/modules/builder/builder.db.test.ts`.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

async function render(path = '/ru/builder') {
  // One call, and no quote: the site does not price a selection any more, so there is no
  // second endpoint to stub and no round trip on a click.
  stubApi({ '/global/builder/config': builderConfig() });
  return renderPage(<TourBuilder lang="ru" basePath="/ru/builder" />, { path });
}

describe('the tour builder', () => {
  it('quotes nothing, and says who will', async () => {
    /*
     * Inverted, not deleted. These two used to assert «1 296 $» before a click and «1 416 $»
     * after one — the figure the local `quote()` produced from the rates in `pricing_rules`.
     *
     * The owner took the price off the site on 2026-09-11: an operator works a selection out
     * and sends it. The figure was worth losing on its own merits too — the rates behind it are
     * the designer's invention and Q-10 never confirmed them, so «1 296 $» was a made-up number
     * wearing the authority of a total, shown to every visitor before they touched anything.
     *
     * What replaces it is the assertion that no currency reaches the panel at all. Naming the
     * old totals would pass while some *other* price crept in; a sweep for the symbol does not.
     */
    await render();
    const panel = await screen.findByRole('complementary', { name: 'Ваш тур' });

    await userEvent.click(await screen.findByRole('checkbox', { name: /Ашхабад/ }));
    await waitFor(() => {
      expect(within(panel).getByText('Ашхабад')).toBeInTheDocument();
    });

    // Any currency, not the two totals that used to be here: naming them would pass while
    // some other price crept in, and a sweep for the symbols cannot.
    expect(panel.textContent).not.toMatch(/[$€₽]|TMT|USD/);
    expect(within(panel).getByText(/рассчитает оператор/)).toBeInTheDocument();
  });

  it('reads the counts back, because those are what was chosen', async () => {
    // Nights and people survive the price going: they are facts about the trip the visitor
    // described, not commercial terms, and the operator needs them read back.
    await render();
    const panel = await screen.findByRole('complementary', { name: 'Ваш тур' });

    expect(within(panel).getByText('Ночей')).toBeInTheDocument();
    // `getAllByText` for it, because the panel says it twice on purpose — once as the step
    // whose answer is echoed, once as the count that answer resolves to.
    expect(within(panel).getAllByText('Человек').length).toBeGreaterThan(0);
  });

  it('puts the selection in the URL so a half-built tour can be sent to somebody', async () => {
    const { router } = await render();

    await userEvent.click(await screen.findByRole('checkbox', { name: /Дарваза/ }));

    await waitFor(() => {
      expect(router.state.location.searchStr).toContain('dest=dest_darvaza');
    });
  });

  it('carries only option codes, never a price', async () => {
    // A stable ASCII code survives an editor renaming «3 ★» in the admin; the prototype keys its
    // rate table by the display string, where the rename silently reprices the tour (D-10).
    const { router } = await render();

    await userEvent.click(await screen.findByRole('checkbox', { name: /Ашхабад/ }));
    await waitFor(() => {
      expect(router.state.location.searchStr).toContain('dest_ashgabat');
    });
    expect(router.state.location.searchStr).not.toMatch(/\d{4,}/);
  });

  it('clears a single-choice answer when the same option is clicked again', async () => {
    const { router } = await render('/ru/builder?step=1');

    const seven = await screen.findByRole('radio', { name: /7 дней/ });
    await userEvent.click(seven);
    await waitFor(() => {
      expect(router.state.location.searchStr).toContain('dates=nights_7');
    });

    // The prototype's behaviour, and the only way to un-answer a step that has no «none» option.
    await userEvent.click(seven);
    await waitFor(() => {
      expect(router.state.location.searchStr).not.toContain('nights_7');
    });
  });

  it('adds and removes from a multiple-choice step', async () => {
    const { router } = await render();

    await userEvent.click(await screen.findByRole('checkbox', { name: /Ашхабад/ }));
    await userEvent.click(await screen.findByRole('checkbox', { name: /Дарваза/ }));
    await waitFor(() => {
      expect(router.state.location.searchStr).toContain('dest_ashgabat%2Cdest_darvaza');
    });

    await userEvent.click(screen.getByRole('checkbox', { name: /Ашхабад/ }));
    await waitFor(() => {
      expect(router.state.location.searchStr).not.toContain('dest_ashgabat');
    });
  });

  it('lets «Без питания» stand alone, because it is not a kind of food', async () => {
    /*
     * The step is multiple-choice and its answers are not all the same kind of thing. Halal,
     * vegetarian and gluten-free are restrictions; national and European are preferences; and
     * «Без питания» is the answer that the question does not apply. Nothing stopped the three
     * being held at once — a request for halal food and for no food.
     *
     * Which options behave this way is `builder_options.is_exclusive`, so a seventh one is a
     * row an editor adds rather than a branch somebody writes here.
     */
    const { router } = await render('/ru/builder?step=3');

    await userEvent.click(await screen.findByRole('checkbox', { name: /Халяль/ }));
    await userEvent.click(await screen.findByRole('checkbox', { name: /Национальная/ }));
    await waitFor(() => {
      expect(router.state.location.searchStr).toContain('food_halal%2Cfood_national');
    });

    // Ticking it clears the rest.
    await userEvent.click(await screen.findByRole('checkbox', { name: /Без питания/ }));
    await waitFor(() => {
      expect(router.state.location.searchStr).toContain('food=food_none');
    });
    expect(router.state.location.searchStr).not.toContain('food_halal');

    // And ticking a real answer withdraws it.
    await userEvent.click(await screen.findByRole('checkbox', { name: /Халяль/ }));
    await waitFor(() => {
      expect(router.state.location.searchStr).toContain('food=food_halal');
    });
    expect(router.state.location.searchStr).not.toContain('food_none');
  });

  it('tells assistive technology which options are chosen', async () => {
    // The prototype draws every option as a `<div>` with a click handler, so on nine
    // consecutive screens a screen-reader user cannot tell which of six is selected.
    await render();
    const option = await screen.findByRole('checkbox', { name: /Ашхабад/ });
    expect(option).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(option);
    await waitFor(() => {
      expect(option).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('lets every step be reached from the rail, in any order', async () => {
    // Deliberate: somebody who only wants to know what fourteen days costs should be able to
    // answer step two and read the estimate without walking through step one.
    const { router } = await render();

    const rail = await screen.findByRole('navigation', { name: 'Шаги сборщика' });
    await userEvent.click(within(rail).getByRole('button', { name: /Человек/ }));

    await waitFor(() => {
      expect(screen.getByText('Шаг 7 из 9')).toBeInTheDocument();
    });
    expect(router.state.location.searchStr).toContain('step=6');
  });

  it('counts progress over the eight steps that take an answer', async () => {
    await render();
    expect(await screen.findByText('Заполнено 0 из 8')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: /Ашхабад/ }));
    await waitFor(() => {
      expect(screen.getByText('Заполнено 1 из 8')).toBeInTheDocument();
    });
  });

  it('leaves an unanswered line blank rather than showing the default it is using', async () => {
    await render();

    // Six nights and two people are real defaults, and presenting them as choices the visitor
    // made would be a lie — so the step lines stay blank while the counts show what is being
    // assumed. The note underneath used to say the total was provisional; now it says who works
    // the price out, which is the same job done honestly rather than a figure hedged.
    const panel = await screen.findByRole('complementary', { name: 'Ваш тур' });
    expect(within(panel).getAllByText('—').length).toBeGreaterThan(4);
    expect(within(panel).getByText(/рассчитает оператор/)).toBeInTheDocument();
  });

  it('is fully operable from the keyboard', async () => {
    await render();
    await screen.findByRole('checkbox', { name: /Ашхабад/ });

    // Tab to the first option and choose it with the space bar. In the prototype none of the
    // nine steps can be reached without a mouse at all.
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();

    const focused = document.activeElement;
    expect(focused?.tagName).toBe('BUTTON');
  });
});
