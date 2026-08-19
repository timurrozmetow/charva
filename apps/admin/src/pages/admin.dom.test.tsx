import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAccessToken } from '../api/client';
import { useSession } from '../auth/SessionProvider';
import { Shell } from '../layout/Shell';
import {
  OWNER,
  renderPage,
  sessionFor,
  StubFailure,
  stubApi,
  type StubbedCall,
} from '../test/renderPage';

import { LeadsPage, SignupsPage } from './InboxPage';
import { ResourceFormPage } from './ResourceFormPage';
import { ResourceListPage } from './ResourceListPage';
import { SlotsPage } from './SlotsPage';

/**
 * The admin, from the browser's side.
 *
 * Two properties are worth these tests more than the rest. First, that the screens really are
 * built from `/admin/resources` — a form whose fields came from a hand-written list would pass
 * a snapshot and fail the day a migration lands. Second, that a capability the account does not
 * have is not offered: the server refuses regardless, but a button that appears and then errors
 * is worse than one that was never there.
 */

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The tours resource, as the API describes it. */
const TOURS = {
  name: 'tours',
  site: 'global',
  capability: 'content.write',
  search: ['slug'],
  filters: [],
  orderable: true,
  fields: [
    {
      name: 'id',
      kind: 'int',
      required: false,
      nullable: false,
      readOnly: true,
      maxLength: null,
      enumValues: null,
    },
    {
      name: 'slug',
      kind: 'string',
      required: true,
      nullable: false,
      readOnly: false,
      maxLength: 160,
      enumValues: null,
    },
    {
      name: 'title',
      kind: 'localized',
      required: true,
      nullable: false,
      readOnly: false,
      maxLength: null,
      enumValues: null,
    },
    {
      name: 'priceFromMinor',
      kind: 'money',
      required: true,
      nullable: false,
      readOnly: false,
      maxLength: null,
      enumValues: null,
    },
    {
      name: 'isPublished',
      kind: 'boolean',
      required: false,
      nullable: false,
      readOnly: false,
      maxLength: null,
      enumValues: null,
    },
    {
      name: 'priceCurrency',
      kind: 'enum',
      required: false,
      nullable: false,
      readOnly: false,
      maxLength: null,
      enumValues: ['USD', 'TMT'],
    },
  ],
};

const RESOURCES = { resources: [TOURS] };

const emptyMeta = { page: 1, perPage: 25, total: 0, totalPages: 1, hasMore: false };

function callsTo(calls: StubbedCall[], fragment: string): StubbedCall[] {
  return calls.filter((call) => call.url.includes(fragment));
}

describe('the list screen', () => {
  it('shows rows with the title from whichever language has one', async () => {
    stubApi({
      '/admin/auth/refresh': sessionFor(),
      '/admin/resources': RESOURCES,
      '/admin/tours': {
        items: [
          { id: 7, slug: 'darvaza', title: { ru: 'Дарваза' }, isPublished: true, sortOrder: 1 },
          { id: 8, slug: 'merv', title: { en: 'Merv' }, isPublished: false, sortOrder: 2 },
        ],
        meta: { ...emptyMeta, total: 2 },
      },
    });

    await renderPage(<ResourceListPage resource="tours" />);

    expect(await screen.findByText('Дарваза')).toBeInTheDocument();
    // Falls back to the language that is filled rather than showing «#8».
    expect(screen.getByText('Merv')).toBeInTheDocument();
    expect(screen.getByText('Черновик')).toBeInTheDocument();
  });

  it('hides «добавить» from an account that cannot write', async () => {
    stubApi({
      '/admin/auth/refresh': sessionFor({
        role: 'manager',
        capabilities: ['content.read', 'leads.read', 'leads.write'],
      }),
      '/admin/resources': RESOURCES,
      '/admin/tours': { items: [], meta: emptyMeta },
    });

    await renderPage(<ResourceListPage resource="tours" />);

    await waitFor(() => {
      expect(screen.getByText('Здесь пока ничего нет')).toBeInTheDocument();
    });
    // The server refuses a manager's POST anyway; this is about not offering it.
    expect(screen.queryByRole('link', { name: 'Добавить' })).not.toBeInTheDocument();
  });
});

