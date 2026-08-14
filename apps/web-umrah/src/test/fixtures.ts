import {
  type FormTokenResponse,
  type UmrahGroupsResponse,
  type UmrahSettingsResponse,
  type UmrahTrip,
  type ZiyaratPlace,
  type ZiyaratResponse,
} from '@charva/contracts';

/**
 * Fixtures shaped like the real API, because the schemas are shared.
 *
 * Typed against the contracts the server serialises with, so a field renamed on the server is a
 * compile error here rather than a test that keeps passing against a shape nothing produces.
 */

/** A departure far enough in the future that the countdown is unambiguous. */
export function trip(overrides: Partial<UmrahTrip> = {}): UmrahTrip {
  return {
    id: 1,
    departAt: '2099-09-18T06:00:00.000Z',
    returnAt: '2099-09-28T18:00:00.000Z',
    signupClosesAt: '2099-09-04T00:00:00.000Z',
    durationDays: 10,
    seatsTotal: 45,
    seatsTaken: 33,
    seatsLeft: 12,
    // 33 of 45 — the number the prototype draws as a bar of literally `width: 73%`.
    seatsPercent: 73.3,
    status: 'open',
    signupOpen: true,
    hotelMekka: '4 ★, Haremden 400 m',
    hotelMedina: '4 ★, Haremden 300 m',
    ...overrides,
  };
}

export function place(overrides: Partial<ZiyaratPlace> = {}): ZiyaratPlace {
  return {
    id: 1,
    slug: 'masjid-al-haram',
    name: 'Masjid al-Haram',
    description: 'Mekgedäki Beýik metjit.',
    city: 'mekge',
    durationLabel: '4 gün',
    cover: null,
    ...overrides,
  };
}

/**
 * The ziyarat list, with Jidda present in both the rows and the facets.
 *
 * Jidda is the whole point of this fixture: the prototype has a place there and no chip for it,
 * so a ninth of the places is unreachable by any filter. Decision D-15.
 */
export function ziyarat(overrides: Partial<ZiyaratResponse> = {}): ZiyaratResponse {
  return {
    items: [
      place(),
      place({ id: 2, slug: 'masjid-an-nabawi', name: 'Masjid an-Nabawi', city: 'medine' }),
      place({ id: 3, slug: 'bedir', name: 'Bedir söweş meýdany', city: 'bedir' }),
      place({ id: 4, slug: 'jidda-kenar', name: 'Jidda — deňiz kenary', city: 'jidda' }),
    ],
    facets: {
      cities: [
        { code: 'mekge', label: 'mekge', count: 1 },
        { code: 'medine', label: 'medine', count: 1 },
        { code: 'bedir', label: 'bedir', count: 1 },
        { code: 'jidda', label: 'jidda', count: 1 },
      ],
    },
    ...overrides,
  };
}

export function groups(overrides: Partial<UmrahGroupsResponse> = {}): UmrahGroupsResponse {
  return {
    items: [
      {
        id: 1,
        slug: 'iyun26',
        label: 'Iýun aýyndaky toparymyz',
        shortLabel: 'Iýun 2026',
        description: '',
        departedOn: '2026-06-12',
        pilgrimsCount: 44,
        cover: null,
        // Counted, never stored: the prototype claims four videos beside three clips.
        photoCount: 38,
        videoCount: 3,
      },
    ],
    meta: { page: 1, perPage: 6, total: 1, totalPages: 1, hasMore: false },
    stats: { groups: 6, pilgrims: 248, photos: 208, videos: 18 },
    ...overrides,
  };
}

export function settings(overrides: Partial<UmrahSettingsResponse> = {}): UmrahSettingsResponse {
  return {
    contacts: {
      phone: '+993 12 456 789',
      whatsapp: '+993 65 123 456',
      email: 'umrah@charvatravel.com',
      hours: 'Du–Şe, 09:00–18:00',
      address: 'Aşgabat, Bitarap Türkmenistan 42',
    },
    socials: { instagram: '#', telegram: '#', whatsapp: '#', youtube: '#' },
    legal: { license: 'TM-1428', unconfirmed: true },
    langs: ['tm', 'ru'],
    defaultLang: 'tm',
    ...overrides,
  };
}

export function formToken(overrides: Partial<FormTokenResponse> = {}): FormTokenResponse {
  return { token: 'stub.token.signature', expiresInSeconds: 7200, ...overrides };
}
