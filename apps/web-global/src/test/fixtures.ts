import { type GlobalSettingsResponse, type TourCard, type ToursResponse } from '@charva/contracts';

/**
 * Fixtures shaped like the real API, because the schemas are shared.
 *
 * These are typed against the contracts the server serialises with, so a field renamed on the
 * server is a compile error in this file rather than a test that keeps passing against a shape
 * nothing produces any more.
 */

export function tour(overrides: Partial<TourCard> = {}): TourCard {
  return {
    id: 1,
    slug: 'klassicheskiy-turkmenistan',
    title: 'Классический Туркменистан',
    summary: 'Ашхабад, Ниса, Мерв и ночь у кратера Дарваза.',
    tag: 'Хит',
    category: 'classic',
    days: 8,
    cities: 5,
    hotelStars: 4,
    priceFrom: { minor: 119_000, currency: 'USD' },
    cover: null,
    isFeatured: true,
    ...overrides,
  };
}

export function toursResponse(overrides: Partial<ToursResponse> = {}): ToursResponse {
  const items = overrides.items ?? [
    tour(),
    tour({
      id: 2,
      slug: 'karakumy-i-darvaza',
      title: 'Каракумы и Дарваза',
      tag: 'Пустыня',
      category: 'nature',
      days: 3,
      cities: 2,
      hotelStars: null,
      priceFrom: { minor: 54_000, currency: 'USD' },
    }),
    tour({
      id: 3,
      slug: 'shelkovyy-put',
      title: 'Шёлковый путь: Мерв и Куняургенч',
      tag: 'История',
      category: 'history',
      days: 6,
      cities: 3,
      priceFrom: { minor: 87_000, currency: 'USD' },
    }),
  ];

  return {
    items,
    meta: { page: 1, perPage: 9, total: 9, totalPages: 1, hasMore: false },
    facets: {
      categories: [
        { code: 'classic', label: 'classic', count: 2 },
        { code: 'nature', label: 'nature', count: 2 },
        { code: 'history', label: 'history', count: 1 },
      ],
    },
    ...overrides,
  };
}

export function settings(overrides: Partial<GlobalSettingsResponse> = {}): GlobalSettingsResponse {
  return {
    contacts: {
      phone: '+993 12 456 789',
      whatsapp: '+993 65 123 456',
      email: 'info@charvatravel.com',
      hours: 'Пн–Сб, 09:00–18:00',
      address: 'Ашхабад, Битарап Туркменистан 42',
    },
    socials: { instagram: '#', telegram: '#', whatsapp: '#', youtube: '#' },
    legal: { license: 'TM-1428', unconfirmed: true },
    langs: ['ru', 'en', 'tr'],
    defaultLang: 'ru',
    ...overrides,
  };
}