describe('the form screen', () => {
  it('builds its fields from the resource description, not from a hand-written list', async () => {
    stubApi({
      '/admin/auth/refresh': sessionFor(),
      '/admin/resources': RESOURCES,
      '/admin/tours/7': {
        id: 7,
        slug: 'darvaza',
        title: { ru: 'Дарваза', en: 'Darvaza' },
        priceFromMinor: 129600,
        isPublished: true,
        priceCurrency: 'USD',
      },
    });

    await renderPage(<ResourceFormPage resource="tours" id={7} />);

    expect(await screen.findByLabelText(/Слаг/)).toHaveValue('darvaza');
    // A money column shows as a number with the note that it is in minor units — the one place
    // an editor could otherwise type 1296 and mean 1 296 dollars.
    expect(screen.getByLabelText(/Цена от/)).toHaveValue(129600);
    expect(screen.getByLabelText(/Опубликовано/)).toBeChecked();
    expect(screen.getByLabelText(/Валюта/)).toHaveValue('USD');
    // Read-only, because the database writes it: shown as text, with no control to edit it.
    expect(screen.queryByRole('textbox', { name: /^ID/ })).toBeNull();
    expect(screen.getByText('Заполняется базой')).toBeInTheDocument();
  });

  it('gives a translated column one tab per language the site speaks', async () => {
    stubApi({
      '/admin/auth/refresh': sessionFor(),
      '/admin/resources': RESOURCES,
      '/admin/tours/7': { id: 7, slug: 'darvaza', title: { ru: 'Дарваза' } },
    });

    await renderPage(<ResourceFormPage resource="tours" id={7} />);

    const tabs = await screen.findAllByRole('tab');
    // Global speaks three. Umrah would show two, and neither would show four.
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  });

  it('sends only the field that changed', async () => {
    const calls = stubApi({
      '/admin/auth/refresh': sessionFor(),
      '/admin/resources': RESOURCES,
      '/admin/tours/7': {
        id: 7,
        slug: 'darvaza',
        title: { ru: 'Дарваза' },
        priceFromMinor: 129600,
        isPublished: true,
        priceCurrency: 'USD',
      },
    });

    await renderPage(<ResourceFormPage resource="tours" id={7} />);

    const slug = await screen.findByLabelText(/Слаг/);
    await userEvent.clear(slug);
    await userEvent.type(slug, 'darvaza-crater');
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(callsTo(calls, '/admin/tours/7').some((call) => call.method === 'PATCH')).toBe(true);
    });

    const patch = callsTo(calls, '/admin/tours/7').find((call) => call.method === 'PATCH');
    // Not every column: a one-word edit that resent the whole row would read, in the audit log,
    // as a rewrite of everything.
    expect(patch?.body).toEqual({ slug: 'darvaza-crater' });
    expect(patch?.authorization).toBe('Bearer test.token.value');
  });
});

describe('the photograph checklist', () => {
  it('counts what is filled and shows the brief for what is not', async () => {
    stubApi({
      '/admin/auth/refresh': sessionFor(),
      '/admin/resources': RESOURCES,
      '/admin/content_slots': {
        items: [
          {
            id: 1,
            site: 'umrah',
            page: 'home',
            slotKey: 'u-hero-1',
            brief: 'Паломники у автобуса на рассвете',
            recommendedWidth: 1600,
            recommendedHeight: 900,
            sortOrder: 0,
            media: null,
          },
        ],
        meta: { ...emptyMeta, total: 1 },
        progress: { filled: 12, total: 174 },
      },
    });

    await renderPage(<SlotsPage />);

    // The number that makes Q-1 a task rather than a sentence in a risk table.
    expect(await screen.findByText(/12/)).toBeInTheDocument();
    expect(screen.getByText('Паломники у автобуса на рассвете')).toBeInTheDocument();
  });
});

