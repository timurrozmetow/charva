import { eq } from 'drizzle-orm';

import { type Database } from '../client';
import * as t from '../schema';

/**
 * Content the operator actually sells, as opposed to the prototype's demo catalogue.
 *
 * Everything in `seed.ts` came out of the design package: nine tours, nine hotels and nine
 * reviews invented to fill a layout. This file is the other kind — a real tour sheet, with a real
 * itinerary and real prices, and it lives here so that the two are never confused. The demo rows
 * are meant to be deleted the week the site goes live; these are not.
 *
 * In the seeds and not in a migration, deliberately. A migration reaches a database that already
 * has an admin account and uploaded media, which is tempting — but the test harness rebuilds the
 * catalogue by wiping the tables and re-running the seeder, so anything a migration inserted
 * disappears the first time a suite asks for a clean database. Content that has to survive a
 * rebuild belongs where the rebuild reads from. In production the same content arrives through
 * the admin panel, which is what the admin panel is for.
 *
 * The English is the tour sheet's, near enough verbatim. The Russian is a translation, and it
 * exists because Russian is this site's default language and the one page with real content
 * should not be the one page that is empty. Turkish is left out rather than guessed — that is
 * question Q-3.
 */

interface DaySource {
  title: [ru: string, en: string];
  city: [ru: string, en: string];
  /** One line per item. The sheet writes days as lists, and the page renders them as lists. */
  lines: [ru: string[], en: string[]];
}

