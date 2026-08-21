import { eq } from 'drizzle-orm';

import { type Database } from '../client';
import * as t from '../schema';
import { type LocalizedColumn } from '../schema/shared';

/**
 * Content the operator actually sells, as opposed to the prototype's demo catalogue.
 *
 * Everything in `seed.ts` came out of the design package: nine tours, nine hotels and nine
 * reviews invented to fill a layout. This file is the other kind — a real tour sheet, with a real
 * itinerary and real prices, and it lives here so the two are never confused. The demo rows are
 * meant to be deleted the week the site goes live; these are not.
 *
 * In the seeds and not in a migration, deliberately. A migration reaches a database that already
 * has an admin account and uploaded media, which is tempting — but the test harness rebuilds the
 * catalogue by wiping the tables and re-running the seeder, so anything a migration inserted
 * disappears the first time a suite asks for a clean database. Content that has to survive a
 * rebuild belongs where the rebuild reads from. In production the same content arrives through
 * the admin panel, which is what the admin panel is for.
 *
 * All three of Global's languages, because the owner asked for all three. The English is the tour
 * sheet's own, near enough verbatim; the Russian and the Turkish are translations of it. Place
 * names follow each language's usual spelling rather than a single transliteration — «Ашхабад»,
 * `Ashgabat`, `Aşkabat` are one city, and a Turkish reader meeting `Ashgabat` on a Turkish page
 * learns that nobody read it.
 */

/** One translated string in the three languages Global offers. */
type Text = Required<Pick<LocalizedColumn, 'ru' | 'en' | 'tr'>>;

interface DaySource {
  title: Text;
  /** Where the night is spent — the fact somebody scanning the left column is looking for. */
  city: Text;
  /** One line per item. The sheet writes days as lists, and the page renders them as lists. */
  lines: { ru: string[]; en: string[]; tr: string[] };
}

const lines = (source: DaySource['lines']): Text => ({
  ru: source.ru.join('\n'),
  en: source.en.join('\n'),
  tr: source.tr.join('\n'),
});