describe('the inbox', () => {
  it('shows an enquiry with the price the server worked out', async () => {
    stubApi({
      '/admin/auth/refresh': sessionFor(),
      '/admin/resources': RESOURCES,
      '/admin/leads': {
        items: [
          {
            id: 3,
            kind: 'builder',
            name: 'Мерджен',
            phone: '+99365123456',
            email: null,
            guests: 2,
            topics: null,
            message: 'Интересует тур',
            locale: 'ru',
            consentAt: '2026-08-01T10:00:00.000Z',
            selection: null,
            quoteSnapshot: { total: { minor: 129600, currency: 'USD' } },
            status: 'new',
            adminNotes: null,
            createdAt: '2026-08-01T10:00:00.000Z',
          },
        ],
        meta: { ...emptyMeta, total: 1 },
      },
    });

    await renderPage(<LeadsPage />);

    expect(await screen.findByText('Мерджен')).toBeInTheDocument();
    // Formatted by the one function allowed to format money, from the snapshot the server
    // computed — never from a number a browser sent.
    expect(screen.getByText(/1\s296\s?\$/)).toBeInTheDocument();
  });

  it('offers the passport only to an account that may read one', async () => {
    const signup = {
      id: 5,
      tripId: 1,
      fullName: 'Aýgül',
      phone: '+99365000000',
      hasPassport: true,
      peopleCount: 2,
      roomType: 'double',
      comment: null,
      locale: 'tm',
      consentAt: null,
      status: 'new',
      adminNotes: null,
      createdAt: '2026-08-01T10:00:00.000Z',
    };

    stubApi({
      '/admin/auth/refresh': sessionFor({
        role: 'manager',
        capabilities: ['content.read', 'leads.read', 'leads.write'],
      }),
      '/admin/resources': RESOURCES,
      '/admin/umrah_signups': { items: [signup], meta: { ...emptyMeta, total: 1 } },
    });

    await renderPage(<SignupsPage />);

    expect(await screen.findByText('Aýgül')).toBeInTheDocument();
    // Q-14's default, seen from the browser: the manager is told there is one and cannot ask.
    expect(screen.queryByRole('button', { name: 'Показать номер' })).not.toBeInTheDocument();
    expect(screen.getByText('Скрыт')).toBeInTheDocument();
  });

  it('asks the owner why before it asks the server', async () => {
    const calls = stubApi({
      '/admin/auth/refresh': sessionFor(),
      '/admin/resources': RESOURCES,
      '/admin/umrah_signups': {
        items: [
          {
            id: 5,
            tripId: 1,
            fullName: 'Aýgül',
            phone: '+99365000000',
            hasPassport: true,
            peopleCount: 1,
            roomType: null,
            comment: null,
            locale: 'tm',
            consentAt: null,
            status: 'new',
            adminNotes: null,
            createdAt: '2026-08-01T10:00:00.000Z',
          },
        ],
        meta: { ...emptyMeta, total: 1 },
      },
      '/passport': { passportNumber: 'AB1234567', recordedAt: '2026-08-01T10:05:00.000Z' },
    });

    await renderPage(<SignupsPage />);

    await userEvent.click(await screen.findByRole('button', { name: 'Показать номер' }));

    const confirm = screen.getByRole('button', { name: 'Показать' });
    // Nothing has been asked for yet, and the button says so until there is a reason.
    expect(confirm).toBeDisabled();
    expect(callsTo(calls, '/passport')).toHaveLength(0);

    await userEvent.type(screen.getByLabelText(/Зачем он нужен/), 'Оформление визы');
    await userEvent.click(confirm);

    expect(await screen.findByText('AB1234567')).toBeInTheDocument();
    expect(callsTo(calls, '/passport')[0]?.body).toEqual({ reason: 'Оформление визы' });
  });
});

describe('the session', () => {
  it('shows the login screen when there is no cookie to exchange', async () => {
    stubApi({ '/admin/auth/refresh': new StubFailure(401, 'unauthorized') });

    const { getByRole } = await renderPage(<LoginProbe />);
    await waitFor(() => {
      expect(getByRole('status')).toHaveTextContent('anonymous');
    });
  });

  it('signs in and keeps the token out of storage', async () => {
    const stored = vi.spyOn(Storage.prototype, 'setItem');
    stubApi({ '/admin/auth/refresh': sessionFor(), '/admin/resources': RESOURCES });

    await renderPage(<LoginProbe />);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('signed-in');
    });
    expect(screen.getByRole('status')).toHaveTextContent(OWNER.name);

    // Fifteen minutes of authority, held in a variable. `localStorage` would hand it to any
    // script on the page and keep it after the tab closed — so nothing writes to either store.
    expect(stored).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe('test.token.value');
    stored.mockRestore();
  });
});

/** A minimal consumer, so the session can be asserted without a whole screen in the way. */
function LoginProbe() {
  const session = useSession();
  return (
    <p role="status">
      {session.state} {session.user?.name ?? ''}
    </p>
  );
}