const TURKMENISTAN_DAYS: DaySource[] = [
  {
    title: ['Куняургенч (Хива) — Дарваза — Ашхабад', 'Koneurgench (Khiva) – Darvaza – Ashgabat'],
    city: ['Дарваза', 'Darvaza'],
    lines: [
      [
        'Встреча с англоговорящим гидом на границе у Хивы, прохождение таможни.',
        'Прибытие в Дашогуз, обед в местном кафе.',
        'Переезд через пустыню Каракумы к газовому кратеру Дарваза.',
        'Прибытие в Дарвазу: «Врата ада» и традиционный ужин «газанлама» у светящегося кратера.',
        'Ночь в юртовом лагере под звёздами пустыни.',
      ],
      [
        'Meet our English-speaking guide at the Khiva border and pass customs.',
        'Arrive at Dashoguz and have lunch in a local cafe.',
        'Continue through the Karakum Desert to the Darvaza gas crater.',
        'Arrive at Darvaza, admire the “Gates of Hell” and enjoy a traditional “gazanlama” dinner near the glowing crater.',
        'Overnight stay in a yurt camp under the desert stars.',
      ],
    ],
  },
  {
    title: ['Дарваза — Ашхабад — Старая Ниса', 'Darvaza – Ashgabat – Old Nisa'],
    city: ['Ашхабад', 'Ashgabat'],
    lines: [
      [
        'Завтрак у кратера, встреча рассвета.',
        'Переезд в Ашхабад.',
        'Заселение в отель, время на отдых.',
        'Обед в местном ресторане.',
        'Старая Ниса — древняя парфянская крепость и объект Всемирного наследия ЮНЕСКО.',
        'Мечеть Сапармурат Рухы и мемориальный комплекс «Халк хакыдасы» в Бекреве.',
        'Ашхабадский ипподром и знаменитые ахалтекинские кони.',
        'Ночь в Ашхабаде.',
      ],
      [
        'Breakfast near the crater. Enjoy the sunrise at the crater.',
        'Drive to Ashgabat.',
        'Hotel check-in in Ashgabat. Rest time.',
        'Have lunch in a local restaurant.',
        'Visit Old Nisa, the ancient Parthian fortress and UNESCO heritage site.',
        'Explore Saparmurat Ruhy Mosque and the Halk Hakydasy Memorial Complex in Bekrewe.',
        'Visit the Ashgabat Hippodrome to see the world-famous Ahalteke horses.',
        'Overnight stay in Ashgabat.',
      ],
    ],
  },
  {
    title: ['Ашхабад — обзорная экскурсия', 'Ashgabat — city tour'],
    city: ['Ашхабад', 'Ashgabat'],
    lines: [
      [
        'Обзорная экскурсия по Ашхабаду.',
        'Столица, её характерная архитектура и городская атмосфера.',
      ],
      [
        'City tour of Ashgabat.',
        'Explore the capital city and enjoy its distinctive architecture and city atmosphere.',
      ],
    ],
  },
  {
    title: ['Ашхабад — Янги-Кала — Туркменбаши', 'Ashgabat – Yangi Kala – Turkmenbashi'],
    city: ['Туркменбаши', 'Turkmenbashi'],
    lines: [
      [
        'Ранний завтрак в отеле, выезд к Янги-Кала.',
        'Каньоны Янги-Кала в 165 км к северу от Балканабата и в 160 км к востоку от Туркменбаши. «Янги-Кала» переводится с туркменского как «Огненная крепость»: обточенные ветром и дождями обрывы — белые, жёлтые, охристые, фиолетовые и красные, похожие на каменные замки.',
        'Обед.',
        'Гёзли-Ата — одно из самых удалённых мест паломничества в Туркменистане, среди гряд розового и белого камня. Гёзли-Ата был почитаемым суфием начала XIV века; его мавзолей — кирпичное здание с двумя белыми куполами на старом кладбище с резными каменными надгробиями.',
        'Переезд в отель в Туркменбаши.',
        'Ночь в Туркменбаши.',
      ],
      [
        'Early breakfast at the hotel. Drive to Yangi Kala.',
        'Visit the picturesque Yangi Kala canyons, located 165 km north of Balkanabat and 160 km east of Turkmenbashi. “Yangi Kala” translates from Turkmen as “Fiery Fortress”. The cliffs, carved by winds and rains, display colours of white, yellow, ocher, violet and red, resembling stone castles from fantasy.',
        'Enjoy lunch.',
        'Next, visit Gözli Ata, one of Turkmenistan’s most remote pilgrimage sites, surrounded by bands of pink and white stone escarpments. Gözli Ata was a respected Sufi who lived in the early 14th century. His mausoleum is a brick building with two white domes, standing in an old cemetery with many beautifully carved stone tombs.',
        'Drive to the hotel in Turkmenbashi.',
        'Overnight stay in Turkmenbashi.',
      ],
    ],
  },
  {
    title: ['Туркменбаши — граница Гарабогаз', 'Turkmenbashi – Garabogaz border'],
    city: ['Туркменбаши', 'Turkmenbashi'],
    lines: [
      [
        'Ранний завтрак в отеле.',
        'Местные базары Туркменбаши.',
        'Переезд в национальную туристическую зону «Аваза»: день у моря, курортная инфраструктура и прогулка по набережным.',
        'Прибытие на границу Гарабогаз.',
        'Переход границы Гарабогаз в сторону Актау (Казахстан).',
      ],
      [
        'Early breakfast at the hotel.',
        'Visit local bazaars in Turkmenbashi.',
        'Transfer to the Awaza National Tourist Zone. Spend the day relaxing by the sea, enjoying the resort amenities, or walking along the modern promenades.',
        'Arrive at the Garabogaz border.',
        'Transfer to the Garabogaz border crossing to Aktau in Kazakhstan.',
      ],
    ],
  },
];

const INCLUDED: [ru: string, en: string][] = [
  ['Профессиональный англоговорящий гид', 'Professional English-speaking guide'],
  ['Визовое приглашение (LOI)', 'Letter of Invitation (LOI)'],
  ['Проживание: отель и юртовый лагерь', 'Accommodation: hotel and camp'],
  ['Транспорт', 'Transportation'],
  ['Входные билеты', 'Entry tickets'],
  ['Питание', 'Meals'],
];

