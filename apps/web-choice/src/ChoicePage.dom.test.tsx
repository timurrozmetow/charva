import { type ChoiceResponse } from '@charva/contracts';
import { splitDuration } from '@charva/ui';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChoicePage } from './ChoicePage';
import { renderWithRouter } from './test/renderWithRouter';

/**
 * The chooser as a whole.
 *
 * The headline assertion is the day count: this page and the Umrah homepage must never disagree
 * about how far away the departure is. In the prototypes they do, by one day, because Choice
 * rounds up and the Umrah homepage rounds down. Both now go through `splitDuration`, and this
 * suite checks the rendered number against that one function rather than against a literal.
 */

const DEPART = '2030-01-01T06:00:00.000Z';

function payload(overrides: Partial<ChoiceResponse> = {}): ChoiceResponse {
  return {
    umrah: {
      trip: {
        id: 1,
        departAt: DEPART,
        returnAt: '2030-01-11T06:00:00.000Z',
        signupClosesAt: '2029-12-18T06:00:00.000Z',
        durationDays: 10,
        seatsTotal: 45,
        seatsTaken: 33,
        seatsLeft: 12,
        seatsPercent: 73.3,
        status: 'open',
        signupOpen: true,
        hotelMekka: '',
        hotelMedina: '',
      },
    },
    stats: {
      global: { tours: 9, hotels: 9, guestsPerYear: null },
      umrah: { seatsTotal: 45, groups: 6, pilgrims: 168 },
    },
    contacts: {
      global: { phone: '', whatsapp: '', email: '', hours: '', address: '' },
      umrah: { phone: '', whatsapp: '', email: '', hours: '', address: '' },
    },
    legal: { license: 'TM-1428', unconfirmed: true },
    // Empty by default, which is the state this page shipped in for months — see the slot test
    // below, and `photographs behind the halves` for the other half of the story.
    slots: [],
    ...overrides,
  };
}

/** A slot with a photograph in it, shaped as the API returns one. */
function slot(slotKey: string, url: string): ChoiceResponse['slots'][number] {
  return {
    slotKey,
    brief: 'бриф',
    recommendedWidth: null,
    recommendedHeight: null,
    media: {
      url,
      alt: 'Туркменистан',
      width: 1600,
      height: 2000,
      lqip: null,
      focalX: null,
      focalY: null,
    },
  };
}

async function renderPage(data: ChoiceResponse = payload()) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify(data), { status: 200 }))),
  );
  return renderWithRouter(<ChoicePage lang="ru" />);
}