const TURKMENISTAN_DAYS: DaySource[] = [
  {
    title: {
      ru: 'Куняургенч (Хива) — Дарваза — Ашхабад',
      en: 'Koneurgench (Khiva) – Darvaza – Ashgabat',
      tr: 'Köneürgenç (Hive) – Darvaza – Aşkabat',
    },
    city: { ru: 'Дарваза', en: 'Darvaza', tr: 'Darvaza' },
    lines: {
      ru: [
        'Встреча с англоговорящим гидом на границе у Хивы, прохождение таможни.',
        'Прибытие в Дашогуз, обед в местном кафе.',
        'Переезд через пустыню Каракумы к газовому кратеру Дарваза.',
        'Прибытие в Дарвазу: «Врата ада» и традиционный ужин «газанлама» у светящегося кратера.',
        'Ночь в юртовом лагере под звёздами пустыни.',
      ],
      en: [
        'Meet our English-speaking guide at the Khiva border and pass customs.',
        'Arrive at Dashoguz and have lunch in a local cafe.',
        'Continue through the Karakum Desert to the Darvaza gas crater.',
        'Arrive at Darvaza, admire the “Gates of Hell” and enjoy a traditional “gazanlama” dinner near the glowing crater.',
        'Overnight stay in a yurt camp under the desert stars.',
      ],
      tr: [
        'Hive sınırında İngilizce konuşan rehberimizle buluşma ve gümrük işlemleri.',
        'Daşoğuz’a varış, yerel bir kafede öğle yemeği.',
        'Karakum Çölü üzerinden Darvaza gaz kraterine geçiş.',
        'Darvaza’ya varış: “Cehennem Kapısı” ve kor hâlindeki kraterin yanında geleneksel “gazanlama” akşam yemeği.',
        'Çöl yıldızlarının altında çadır kampında gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Дарваза — Ашхабад — Старая Ниса',
      en: 'Darvaza – Ashgabat – Old Nisa',
      tr: 'Darvaza – Aşkabat – Eski Nisa',
    },
    city: { ru: 'Ашхабад', en: 'Ashgabat', tr: 'Aşkabat' },
    lines: {
      ru: [
        'Завтрак у кратера, встреча рассвета.',
        'Переезд в Ашхабад.',
        'Заселение в отель, время на отдых.',
        'Обед в местном ресторане.',
        'Старая Ниса — древняя парфянская крепость и объект Всемирного наследия ЮНЕСКО.',
        'Мечеть Сапармурат Рухы и мемориальный комплекс «Халк хакыдасы» в Бекреве.',
        'Ашхабадский ипподром и знаменитые ахалтекинские кони.',
        'Ночь в Ашхабаде.',
      ],
      en: [
        'Breakfast near the crater. Enjoy the sunrise at the crater.',
        'Drive to Ashgabat.',
        'Hotel check-in in Ashgabat. Rest time.',
        'Have lunch in a local restaurant.',
        'Visit Old Nisa, the ancient Parthian fortress and UNESCO heritage site.',
        'Explore Saparmurat Ruhy Mosque and the Halk Hakydasy Memorial Complex in Bekrewe.',
        'Visit the Ashgabat Hippodrome to see the world-famous Ahalteke horses.',
        'Overnight stay in Ashgabat.',
      ],
      tr: [
        'Kraterin yanında kahvaltı ve gün doğumu.',
        'Aşkabat’a hareket.',
        'Aşkabat’ta otele yerleşme ve dinlenme.',
        'Yerel bir restoranda öğle yemeği.',
        'Eski Nisa: kadim Part kalesi ve UNESCO Dünya Mirası alanı.',
        'Bekrewe’de Saparmurat Ruhy Camii ve Halk Hakydasy Anıt Kompleksi.',
        'Aşkabat Hipodromu ve dünyaca ünlü Ahal-Teke atları.',
        'Aşkabat’ta gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Ашхабад — обзорная экскурсия',
      en: 'Ashgabat — city tour',
      tr: 'Aşkabat — şehir turu',
    },
    city: { ru: 'Ашхабад', en: 'Ashgabat', tr: 'Aşkabat' },
    lines: {
      ru: [
        'Обзорная экскурсия по Ашхабаду.',
        'Столица, её характерная архитектура и городская атмосфера.',
      ],
      en: [
        'City tour of Ashgabat.',
        'Explore the capital city and enjoy its distinctive architecture and city atmosphere.',
      ],
      tr: ['Aşkabat şehir turu.', 'Başkentin kendine özgü mimarisi ve şehir atmosferi.'],
    },
  },
  {
    title: {
      ru: 'Ашхабад — Янги-Кала — Туркменбаши',
      en: 'Ashgabat – Yangi Kala – Turkmenbashi',
      tr: 'Aşkabat – Yangi Kala – Türkmenbaşı',
    },
    city: { ru: 'Туркменбаши', en: 'Turkmenbashi', tr: 'Türkmenbaşı' },
    lines: {
      ru: [
        'Ранний завтрак в отеле, выезд к Янги-Кала.',
        'Каньоны Янги-Кала в 165 км к северу от Балканабата и в 160 км к востоку от Туркменбаши. «Янги-Кала» переводится с туркменского как «Огненная крепость»: обточенные ветром и дождями обрывы — белые, жёлтые, охристые, фиолетовые и красные, похожие на каменные замки.',
        'Обед.',
        'Гёзли-Ата — одно из самых удалённых мест паломничества в Туркменистане, среди гряд розового и белого камня. Гёзли-Ата был почитаемым суфием начала XIV века; его мавзолей — кирпичное здание с двумя белыми куполами на старом кладбище с резными каменными надгробиями.',
        'Переезд в отель в Туркменбаши.',
        'Ночь в Туркменбаши.',
      ],
      en: [
        'Early breakfast at the hotel. Drive to Yangi Kala.',
        'Visit the picturesque Yangi Kala canyons, located 165 km north of Balkanabat and 160 km east of Turkmenbashi. “Yangi Kala” translates from Turkmen as “Fiery Fortress”. The cliffs, carved by winds and rains, display colours of white, yellow, ocher, violet and red, resembling stone castles from fantasy.',
        'Enjoy lunch.',
        'Next, visit Gözli Ata, one of Turkmenistan’s most remote pilgrimage sites, surrounded by bands of pink and white stone escarpments. Gözli Ata was a respected Sufi who lived in the early 14th century. His mausoleum is a brick building with two white domes, standing in an old cemetery with many beautifully carved stone tombs.',
        'Drive to the hotel in Turkmenbashi.',
        'Overnight stay in Turkmenbashi.',
      ],
      tr: [
        'Otelde erken kahvaltı, Yangi Kala’ya hareket.',
        'Balkanabat’ın 165 km kuzeyinde, Türkmenbaşı’nın 160 km doğusunda yer alan Yangi Kala kanyonları. “Yangi Kala” Türkmenceden “Ateşli Kale” diye çevrilir: rüzgâr ve yağmurla yontulmuş yamaçlar beyaz, sarı, koyu sarı, mor ve kırmızı renkleriyle taştan şatoları andırır.',
        'Öğle yemeği.',
        'Ardından Gözli Ata: pembe ve beyaz taş yamaçlarla çevrili, Türkmenistan’ın en ıssız ziyaret yerlerinden biri. Gözli Ata, 14. yüzyılın başında yaşamış saygın bir sufiydi; türbesi, işlemeli taş mezarlarla dolu eski bir mezarlıkta duran, iki beyaz kubbeli tuğla bir yapıdır.',
        'Türkmenbaşı’ndaki otele geçiş.',
        'Türkmenbaşı’nda gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Туркменбаши — граница Гарабогаз',
      en: 'Turkmenbashi – Garabogaz border',
      tr: 'Türkmenbaşı – Garabogaz sınırı',
    },
    city: { ru: 'Туркменбаши', en: 'Turkmenbashi', tr: 'Türkmenbaşı' },
    lines: {
      ru: [
        'Ранний завтрак в отеле.',
        'Местные базары Туркменбаши.',
        'Переезд в национальную туристическую зону «Аваза»: день у моря, курортная инфраструктура и прогулка по набережным.',
        'Прибытие на границу Гарабогаз.',
        'Переход границы Гарабогаз в сторону Актау (Казахстан).',
      ],
      en: [
        'Early breakfast at the hotel.',
        'Visit local bazaars in Turkmenbashi.',
        'Transfer to the Awaza National Tourist Zone. Spend the day relaxing by the sea, enjoying the resort amenities, or walking along the modern promenades.',
        'Arrive at the Garabogaz border.',
        'Transfer to the Garabogaz border crossing to Aktau in Kazakhstan.',
      ],
      tr: [
        'Otelde erken kahvaltı.',
        'Türkmenbaşı’nda yerel pazarlar.',
        'Awaza Ulusal Turizm Bölgesi’ne transfer: deniz kenarında dinlenme, tesis olanakları ve modern sahil yollarında yürüyüş.',
        'Garabogaz sınırına varış.',
        'Garabogaz sınır kapısından Kazakistan’ın Aktau şehrine geçiş.',
      ],
    },
  },
];

const INCLUDED: Text[] = [
  {
    ru: 'Профессиональный англоговорящий гид',
    en: 'Professional English-speaking guide',
    tr: 'Profesyonel İngilizce konuşan rehber',
  },
  {
    ru: 'Визовое приглашение (LOI)',
    en: 'Letter of Invitation (LOI)',
    tr: 'Davet mektubu (LOI)',
  },
  {
    ru: 'Проживание: отель и юртовый лагерь',
    en: 'Accommodation: hotel and camp',
    tr: 'Konaklama: otel ve çadır kampı',
  },
  { ru: 'Транспорт', en: 'Transportation', tr: 'Ulaşım' },
  { ru: 'Входные билеты', en: 'Entry tickets', tr: 'Giriş biletleri' },
  { ru: 'Питание', en: 'Meals', tr: 'Yemekler' },
];

const EXCLUDED: Text[] = [
  {
    ru: 'Визовый сбор — примерно 75–100 $ в зависимости от гражданства, и ПЦР-тест 35 $. В сумме ориентировочно 130–150 $ с человека. Суммы приблизительные и могут немного отличаться.',
    en: 'Visa fee — approximately $75–$100 depending on nationality; PCR test $35. In total, you may expect around $130–$150 per person. Please note that these are approximate amounts and may vary slightly.',
    tr: 'Vize ücreti — uyruğa göre yaklaşık 75–100 $; PCR testi 35 $. Toplamda kişi başı yaklaşık 130–150 $ bekleyebilirsiniz. Bu tutarlar yaklaşıktır ve az miktarda değişebilir.',
  },
  {
    ru: 'Банковская комиссия за миграционный сбор',
    en: 'Migration tax bank fee',
    tr: 'Göç vergisi banka komisyonu',
  },
  {
    ru: 'Личные расходы и чаевые: сувениры, покупки, стирка, звонки, алкоголь. Дополнительные экскурсии и активности вне программы.',
    en: 'Private expenses and gratuities: souvenirs, shopping, laundry, phone calls, alcohol. Optional excursions or activities not included in the programme.',
    tr: 'Kişisel harcamalar ve bahşişler: hediyelik eşya, alışveriş, çamaşır, telefon görüşmeleri, alkol. Programa dahil olmayan isteğe bağlı geziler ve etkinlikler.',
  },
  { ru: 'Страховка', en: 'Insurance', tr: 'Sigorta' },
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
    title: {
      ru: 'Туркменистан за 5 дней',
      en: 'Turkmenistan in 5 days',
      tr: '5 günde Türkmenistan',
    },
    summary: {
      ru: 'Продуманный маршрут по Туркменистану: пустынные пейзажи, древнее наследие, архитектура Ашхабада и берег Каспия.',
      en: 'A curated journey through Turkmenistan, combining desert landscapes, ancient heritage, Ashgabat architecture and the Caspian coast.',
      tr: 'Türkmenistan boyunca özenle hazırlanmış bir rota: çöl manzaraları, kadim miras, Aşkabat mimarisi ve Hazar kıyısı.',
    },
    body: {
      ru: 'Хива • Дарваза • Ашхабад • Янги-Кала • Туркменбаши\n\n5 дней и 4 ночи — от границы с Узбекистаном до границы с Казахстаном. Ночь в юртовом лагере у газового кратера Дарваза, две ночи в Ашхабаде и ночь в Туркменбаши на Каспии.',
      en: 'Khiva • Darvaza • Ashgabat • Yangi Kala • Turkmenbashi\n\nFive days and four nights, from the Uzbek border to the Kazakh one. A night in a yurt camp beside the Darvaza gas crater, two nights in Ashgabat and a night in Turkmenbashi on the Caspian.',
      tr: 'Hive • Darvaza • Aşkabat • Yangi Kala • Türkmenbaşı\n\nBeş gün, dört gece: Özbekistan sınırından Kazakistan sınırına. Darvaza gaz kraterinin yanında çadır kampında bir gece, Aşkabat’ta iki gece ve Hazar kıyısındaki Türkmenbaşı’nda bir gece.',
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
      title: day.title,
      description: lines(day.lines),
      city: day.city,
    })),
  );

  await db.insert(t.tourInclusions).values([
    ...INCLUDED.map((text, index) => ({
      tourId: tour.id,
      kind: 'included' as const,
      text,
      sortOrder: (index + 1) * 10,
    })),
    ...EXCLUDED.map((text, index) => ({
      tourId: tour.id,
      kind: 'excluded' as const,
      text,
      sortOrder: (index + 1) * 10,
    })),
  ]);

  await db
    .insert(t.tourPrices)
    .values(PRICES.map(([pax, minor]) => ({ tourId: tour.id, pax, priceMinor: minor })));

  return 1;
}
