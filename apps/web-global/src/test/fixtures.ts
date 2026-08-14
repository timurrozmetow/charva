import {
  type ArticleDetail,
  type FaqResponse,
  type FormTokenResponse,
  type GlobalHomeResponse,
  type GlobalSettingsResponse,
  type HotelCard,
  type HotelDetail,
  type TourCard,
  type TourDetail,
  type ToursResponse,
} from '@charva/contracts';

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

export function tourDetail(overrides: Partial<TourDetail> = {}): TourDetail {
  return {
    ...tour(),
    body: 'Первый абзац о маршруте.\n\nВторой абзац, отделённый пустой строкой.',
    itinerary: [
      {
        dayNumber: 1,
        title: 'Прилёт в Ашхабад',
        description: 'Встреча в аэропорту, отель, вечерняя прогулка.',
        city: 'Ашхабад',
        media: null,
      },
      {
        dayNumber: 2,
        title: 'Ниса и Ахалтекинцы',
        description: 'Парфянская крепость и конный завод.',
        city: 'Ахал',
        media: null,
      },
    ],
    gallery: [],
    related: [],
    ...overrides,
  };
}

export function hotel(overrides: Partial<HotelCard> = {}): HotelCard {
  return {
    id: 1,
    slug: 'yyldyz-hotel',
    name: 'Ýyldyz Hotel',
    summary: 'Центр Ашхабада, бассейн и вид на город.',
    city: 'Ашхабад',
    stars: 5,
    category: 'hotel',
    filterKey: '5star',
    priceFrom: { minor: 14_500, currency: 'USD' },
    cover: null,
    amenities: [
      { code: 'pool', name: 'Бассейн', icon: null },
      { code: 'wifi', name: 'Wi-Fi', icon: null },
    ],
    ...overrides,
  };
}

export function hotelDetail(overrides: Partial<HotelDetail> = {}): HotelDetail {
  return { ...hotel(), body: 'Описание отеля.', ...overrides };
}

export function articleDetail(overrides: Partial<ArticleDetail> = {}): ArticleDetail {
  return {
    id: 1,
    slug: 'kover-kak-pasport',
    title: 'Ковёр как паспорт страны',
    summary: 'Пять гёлей на флаге — это пять племён.',
    tag: 'Культура',
    readMinutes: 6,
    publishedAt: '2026-05-14',
    cover: null,
    isFeatured: true,
    body: 'Абзац первый.\n\nАбзац второй.',
    related: [],
    ...overrides,
  };
}

export function faq(overrides: Partial<FaqResponse> = {}): FaqResponse {
  return {
    items: [
      { id: 1, question: 'Нужна ли виза?', answer: 'Для большинства стран — да.' },
      { id: 2, question: 'Когда лучше ехать?', answer: 'Апрель–май и сентябрь–октябрь.' },
    ],
    ...overrides,
  };
}

export function formToken(overrides: Partial<FormTokenResponse> = {}): FormTokenResponse {
  return { token: 'stub.token.signature', expiresInSeconds: 7200, ...overrides };
}

/**
 * The homepage payload.
 *
 * Deliberately sparse: what the tests care about is that the counters come from `stats` rather
 * than from a literal, and that the hero is built from the places, so the rest is empty arrays.
 */
export function home(overrides: Partial<GlobalHomeResponse> = {}): GlobalHomeResponse {
  return {
    featuredTours: [tour()],
    hotels: [hotel()],
    articles: [],
    gallery: [],
    videos: [],
    reviews: [],
    reviewSummary: { average: 4.8, total: 9, recommendPercent: 100 },
    facts: [],
    visaSteps: [],
    places: [
      {
        id: 1,
        slug: 'darvaza',
        name: 'Кратер Дарваза',
        region: 'Каракумы',
        description: '',
        cover: null,
      },
      {
        id: 2,
        slug: 'yangykala',
        name: 'Каньоны Йангыкала',
        region: 'Балкан',
        description: '',
        cover: null,
      },
    ],
    faq: [],
    slots: [
      {
        slotKey: 'g-hero-1',
        brief: 'Газовый кратер Дарваза ночью — широкий кадр',
        recommendedWidth: 2400,
        recommendedHeight: null,
        media: null,
      },
    ],
    stats: { tours: 9, hotels: 9, reviews: 9, places: 6 },
    ...overrides,
  };
}