/** One resource per site, plus the table both of them edit. */
const DEPARTMENT_RESOURCES = {
  resources: [
    TOURS,
    { ...TOURS, name: 'umrah_trips', site: 'umrah' },
    { ...TOURS, name: 'content_blocks', site: null, filters: ['site'] },
    { ...TOURS, name: 'settings', site: null },
  ],
};

describe('the departments', () => {
  /*
   * The sidebar used to show all twenty-one tables at once in four flat groups, and the
   * complaint was the obvious one: somebody who only maintains the pilgrimage read past the
   * tour catalogue every time. Grouping is not separating.
   */
  it('shows one site at a time and switches between them', async () => {
    const user = userEvent.setup();
    stubApi({ '/admin/auth/refresh': sessionFor(), '/admin/resources': DEPARTMENT_RESOURCES });

    await renderPage(<Shell />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Туры' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'Рейсы' })).not.toBeInTheDocument();
    // Global's inbox is its own; the pilgrimage's signups are not in the way.
    expect(screen.getByRole('link', { name: 'Обращения' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Записи на умру' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Умра' }));

    expect(screen.getByRole('link', { name: 'Рейсы' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Туры' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Записи на умру' })).toBeInTheDocument();
  });

  it('switches from a screen that already belongs to a department', async () => {
    /*
     * The reported failure, exactly: «не нажимается».
     *
     * The switcher used to remember a choice and use it only when the URL said nothing about a
     * department — and the URL says something on every screen but the overview, so on any real
     * screen the click changed a variable nobody read. Now it navigates, and the menu follows
     * the address.
     */
    const user = userEvent.setup();
    stubApi({
      '/admin/auth/refresh': sessionFor(),
      '/admin/resources': DEPARTMENT_RESOURCES,
      '/admin/tours': { items: [], meta: emptyMeta },
    });

    await renderPage(<Shell />, { path: '/data/tours' });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Туры' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('link', { name: 'Умра' }));

    expect(screen.getByRole('link', { name: 'Рейсы' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Туры' })).not.toBeInTheDocument();
  });

  it('narrows the table the two sites share to the department that opened it', async () => {
    const user = userEvent.setup();
    stubApi({ '/admin/auth/refresh': sessionFor(), '/admin/resources': DEPARTMENT_RESOURCES });

    await renderPage(<Shell />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Текстовые блоки' })).toBeInTheDocument();
    });

    // `content_blocks` holds Umrah's package composition beside Global's visa steps, so the
    // link a department offers has to carry its own site or it opens the other one's rows.
    expect(screen.getByRole('link', { name: 'Текстовые блоки' })).toHaveAttribute(
      'href',
      expect.stringContaining('site=global'),
    );

    await user.click(screen.getByRole('link', { name: 'Умра' }));
    expect(screen.getByRole('link', { name: 'Текстовые блоки' })).toHaveAttribute(
      'href',
      expect.stringContaining('site=umrah'),
    );
  });

  it('keeps what both sites share out of either of them', async () => {
    const user = userEvent.setup();
    stubApi({ '/admin/auth/refresh': sessionFor(), '/admin/resources': DEPARTMENT_RESOURCES });

    await renderPage(<Shell />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Туры' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: 'Медиатека' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Общее' }));
    expect(screen.getByRole('link', { name: 'Медиатека' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Настройки' })).toBeInTheDocument();
    // And the shared table is not listed twice: the departments already reach it.
    expect(screen.queryByRole('link', { name: 'Текстовые блоки' })).not.toBeInTheDocument();
  });
});

/** A field description, with the parts a test does not care about filled in. */
function field(name: string, kind: string, extra: Record<string, unknown> = {}) {
  return {
    name,
    kind,
    required: false,
    nullable: true,
    readOnly: false,
    maxLength: null,
    enumValues: null,
    ...extra,
  };
}

const TOUR_DAYS = {
  name: 'tour_days',
  site: 'global',
  capability: 'content.write',
  search: [],
  filters: [],
  orderable: true,
  fields: [
    field('id', 'int', { readOnly: true }),
    field('tourId', 'int', { required: true }),
    field('dayNumber', 'int'),
    field('title', 'localized'),
    field('coverMediaId', 'int'),
    field('isPublished', 'boolean'),
    field('createdAt', 'timestamp', { readOnly: true }),
  ],
};

describe('a row as a person reads it', () => {
  /*
   * The list printed the primary key and one title. For `tour_days` that is «День: 3» beside
   * twenty other rows reading «День: 3» — true, and useless — and for a tour it was a name with
   * nothing to tell two of them apart.
   */
  it('names the row and shows facts from its own columns', async () => {
    stubApi({
      '/admin/auth/refresh': sessionFor(),
      '/admin/resources': RESOURCES,
      '/admin/media': { items: [], meta: emptyMeta },
      '/admin/tours': {
        items: [
          {
            id: 7,
            slug: 'darvaza',
            title: { ru: 'Дарваза' },
            priceFromMinor: 54000,
            priceCurrency: 'USD',
            isPublished: false,
            sortOrder: 1,
          },
        ],
        meta: { ...emptyMeta, total: 1 },
      },
    });

    await renderPage(<ResourceListPage resource="tours" />);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Дарваза' })).toBeInTheDocument();
    });

    // The money is money, with the site's currency, rather than 54000 minor units.
    expect(screen.getByText(/540/)).toBeInTheDocument();
    expect(screen.getByText('Черновик')).toBeInTheDocument();
    // And it says where to look at the result — «не видно результата».
    expect(screen.getByRole('link', { name: /На сайте/ })).toHaveAttribute(
      'href',
      expect.stringContaining('/ru/tours/darvaza'),
    );
  });

  it('titles the form with the row, not with its primary key', async () => {
    stubApi({
      '/admin/auth/refresh': sessionFor(),
      '/admin/resources': RESOURCES,
      '/admin/media': { items: [], meta: emptyMeta },
      '/admin/tours/7': { id: 7, slug: 'darvaza', title: { ru: 'Дарваза' }, priceFromMinor: 54000 },
    });

    await renderPage(<ResourceFormPage resource="tours" id={7} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /Дарваза/ })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { level: 1, name: /#7/ })).not.toBeInTheDocument();
  });

  it('offers a photograph and a parent by name, never their numbers', async () => {
    stubApi({
      '/admin/auth/refresh': sessionFor(),
      '/admin/resources': { resources: [TOURS, TOUR_DAYS] },
      '/admin/media': { items: [], meta: emptyMeta },
      '/admin/tours': {
        items: [{ id: 7, slug: 'darvaza', title: { ru: 'Дарваза' } }],
        meta: { ...emptyMeta, total: 1 },
      },
      '/admin/tour_days/3': { id: 3, tourId: 7, dayNumber: 2, title: { ru: 'Кратер' } },
    });

    await renderPage(<ResourceFormPage resource="tour_days" id={3} />);

    // `tourId` was a number box: attaching a day to a tour meant knowing the tour was number 7.
    await waitFor(() => {
      expect(screen.getByLabelText(/^Тур/)).toBeInTheDocument();
    });
    const parent = screen.getByLabelText(/^Тур/);
    expect(parent.tagName).toBe('SELECT');
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Дарваза' })).toBeInTheDocument();
    });

    // And the cover is chosen from the library rather than typed as an id.
    expect(screen.getByRole('button', { name: 'Выбрать файл' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Обложка/)).not.toBeInTheDocument();
  });

  it('keeps the generated columns out of the way instead of in the middle of the form', async () => {
    stubApi({
      '/admin/auth/refresh': sessionFor(),
      '/admin/resources': { resources: [TOURS, TOUR_DAYS] },
      '/admin/media': { items: [], meta: emptyMeta },
      '/admin/tours': { items: [], meta: emptyMeta },
      '/admin/tour_days/3': { id: 3, tourId: 7, dayNumber: 2, createdAt: '2026-08-01T10:00:00Z' },
    });

    const { container } = await renderPage(<ResourceFormPage resource="tour_days" id={3} />);

    await waitFor(() => {
      expect(screen.getByText('Содержание')).toBeInTheDocument();
    });
    // `id` and `createdAt` are still reachable — an editor sometimes needs the number — but
    // folded away rather than sitting between the title and the price.
    const details = container.querySelector('details');
    expect(details).not.toBeNull();
    expect(details).toHaveTextContent('Служебное');
    expect(details?.open).toBe(false);
  });
});