const EXCLUDED: [ru: string, en: string][] = [
  [
    'Визовый сбор — примерно 75–100 $ в зависимости от гражданства, и ПЦР-тест 35 $. В сумме ориентировочно 130–150 $ с человека. Суммы приблизительные и могут немного отличаться.',
    'Visa fee — approximately $75–$100 depending on nationality; PCR test $35. In total, you may expect around $130–$150 per person. Please note that these are approximate amounts and may vary slightly.',
  ],
  ['Банковская комиссия за миграционный сбор', 'Migration tax bank fee'],
  [
    'Личные расходы и чаевые: сувениры, покупки, стирка, звонки, алкоголь. Дополнительные экскурсии и активности вне программы.',
    'Private expenses and gratuities: souvenirs, shopping, laundry, phone calls, alcohol. Optional excursions or activities not included in the programme.',
  ],
  ['Страховка', 'Insurance'],
];

/**
 * Per person, in cents, falling as the party grows.
 *
 * A guide and a car cost the same whether they carry one traveller or four, which is why the
 * per-person figure drops rather than the total. `price_from_minor` on the tour is the last of
 * these and not something smaller: «от 830 $» has to be a price somebody can actually pay.
 */
const PRICES: [pax: number, minor: number][] = [
  [1, 100_000],
  [2, 93_000],
  [3, 87_000],
  [4, 83_000],
];

export const TURKMENISTAN_SLUG = 'turkmenistan-5-days';

export async function seedOwnerTours(db: Database): Promise<number> {
  await db.insert(t.tours).values({
    slug: TURKMENISTAN_SLUG,
    title: { ru: 'Туркменистан за 5 дней', en: 'Turkmenistan in 5 days' },
    summary: {
      ru: 'Продуманный маршрут по Туркменистану: пустынные пейзажи, древнее наследие, архитектура Ашхабада и берег Каспия.',
      en: 'A curated journey through Turkmenistan, combining desert landscapes, ancient heritage, Ashgabat architecture and the Caspian coast.',
    },
    body: {
      ru: 'Хива • Дарваза • Ашхабад • Янги-Кала • Туркменбаши\n\n5 дней и 4 ночи — от границы с Узбекистаном до границы с Казахстаном. Ночь в юртовом лагере у газового кратера Дарваза, две ночи в Ашхабаде и ночь в Туркменбаши на Каспии.',
      en: 'Khiva • Darvaza • Ashgabat • Yangi Kala • Turkmenbashi\n\nFive days and four nights, from the Uzbek border to the Kazakh one. A night in a yurt camp beside the Darvaza gas crater, two nights in Ashgabat and a night in Turkmenbashi on the Caspian.',
    },
    category: 'classic',
    days: 5,
    // The five the sheet names in its own subtitle, not every place the coach passes through.
    cities: 5,
    // The sheet says «Hotel, camp» and no class. Guessing four stars here would put a number on
    // the page that nobody has promised.
    hotelStars: null,
    priceFromMinor: 83_000,
    priceCurrency: 'USD',
    isFeatured: true,
    isPublished: true,
    // Ahead of the nine demo rows, which start at one.
    sortOrder: 0,
  });

  const [tour] = await db
    .select({ id: t.tours.id })
    .from(t.tours)
    .where(eq(t.tours.slug, TURKMENISTAN_SLUG))
    .limit(1);

  if (tour === undefined) throw new Error(`the ${TURKMENISTAN_SLUG} tour did not insert`);

  await db.insert(t.tourDays).values(
    TURKMENISTAN_DAYS.map((day, index) => ({
      tourId: tour.id,
      dayNumber: index + 1,
      title: { ru: day.title[0], en: day.title[1] },
      description: { ru: day.lines[0].join('\n'), en: day.lines[1].join('\n') },
      city: { ru: day.city[0], en: day.city[1] },
    })),
  );

  await db.insert(t.tourInclusions).values([
    ...INCLUDED.map(([ru, en], index) => ({
      tourId: tour.id,
      kind: 'included' as const,
      text: { ru, en },
      sortOrder: (index + 1) * 10,
    })),
    ...EXCLUDED.map(([ru, en], index) => ({
      tourId: tour.id,
      kind: 'excluded' as const,
      text: { ru, en },
      sortOrder: (index + 1) * 10,
    })),
  ]);

  await db
    .insert(t.tourPrices)
    .values(PRICES.map(([pax, minor]) => ({ tourId: tour.id, pax, priceMinor: minor })));

  return 1;
}