beforeEach(() => {
  // A fixed clock: the day count is derived arithmetic and must be reproducible, not a number
  // that changes as the suite ages towards the departure.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date('2029-11-24T12:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the chooser', () => {
  it('shows both halves without waiting for the network', async () => {
    // The copy is in the bundle; only six figures and the badge come from the API. A visitor
    // who came to click «Global» must never wait for a database to render the button.
    await renderPage();
    expect(screen.getByRole('heading', { name: 'Путешествие в Туркменистан' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Умра с туркменской группой' })).toBeInTheDocument();
  });

  it('counts the days with the same function the Umrah site uses', async () => {
    await renderPage();

    const remaining = Date.parse(DEPART) - Date.now();
    const expected = splitDuration(remaining).days;

    await waitFor(() => {
      expect(screen.getByText(String(expected))).toBeInTheDocument();
    });

    /*
     * 37.75 days remain, and the two roundings disagree about what that means.
     *
     * The prototype's chooser rounds up and its Umrah homepage rounds down, so the same
     * departure reads 38 days away on one page and 37 on the other. Everything now goes through
     * `splitDuration`, which floors — the honest reading, because 37 whole days is what is left.
     */
    expect(expected).toBe(37);
    expect(Math.ceil(remaining / 86_400_000)).toBe(38);
  });

  it('takes the seats in the group from the departure, not from a literal', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('Мест в группе')).toBeInTheDocument();
    });
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  it('drops a figure nothing counts rather than inventing one', async () => {
    // «1 400+ Гостей в год» has no source in the schema. D-6 says a marketing number becomes an
    // explicit override in `settings` or it does not appear; it must never be typed into a
    // component where nobody can correct it. Question Q-5.
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('Маршрута')).toBeInTheDocument();
    });
    expect(screen.queryByText('Гостей в год')).not.toBeInTheDocument();
    expect(screen.queryByText(/1 400/)).not.toBeInTheDocument();
  });

  it('shows the guest figure once somebody records one', async () => {
    await renderPage(
      payload({
        stats: {
          global: { tours: 9, hotels: 9, guestsPerYear: 1400 },
          umrah: { seatsTotal: 45, groups: 6, pilgrims: 168 },
        },
      }),
    );
    await waitFor(() => {
      expect(screen.getByText('Гостей в год')).toBeInTheDocument();
    });
    // Grouped with a non-breaking space, the same separator `formatMoney` uses.
    /*
     * Found by its normalised text, then checked for the character normalisation hides.
     *
     * Testing Library collapses a non-breaking space to an ordinary one before matching, so a
     * matcher alone cannot tell the two apart — and the separator is the whole point: `1 400`
     * must never break across two lines, the same rule `formatMoney` follows for prices.
     */
    const guests = screen.getByText('1 400');
    expect(guests.textContent).toBe('1 400');
  });

  it('leaves the countdown out entirely when there is no departure', async () => {
    await renderPage(payload({ umrah: { trip: null } }));
    await waitFor(() => {
      expect(screen.getByText('Следующая группа скоро')).toBeInTheDocument();
    });
    expect(screen.queryByText('Дней до вылета')).not.toBeInTheDocument();
  });

  it('gives each half one link and names it by its heading', async () => {
    // The whole half is the target. `aria-labelledby` keeps the accessible name to the heading
    // rather than the entire panel, which is otherwise read out as one enormous link.
    await renderPage();
    const links = screen.getAllByRole('link');
    const halves = links.filter((link) => link.getAttribute('href')?.startsWith('http'));
    expect(halves).toHaveLength(2);
    expect(halves[0]).toHaveAccessibleName('Путешествие в Туркменистан');
    expect(halves[1]).toHaveAccessibleName('Умра с туркменской группой');
  });

  it('does not print the «01» and «02» numerals', async () => {
    /*
     * They were here, under decision D-1: the prototype's data arrays were populated while its
     * render bodies were empty, which reads as a truncated export rather than a design change,
     * so the numerals were restored. The owner has since asked for them gone — see D-128.
     *
     * The assertion survives the removal rather than being deleted with it, because a restored
     * decoration is exactly the kind of thing that comes back in a later «fixing the design»
     * commit, and it would come back silently.
     */
    const { container } = await renderPage();
    const numerals = [...container.querySelectorAll('[aria-hidden="true"]')]
      .map((node) => node.textContent)
      .filter((text) => text === '01' || text === '02');
    expect(numerals).toEqual([]);
  });

  it('renders the section chips the export dropped', async () => {
    await renderPage();
    for (const chip of ['Туры', 'Сборщик туров', 'Отели', 'Экскурсии']) {
      expect(screen.getByText(chip)).toBeInTheDocument();
    }
    for (const chip of ['Мекка', 'Медина', 'Бадр', 'Ухуд']) {
      expect(screen.getByText(chip)).toBeInTheDocument();
    }
    // «Виза» is the fifth chip on both halves — the one word the two lists share.
    expect(screen.getAllByText('Виза')).toHaveLength(2);
  });

  it('renders the bottom line the markup leaves empty', async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText('Лицензия TM-1428')).toBeInTheDocument();
    });
    expect(screen.getByText('Выберите направление')).toBeInTheDocument();
  });

  it('keeps a photograph slot for each half while there are no photographs', async () => {
    // 174 rows in `content_slots` and not one image (D-21, D-45, Q-1). Each half renders at its
    // real proportions with its own brief rather than collapsing.
    const { container } = await renderPage();
    expect(container.querySelector('[data-slot="choice-global"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="choice-umrah"]')).not.toBeNull();
  });

  it('shows the photograph once the slot has one', async () => {
    /*
     * The gap this closes was total rather than partial.
     *
     * `ChoiceHalf` had `media={null}` written into it and `/choice` returned no slots at all, so
     * the two pictures this page is mostly made of could not appear however full the database
     * was. Nothing was broken — the path from a photograph to this page did not exist.
     */
    const { container } = await renderPage(
      payload({
        slots: [
          slot('choice-global', '/api/v1/uploads/global.webp'),
          slot('choice-umrah', '/api/v1/uploads/umrah.webp'),
        ],
      }),
    );

    const half = container.querySelector('[data-slot="choice-global"] img');
    expect(half?.getAttribute('src')).toContain('global.webp');
    expect(
      container.querySelector('[data-slot="choice-umrah"] img')?.getAttribute('src'),
    ).toContain('umrah.webp');
  });

  it('renders when the request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline'))),
    );
    await renderWithRouter(<ChoicePage lang="ru" />);

    expect(screen.getByRole('heading', { name: 'Путешествие в Туркменистан' })).toBeInTheDocument();
    // No badge text asserting a state it does not know, and no stat rendered as a dash.
    await waitFor(() => {
      expect(screen.getByText('Следующая группа скоро')).toBeInTheDocument();
    });
    expect(screen.queryByText('Маршрута')).not.toBeInTheDocument();
  });
});
