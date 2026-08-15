import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getAccessToken } from '../api/client';
import { useSession } from '../auth/SessionProvider';
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
