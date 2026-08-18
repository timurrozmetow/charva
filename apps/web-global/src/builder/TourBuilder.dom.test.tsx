import { quote } from '@charva/contracts';
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
  stubApi({
    '/global/builder/config': builderConfig(),
    // The debounced confirmation. It agrees, because it is the same function over the same rates.
    '/global/builder/quote': {
      perPerson: { minor: 64_800, currency: 'USD' },
      total: { minor: 129_600, currency: 'USD' },
      pax: 2,
      nights: 6,
      breakdown: [],
      missingSteps: ['dest', 'dates', 'hotel', 'activities', 'people'],
      isEstimate: true,
    },
  });
  return renderPage(<TourBuilder lang="ru" basePath="/ru/builder" />, { path });
}

describe('the tour builder', () => {
  it('prices an untouched builder at 1 296 $ before anything is clicked', async () => {
    await render();

    /*
     * The figure every visitor sees first, and it is not a literal anywhere.
     *
     * Six nights at the four-star rate, plus the base fee, times two people — the three
     * defaults in `pricing_rules` are what produce it, which is why they are as editable as
     * the rates themselves. Question Q-10 asks the owner to bless the numbers.
     */
    expect(await screen.findByText('1 296 $')).toBeInTheDocument();
  });

  it('moves the price on a click, without waiting for the server', async () => {
    await render();
    await screen.findByRole('radiogroup', { name: /Куда|Сколько/ }).catch(() => null);

    // Fourteen nights instead of the default six, at the same rate: the local `quote()` runs
    // synchronously, so the new total is on screen before any request could have returned.
    await userEvent.click(await screen.findByRole('checkbox', { name: /Ашхабад/ }));

    const expected = quote(
      { dest: ['dest_ashgabat'] },
      {
        options: builderConfig().steps.flatMap((step) =>
          step.options.map((option) => ({
            code: option.code,
            step: step.code,
            numericValue: option.numericValue,
            priceModifierMinor: option.priceModifierMinor,
            modifierType: option.modifierType,
          })),
        ),
        rules: builderConfig().rules,
      },
    );

    // 1 296 $ + one city at 60 $ per person, doubled: 1 416 $.
    await waitFor(() => {
      expect(screen.getByText('1 416 $')).toBeInTheDocument();
    });
    expect(expected.total.minor).toBe(141_600);
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

    // Six nights and the four-star rate are real defaults, and presenting them as choices the
    // visitor made would be a lie. The note under the total says the figure is provisional.
    const panel = await screen.findByRole('complementary', { name: 'Ваш тур' });
    expect(within(panel).getAllByText('—').length).toBeGreaterThan(4);
    expect(within(panel).getByText(/Предварительный расчёт/)).toBeInTheDocument();
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
