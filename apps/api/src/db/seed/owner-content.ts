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

/**
 * The short tour: Ashgabat, the Karakum and the crater, leaving towards Khiva.
 *
 * The same journey as the long one seen from the other end — that one enters at the Khiva border
 * and crosses the country; this one starts at the airport and leaves the way the other came in.
 * The day headings are the sheet's own, including the first, which names Koneurgench although
 * the day ends at Darvaza: the long tour's headings overreach in exactly the same way and are
 * published like that, so they are left alone rather than half-corrected.
 */
const SHORT_DAYS: DaySource[] = [
  {
    title: {
      ru: 'Ашхабад — Дарваза — Куняургенч (Хива)',
      en: 'Ashgabat – Darvaza – Koneurgench (Khiva)',
      tr: 'Aşkabat – Darvaza – Köneürgenç (Hive)',
    },
    city: { ru: 'Дарваза', en: 'Darvaza', tr: 'Darvaza' },
    lines: {
      ru: [
        'Встреча с англоговорящим гидом в аэропорту.',
        'Завтрак в местном кафе.',
        'Обзорная экскурсия по Ашхабаду: столица, её характерная архитектура и городская атмосфера.',
        'Обед в местном кафе с блюдами туркменской кухни.',
        'Переезд через пустыню Каракумы к газовому кратеру Дарваза.',
        'Прибытие в Дарвазу: «Врата ада» и традиционный ужин «газанлама» у светящегося кратера.',
        'Ночь в юртовом лагере под звёздами пустыни.',
      ],
      en: [
        'Meet our English-speaking guide at the airport.',
        'Have breakfast in a local cafe.',
        'City tour of Ashgabat. Explore the capital city and enjoy its distinctive architecture and city atmosphere.',
        'Have lunch in a local cafe with Turkmen national food.',
        'Continue your journey through the Karakum Desert to the Darvaza gas crater.',
        'Arrive at Darvaza, admire the “Gates of Hell” and enjoy a traditional “gazanlama” dinner near the glowing crater.',
        'Overnight stay in a yurt camp under the desert stars.',
      ],
      tr: [
        'Havalimanında İngilizce konuşan rehberimizle buluşma.',
        'Yerel bir kafede kahvaltı.',
        'Aşkabat şehir turu: başkent, kendine özgü mimarisi ve şehir atmosferi.',
        'Yerel bir kafede Türkmen mutfağından öğle yemeği.',
        'Karakum Çölü üzerinden Darvaza gaz kraterine geçiş.',
        'Darvaza’ya varış: “Cehennem Kapısı” ve kor hâlindeki kraterin yanında geleneksel “gazanlama” akşam yemeği.',
        'Çöl yıldızlarının altında çadır kampında gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Дарваза — Хива',
      en: 'Darvaza – Khiva',
      tr: 'Darvaza – Hive',
    },
    city: { ru: 'Хива', en: 'Khiva', tr: 'Hive' },
    lines: {
      ru: ['Завтрак у кратера, встреча рассвета.', 'Переезд в Хиву.'],
      en: ['Have breakfast near the crater. Enjoy the sunrise at the crater.', 'Drive to Khiva.'],
      tr: ['Kraterin yanında kahvaltı ve gün doğumu.', 'Hive’ye hareket.'],
    },
  },
];

/*
 * The three transit sheets: in at Shavat, out at Farap, four days between.
 *
 * A different product from the two above, which cross the country and leave by a different border
 * than they entered. These enter and leave through Uzbekistan — the traveller is on the Khiva to
 * Bukhara road and spends four days inside Turkmenistan on the way — and each flies one domestic
 * leg, which is what makes four days reach as far as they do.
 *
 * They are near enough identical to each other that the differences are the whole point, and the
 * catalogue has to make them legible: the first is the overland one and the only one that sleeps
 * in Koneurgench; the second is the only one with no desert and no crater; the third is the only
 * one with both the crater and Merv, and costs the most. Each summary says its own difference
 * rather than repeating the shared route — which is the mistake the two-day sheet made in its own
 * subtitle and which `seed.db.test.ts` pins.
 *
 * `Asyk Aydyn Pir` keeps the sheet's own spelling, with only its capitalisation fixed. It is the
 * Turkmen `Aşyk Aýdyň Pir` with the diacritics stripped, and restoring them was proposed and
 * rejected: fixing a typo in a verb is one thing, respelling the name of a real monument in the
 * operator's own document is another. It is spelled identically on the two tours that visit it —
 * they are the same monument on the same morning, and a catalogue that offers a reader two tours
 * must not offer them two spellings.
 */

const SILK_ROAD_DAYS: DaySource[] = [
  {
    title: {
      ru: 'Граница Шават — Дашогуз — Куняургенч',
      en: 'Shavat border – Dashoguz – Koneurgench',
      tr: 'Şavat sınırı – Daşoğuz – Köneürgenç',
    },
    city: { ru: 'Куняургенч', en: 'Koneurgench', tr: 'Köneürgenç' },
    lines: {
      ru: [
        'Въезд через границу Шават.',
        'Завтрак в местном кафе в Дашогузе и обзорная экскурсия по городу.',
        'После переезда — экскурсия по архитектурным чудесам Куняургенча.',
        'Ночь в отеле в Куняургенче.',
      ],
      en: [
        'Entry at the Shavat border.',
        'Have breakfast in a local cafe in Dashoguz and take a city tour.',
        'After the drive, tour the architectural wonders of Koneurgench.',
        'Overnight stay in a hotel in Koneurgench.',
      ],
      tr: [
        'Şavat sınırından giriş.',
        'Daşoğuz’da yerel bir kafede kahvaltı ve şehir turu.',
        'Yolculuğun ardından Köneürgenç’in mimari harikalarını gezme.',
        'Köneürgenç’te bir otelde gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Куняургенч — Асык Айдын Пир — Дарваза',
      en: 'Koneurgench – Asyk Aydyn Pir – Darvaza',
      tr: 'Köneürgenç – Asyk Aydyn Pir – Darvaza',
    },
    city: { ru: 'Дарваза', en: 'Darvaza', tr: 'Darvaza' },
    lines: {
      ru: [
        'После завтрака — исторический памятник Асык Айдын Пир.',
        'Посещение дома популярного местного художника.',
        'После обеда — прямой переезд к газовому кратеру Дарваза.',
        'Костёр и ужин у светящегося кратера.',
        'Ночь в палатках и юртах.',
      ],
      en: [
        'After breakfast, visit the Asyk Aydyn Pir historical monument.',
        'Visit the house of a popular local painter.',
        'After lunch, drive straight to the Darvaza gas crater.',
        'Evening bonfire and dinner by the glowing crater.',
        'Overnight stay in tents and yurts.',
      ],
      tr: [
        'Kahvaltıdan sonra Asyk Aydyn Pir tarihî anıtı.',
        'Popüler yerel bir ressamın ev ziyareti.',
        'Öğle yemeğinden sonra doğrudan Darvaza gaz kraterine hareket.',
        'Kor hâlindeki kraterin yanında kamp ateşi ve akşam yemeği.',
        'Çadır kampında gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Дарваза — Ашхабад',
      en: 'Darvaza – Ashgabat',
      tr: 'Darvaza – Aşkabat',
    },
    city: { ru: 'Ашхабад', en: 'Ashgabat', tr: 'Aşkabat' },
    lines: {
      ru: [
        'После завтрака — переезд из Дарвазы в Ашхабад (около 3,5 часа).',
        'Вторая половина дня — современные дворцы и фонтаны Ашхабада, величественная Кипчакская мечеть.',
        'Ночь в Ашхабаде.',
      ],
      en: [
        'After breakfast, drive from Darvaza to Ashgabat (~3.5 hours).',
        'Spend the afternoon exploring Ashgabat’s modern palaces, fountains, and the grand Kipchak Mosque.',
        'Overnight stay in Ashgabat.',
      ],
      tr: [
        'Kahvaltıdan sonra Darvaza’dan Aşkabat’a yolculuk (~3,5 saat).',
        'Öğleden sonra Aşkabat’ın modern sarayları, fıskiyeleri ve görkemli Kıpçak Camii.',
        'Aşkabat’ta gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Ашхабад — Туркменабат — граница Фарап',
      en: 'Ashgabat – Turkmenabat – Farap border',
      tr: 'Aşkabat – Türkmenabat – Farap sınırı',
    },
    // No night: the day ends at the border. The city is where it begins, which is how the
    // five-day tour's own last day is written.
    city: { ru: 'Ашхабад', en: 'Ashgabat', tr: 'Aşkabat' },
    lines: {
      ru: [
        'Внутренний перелёт Ашхабад — Туркменабат.',
        'Покупки на местном базаре.',
        'Переезд к границе Фарап.',
      ],
      en: [
        'Domestic flight from Ashgabat to Turkmenabat.',
        'Shopping at a local bazaar.',
        'Drive to the Farap border.',
      ],
      tr: [
        'Aşkabat’tan Türkmenabat’a iç hat uçuşu.',
        'Yerel bir pazarda alışveriş.',
        'Farap sınırına hareket.',
      ],
    },
  },
];

const TRANSIT_DAYS: DaySource[] = [
  {
    title: {
      ru: 'Шават — Куняургенч — Дашогуз — Ашхабад',
      en: 'Shavat – Koneurgench – Dashoguz – Ashgabat',
      tr: 'Şavat – Köneürgenç – Daşoğuz – Aşkabat',
    },
    city: { ru: 'Ашхабад', en: 'Ashgabat', tr: 'Aşkabat' },
    lines: {
      ru: [
        'Въезд через границу Шават.',
        // Where breakfast is eaten this sheet does not say, and unlike its two siblings it does
        // not put the traveller in Dashoguz first — so neither does this line.
        'После завтрака — переезд в Куняургенч, подробная историческая экскурсия.',
        'Переезд в соседний Дашогуз на ужин, затем вечерний внутренний перелёт Дашогуз — Ашхабад (около 50 минут).',
        'Ночь в Ашхабаде.',
      ],
      en: [
        'Entry at the Shavat border.',
        'After breakfast, drive to Koneurgench for a comprehensive historical tour.',
        'Drive to the nearby city of Dashoguz for dinner, followed by an evening domestic flight from Dashoguz to Ashgabat (approx. 50 minutes).',
        'Overnight stay in Ashgabat.',
      ],
      tr: [
        'Şavat sınırından giriş.',
        'Kahvaltıdan sonra Köneürgenç’e hareket ve kapsamlı bir tarih turu.',
        'Akşam yemeği için yakındaki Daşoğuz şehrine geçiş, ardından akşam Daşoğuz’dan Aşkabat’a iç hat uçuşu (yaklaşık 50 dakika).',
        'Aşkabat’ta gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Ашхабад — Старая Ниса',
      en: 'Ashgabat – Old Nisa',
      tr: 'Aşkabat – Eski Nisa',
    },
    city: { ru: 'Ашхабад', en: 'Ashgabat', tr: 'Aşkabat' },
    lines: {
      ru: [
        'Целый неспешный день в Ашхабаде.',
        'Величественные городские монументы, Национальный музей истории, древняя крепость Старая Ниса и оживлённый «Русский базар».',
        'Ночь в Ашхабаде.',
      ],
      en: [
        'A full, relaxed day in Ashgabat.',
        'Tour the grand city monuments, the National Museum of History, the ancient fortress of Old Nisa, and the vibrant Russian Bazaar.',
        'Overnight stay in Ashgabat.',
      ],
      tr: [
        'Aşkabat’ta tam ve sakin bir gün.',
        'Görkemli şehir anıtları, Ulusal Tarih Müzesi, kadim Eski Nisa kalesi ve canlı “Rus Pazarı”.',
        'Aşkabat’ta gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Ашхабад — Мары (Мерв) — Туркменабат',
      en: 'Ashgabat – Mary (Merv) – Turkmenabat',
      tr: 'Aşkabat – Mary (Merv) – Türkmenabat',
    },
    city: { ru: 'Туркменабат', en: 'Turkmenabat', tr: 'Türkmenabat' },
    lines: {
      ru: [
        'Утром после завтрака — переезд из Ашхабада в Мары (около 4,5 часа).',
        'Вторая половина дня — подробный осмотр древнего Мерва.',
        'Вечером — переезд в Туркменабат.',
        'Ночь в Туркменабате.',
      ],
      en: [
        'In the morning after breakfast, drive from Ashgabat to Mary (approx. 4.5 hours).',
        'Spend a detailed afternoon at Ancient Merv.',
        'Continue driving to Turkmenabat in the evening.',
        'Overnight stay in Turkmenabat.',
      ],
      tr: [
        'Sabah kahvaltıdan sonra Aşkabat’tan Mary’ye hareket (yaklaşık 4,5 saat).',
        'Öğleden sonra Antik Merv’de ayrıntılı gezi.',
        'Akşam Türkmenabat’a doğru yola devam.',
        'Türkmenabat’ta gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Туркменабат — граница Фарап',
      en: 'Turkmenabat – Farap border',
      tr: 'Türkmenabat – Farap sınırı',
    },
    city: { ru: 'Туркменабат', en: 'Turkmenabat', tr: 'Türkmenabat' },
    lines: {
      ru: ['Утром — трансфер на границу Фарап и выезд в сторону Бухары.'],
      en: ['Morning transfer to the Farap border and exit towards Bukhara.'],
      tr: ['Sabah Farap sınırına transfer ve Buhara yönüne çıkış.'],
    },
  },
];

/*
 * Days two and three are the first tour's days two and three, and are written identically.
 *
 * Not a copy for tidiness — the two sheets describe the same morning at the same monument and the
 * same drive to the same capital, and a reader comparing the two tours in the catalogue would read
 * any difference in the wording as a difference in the tour. The one place they genuinely diverge
 * is kept: this sheet's day three does not say «after breakfast» and the other's does.
 */
const MERV_DAYS: DaySource[] = [
  {
    title: {
      ru: 'Граница Шават — Куняургенч — Дашогуз',
      en: 'Shavat border – Koneurgench – Dashoguz',
      tr: 'Şavat sınırı – Köneürgenç – Daşoğuz',
    },
    city: { ru: 'Дашогуз', en: 'Dashoguz', tr: 'Daşoğuz' },
    lines: {
      ru: [
        'Въезд через границу Шават.',
        'Завтрак в местном кафе в Дашогузе.',
        'Экскурсия по архитектурным чудесам Куняургенча.',
        'Обзорная экскурсия по Дашогузу.',
        'Ночь в отеле в Дашогузе.',
      ],
      en: [
        'Entry at the Shavat border.',
        'Have breakfast in a local cafe in Dashoguz.',
        'Tour the architectural wonders of Koneurgench.',
        'City tour of Dashoguz.',
        'Overnight stay in a hotel in Dashoguz.',
      ],
      tr: [
        'Şavat sınırından giriş.',
        'Daşoğuz’da yerel bir kafede kahvaltı.',
        'Köneürgenç’in mimari harikalarını gezme.',
        'Daşoğuz şehir turu.',
        'Daşoğuz’da otelde gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Дашогуз — Асык Айдын Пир — Дарваза',
      en: 'Dashoguz – Asyk Aydyn Pir – Darvaza',
      tr: 'Daşoğuz – Asyk Aydyn Pir – Darvaza',
    },
    city: { ru: 'Дарваза', en: 'Darvaza', tr: 'Darvaza' },
    lines: {
      ru: [
        'После завтрака — исторический памятник Асык Айдын Пир.',
        'Посещение дома популярного местного художника.',
        'После обеда — прямой переезд к газовому кратеру Дарваза.',
        'Костёр и ужин у светящегося кратера.',
        'Ночь в палатках и юртах.',
      ],
      en: [
        'After breakfast, visit the Asyk Aydyn Pir historical monument.',
        'Visit the house of a popular local painter.',
        'After lunch, drive straight to the Darvaza gas crater.',
        'Evening bonfire and dinner by the glowing crater.',
        'Overnight stay in tents and yurts.',
      ],
      tr: [
        'Kahvaltıdan sonra Asyk Aydyn Pir tarihî anıtı.',
        'Popüler yerel bir ressamın ev ziyareti.',
        'Öğle yemeğinden sonra doğrudan Darvaza gaz kraterine hareket.',
        'Kor hâlindeki kraterin yanında kamp ateşi ve akşam yemeği.',
        'Çadır kampında gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Дарваза — Ашхабад',
      en: 'Darvaza – Ashgabat',
      tr: 'Darvaza – Aşkabat',
    },
    city: { ru: 'Ашхабад', en: 'Ashgabat', tr: 'Aşkabat' },
    lines: {
      // No «after breakfast» here: this sheet does not write one, and its sibling does.
      ru: [
        'Переезд из Дарвазы в Ашхабад (около 3,5 часа).',
        'Вторая половина дня — современные дворцы и фонтаны Ашхабада, величественная Кипчакская мечеть.',
        'Ночь в Ашхабаде.',
      ],
      en: [
        'Drive from Darvaza to Ashgabat (~3.5 hours).',
        'Spend the afternoon exploring Ashgabat’s modern palaces, fountains, and the grand Kipchak Mosque.',
        'Overnight stay in Ashgabat.',
      ],
      tr: [
        'Darvaza’dan Aşkabat’a yolculuk (~3,5 saat).',
        'Öğleden sonra Aşkabat’ın modern sarayları, fıskiyeleri ve görkemli Kıpçak Camii.',
        'Aşkabat’ta gece konaklaması.',
      ],
    },
  },
  {
    title: {
      ru: 'Ашхабад — Мары — Древний Мерв — граница Фарап',
      en: 'Ashgabat – Mary – Ancient Merv – Farap border',
      tr: 'Aşkabat – Mary – Antik Merv – Farap sınırı',
    },
    // Where the day goes rather than where the night was, on the two-day tour's own precedent:
    // its second day is Хива, and no night is promised there either.
    city: { ru: 'Мары', en: 'Mary', tr: 'Mary' },
    lines: {
      ru: [
        'Ранний утренний внутренний рейс Ашхабад — Мары (всего 40 минут). Он избавляет от долгого утреннего переезда.',
        'Весь день — подробная экскурсия по Древнему Мерву.',
        'Переезд к границе Фарап и выезд из страны.',
      ],
      en: [
        'Take an early morning domestic flight from Ashgabat to Mary (only 40 minutes). This saves a massive morning drive.',
        'Spend the entire day on an in-depth tour of Ancient Merv.',
        'Drive to the Farap border for exit.',
      ],
      tr: [
        'Aşkabat’tan Mary’ye sabahın erken saatlerinde iç hat uçuşu (yalnızca 40 dakika). Bu, uzun bir sabah yolculuğunu ortadan kaldırır.',
        'Bütün gün Antik Merv’de ayrıntılı bir gezi.',
        'Çıkış için Farap sınırına hareket.',
      ],
    },
  },
];

/**
 * What the price covers, and what it does not — the same six and four on every tour.
 *
 * Printed on two of the five sheets; the three transit sheets carry no such list. I left them
 * empty and said why — one of the three sleeps in no camp, all three fly a domestic leg, and
 * whether a leg is in the price is a commercial fact nobody in this repository can know (D-137).
 * The owner answered it directly: the same list on all of them, and the yurt camp is in the price.
 * That is his statement about his own product, so it is the one that stands, and the question
 * this comment used to record is closed rather than argued.
 *
 * One line still follows the itinerary rather than the rule, and it is not an exception to it.
 * «Accommodation: hotel and camp» on the transit express would be a camp the reader can see is
 * not there — its three nights are hotel nights, listed by name on the same page. Naming what a
 * tour actually sleeps in is the same promise, not a different one.
 */
type Stay = 'hotelAndCamp' | 'hotel';

const ACCOMMODATION: Record<Stay, Text> = {
  hotelAndCamp: {
    ru: 'Проживание: отель и юртовый лагерь',
    en: 'Accommodation: hotel and camp',
    tr: 'Konaklama: otel ve çadır kampı',
  },
  hotel: {
    ru: 'Проживание: отель',
    en: 'Accommodation: hotel',
    tr: 'Konaklama: otel',
  },
};

const sheetIncluded = (stay: Stay): Text[] => [
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
  ACCOMMODATION[stay],
  { ru: 'Транспорт', en: 'Transportation', tr: 'Ulaşım' },
  { ru: 'Входные билеты', en: 'Entry tickets', tr: 'Giriş biletleri' },
  { ru: 'Питание', en: 'Meals', tr: 'Yemekler' },
];

const SHEET_EXCLUDED: Text[] = [
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
type PriceRow = [pax: number, minor: number];

const FIVE_DAY_PRICES: PriceRow[] = [
  [1, 100_000],
  [2, 93_000],
  [3, 87_000],
  [4, 83_000],
];

const TWO_DAY_PRICES: PriceRow[] = [
  [1, 60_000],
  [2, 57_000],
  [3, 54_000],
  [4, 50_000],
];

/* The three transit sheets, each with its own ladder. They differ by as little as $20 a head. */
const SILK_ROAD_PRICES: PriceRow[] = [
  [1, 90_000],
  [2, 87_000],
  [3, 84_000],
  [4, 80_000],
];

const TRANSIT_PRICES: PriceRow[] = [
  [1, 85_000],
  [2, 83_000],
  [3, 80_000],
  [4, 78_000],
];

const MERV_PRICES: PriceRow[] = [
  [1, 100_000],
  [2, 97_000],
  [3, 94_000],
  [4, 90_000],
];

/**
 * A photograph named by what it shows, rather than by the id it happened to get.
 *
 * The stock import writes one English `alt` per subject — every crater photograph says «The
 * Darvaza gas crater in the Karakum Desert» — so the subject is recoverable from the row without
 * a column for it. Ids are not: they depend on how many files each Commons category returned on
 * the day the import ran, which is not the same number twice. Picking the nth landscape
 * photograph of a subject, by id, is stable on any database that has been imported at all, and
 * silently does nothing on one that has not.
 */
const SUBJECT_ALT = {
  darvaza: 'The Darvaza gas crater',
  ashgabat: 'Ashgabat, the white marble capital',
  nisa: 'Old Nisa',
  merv: 'Ancient Merv',
  konyeUrgench: 'Konye-Urgench',
  yangiKala: 'The Yangi Kala canyons',
  caspian: 'The Caspian coast',
  karakum: 'The dunes of the Karakum Desert',
  akhalTeke: 'An Akhal-Teke horse',
  // A bazaar, which three of the five sheets send the traveller to, and which the library has no
  // photograph of as such: the carpet and the faces are what a Turkmen bazaar is made of.
  carpet: 'A hand-woven Turkmen carpet',
  people: 'People of Turkmenistan',
  cuisine: 'Turkmen cuisine',
} as const;

type Subject = keyof typeof SUBJECT_ALT;
type Photo = [subject: Subject, nth: number];

interface OwnerTour {
  slug: string;
  /** Everything the `tours` row says, minus the slug. */
  values: Omit<typeof t.tours.$inferInsert, 'slug'>;
  days: DaySource[];
  prices: PriceRow[];
  /** What the nights are spent in — the one line of the price breakdown that is per tour. */
  stay: Stay;
  /** The one picture the card shows. Chosen, not dealt round-robin like the demo catalogue. */
  cover: Photo;
  /** The detail page's strip, in the order the itinerary meets them. */
  gallery: Photo[];
}

export const TURKMENISTAN_SLUG = 'turkmenistan-5-days';
export const TURKMENISTAN_SHORT_SLUG = 'turkmenistan-2-days';

/*
 * The three transit tours are all four days long, so the two above cannot lend them their naming.
 * Each is named for what distinguishes it from the other two instead — which is also what a
 * reader picking between three four-day tours is looking for. Slugs are immutable once published
 * (D-40); these are chosen to survive a fourth transit sheet arriving.
 */
export const SILK_ROAD_SLUG = 'turkmenistan-overland-4-days';
export const TRANSIT_SLUG = 'turkmenistan-transit-4-days';
export const MERV_SLUG = 'turkmenistan-merv-4-days';

/*
 * The ordinals in `cover` and `gallery` below were chosen by looking at the photographs.
 *
 * They read like arithmetic — «the fifth landscape crater» — and the first version of the three
 * transit tours was exactly that: ordinals stepped past what the published tours already used, so
 * that nothing collided. That is necessary and it is not sufficient. Rendered as a contact sheet,
 * the frames those ordinals landed on included a Koneurgench mausoleum with «14/09/2011» burnt
 * into the corner — as a **cover** — a close-up of twigs filed under «dunes of the Karakum», a
 * museum dish filed under «Ancient Merv» standing in for the city, two covers of the crater so
 * dark it is a thin orange line, and a fifteenth-century miniature of a siege standing in for a
 * photograph of Koneurgench.
 *
 * None of that is a defect in the importer: it collects what a Commons category holds, and a
 * category holds annotated diagrams and manuscript scans alongside scenery. It is a defect in
 * choosing by ordinal. So every ordinal here has been looked at, and the ones that are skipped
 * are skipped for a reason a reader can check — `scratchpad/sheet.mjs` renders any set of ids as
 * a sheet, and the argument for each cover is written beside it.
 */
const TOURS: OwnerTour[] = [
  {
    slug: TURKMENISTAN_SLUG,
    values: {
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
    },
    days: TURKMENISTAN_DAYS,
    prices: FIVE_DAY_PRICES,
    stay: 'hotelAndCamp',
    /*
     * The cover is the horse the round-robin dealt it when the photographs were imported, and it
     * is left where it is: it is not wrong, and it is the owner's to change in one click. Only
     * the strip below is added here, which is purely additive.
     */
    cover: ['akhalTeke', 0],
    gallery: [
      ['konyeUrgench', 0],
      ['darvaza', 0],
      ['karakum', 0],
      ['ashgabat', 0],
      ['nisa', 0],
      ['akhalTeke', 1],
      ['yangiKala', 0],
      ['caspian', 0],
    ],
  },
  {
    slug: TURKMENISTAN_SHORT_SLUG,
    values: {
      title: {
        ru: 'Туркменистан за 2 дня',
        en: 'Turkmenistan in 2 days',
        tr: '2 günde Türkmenistan',
      },
      /*
       * Not the sheet's own subtitle.
       *
       * Both sheets carry the same one — «desert landscapes, ancient heritage, Ashgabat
       * architecture and the Caspian coast» — which is true of the five-day tour and false of
       * this one: it goes nowhere near the Caspian. A summary is what a card promises, so it
       * says what these two days actually contain.
       */
      summary: {
        ru: 'Ашхабад, пустыня Каракумы и газовый кратер Дарваза: два дня с ночёвкой в юртовом лагере у огня.',
        en: 'Ashgabat, the Karakum Desert and the Darvaza gas crater: two days with a night in a yurt camp beside the fire.',
        tr: 'Aşkabat, Karakum Çölü ve Darvaza gaz krateri: ateşin yanındaki çadır kampında bir geceyle iki gün.',
      },
      body: {
        ru: 'Ашхабад • Дарваза • Куняургенч (Хива)\n\n2 дня и 1 ночь: обзорная экскурсия по Ашхабаду, переезд через пустыню Каракумы к газовому кратеру Дарваза, ночь в юртовом лагере и рассвет у кратера. Дальше — дорога на Хиву.',
        en: 'Ashgabat • Darvaza • Koneurgench (Khiva)\n\nTwo days and one night: a city tour of Ashgabat, the drive across the Karakum Desert to the Darvaza gas crater, a night in a yurt camp and sunrise at the crater. Then the road to Khiva.',
        tr: 'Aşkabat • Darvaza • Köneürgenç (Hive)\n\nİki gün, bir gece: Aşkabat şehir turu, Karakum Çölü üzerinden Darvaza gaz kraterine geçiş, çadır kampında bir gece ve kraterin yanında gün doğumu. Ardından Hive yolu.',
      },
      category: 'classic',
      days: 2,
      // Ashgabat, Darvaza and Koneurgench — the three the sheet's own subtitle names.
      cities: 3,
      hotelStars: null,
      priceFromMinor: 50_000,
      priceCurrency: 'USD',
      isFeatured: true,
      isPublished: true,
      sortOrder: 1,
    },
    days: SHORT_DAYS,
    prices: TWO_DAY_PRICES,
    stay: 'hotelAndCamp',
    /*
     * Chosen rather than dealt: the crater is what this tour is for, and a card showing it says
     * so before the title is read. The gallery then follows the itinerary — the capital, the
     * desert crossing, the crater by day and by night, the dinner it is eaten at, and the road
     * out through Khorezm.
     */
    cover: ['darvaza', 1],
    gallery: [
      ['ashgabat', 1],
      ['karakum', 1],
      ['darvaza', 2],
      ['darvaza', 3],
      ['cuisine', 0],
      ['konyeUrgench', 1],
    ],
  },
  {
    slug: SILK_ROAD_SLUG,
    values: {
      title: {
        ru: 'Великий шёлковый путь: от границы до границы',
        en: 'The Ultimate Overland Silk Road',
        tr: 'Büyük İpek Yolu: sınırdan sınıra',
      },
      /*
       * «Overland» is the sheet's own word and stays in the English name, which is the product's
       * name. It is not repeated in the sentence below it, where it would stand next to the
       * domestic flight it contradicts.
       */
      summary: {
        ru: 'Четыре дня от границы Шават до границы Фарап — архитектурные чудеса Куняургенча, ночь у газового кратера Дарваза, Ашхабад и внутренний перелёт в Туркменабат с покупками на местном базаре.',
        en: 'Four days from the Shavat border to the Farap border — the architectural wonders of Koneurgench, a night beside the Darvaza gas crater, Ashgabat, and a domestic flight on to Turkmenabat with shopping at a local bazaar.',
        tr: 'Şavat sınırından Farap sınırına dört gün — Köneürgenç’in mimari harikaları, Darvaza gaz kraterinin yanında bir gece, Aşkabat, ardından Türkmenabat’a iç hat uçuşu ve yerel pazarda alışveriş.',
      },
      body: {
        ru: 'Куняургенч • кратер Дарваза • Ашхабад • Лебап\n\n4 дня и 3 ночи: въезд через границу Шават, выезд через Фарап. Первая ночь — в отеле в Куняургенче, древней столице Хорезма и объекте Всемирного наследия ЮНЕСКО; вторая — в палатках и юртах у газового кратера Дарваза; третья — в Ашхабаде. Последний день — внутренний перелёт в Туркменабат (Лебап) и дорога к границе Фарап.',
        en: 'Koneurgench • Darvaza Crater • Ashgabat • Lebap\n\nFour days and three nights, entering at the Shavat border and leaving at Farap. The first night is in a hotel in Koneurgench, the old capital of Khorezm and a UNESCO World Heritage Site; the second in tents and yurts beside the Darvaza gas crater; the third in Ashgabat. The last day is a domestic flight on to Turkmenabat in Lebap and the road to the Farap border.',
        tr: 'Köneürgenç • Darvaza Krateri • Aşkabat • Lebap\n\nDört gün, üç gece: giriş Şavat sınırından, çıkış Farap’tan. İlk gece, Harezm’in eski başkenti ve UNESCO Dünya Mirası alanı olan Köneürgenç’te bir otelde; ikinci gece Darvaza gaz kraterinin yanında çadırlarda ve otağlarda; üçüncü gece Aşkabat’ta. Son gün Türkmenabat’a (Lebap) iç hat uçuşu ve Farap sınırına yolculuk.',
      },
      category: 'classic',
      days: 4,
      // The four the sheet's own «Destinations» line names.
      cities: 4,
      hotelStars: null,
      priceFromMinor: 80_000,
      priceCurrency: 'USD',
      isFeatured: true,
      isPublished: true,
      sortOrder: 2,
    },
    days: SILK_ROAD_DAYS,
    prices: SILK_ROAD_PRICES,
    stay: 'hotelAndCamp',
    /*
     * Koneurgench on the card, because it is what separates this tour from its two siblings: the
     * only one of the five that sleeps there, and the crater is already the two-day tour's cover.
     * The strip then follows the itinerary — the desert crossing, the crater at night, the dinner
     * beside it, the capital, the day-four flight, and the bazaar, which the library has no
     * photograph of as such and which the carpet hall and the tea trays stand in for.
     *
     * Every ordinal below was chosen by looking at the frame. See the note above `TOURS`.
     */
    cover: ['konyeUrgench', 3],
    gallery: [
      ['karakum', 4],
      ['darvaza', 4],
      ['cuisine', 1],
      ['ashgabat', 7],
      ['ashgabat', 5],
      ['ashgabat', 9],
      ['carpet', 0],
      ['people', 2],
    ],
  },
  {
    slug: TRANSIT_SLUG,
    values: {
      title: {
        ru: 'Комфортный транзит',
        en: 'The Comfort Transit Express',
        tr: 'Konforlu Transit',
      },
      summary: {
        ru: 'Куняургенч, целый неспешный день в Ашхабаде — Старая Ниса, Национальный музей истории и «Русский базар» — и древний Мерв: транзит от Шавата до Фарапа с внутренним перелётом из Дашогуза.',
        en: 'Koneurgench, a full, unhurried day in Ashgabat — Old Nisa, the National Museum of History and the Russian Bazaar — and Ancient Merv: a transit from Shavat to Farap with a domestic flight out of Dashoguz.',
        tr: 'Köneürgenç, Aşkabat’ta tam ve sakin bir gün — Eski Nisa, Ulusal Tarih Müzesi ve “Rus Pazarı” — ve Antik Merv: Daşoğuz’dan iç hat uçuşuyla Şavat’tan Farap’a transit geçiş.',
      },
      body: {
        ru: 'Куняургенч • Дашогуз • Ашхабад • Мерв • Туркменабат\n\n4 дня и 3 ночи — от границы Шават до границы Фарап, с выездом в сторону Бухары. Внутренний перелёт из Дашогуза в Ашхабад в первый же вечер, две ночи в Ашхабаде и ночь в Туркменабате. По дороге — Куняургенч, древняя столица Хорезма, и древний Мерв: оба — объекты Всемирного наследия ЮНЕСКО.',
        en: 'Koneurgench • Dashoguz • Ashgabat • Merv • Turkmenabat\n\nFour days and three nights, from the Shavat border to the Farap border and out towards Bukhara. A domestic flight from Dashoguz to Ashgabat on the first evening, two nights in Ashgabat and one night in Turkmenabat. Along the way, Koneurgench, the ancient capital of Khorezm, and Ancient Merv — both UNESCO World Heritage Sites.',
        tr: 'Köneürgenç • Daşoğuz • Aşkabat • Merv • Türkmenabat\n\nDört gün, üç gece: Şavat sınırından Farap sınırına ve Buhara yönüne çıkış. İlk akşam Daşoğuz’dan Aşkabat’a iç hat uçuşu, Aşkabat’ta iki gece ve Türkmenabat’ta bir gece. Yol üzerinde Harezm’in kadim başkenti Köneürgenç ve Antik Merv; ikisi de UNESCO Dünya Mirası Listesi’nde.',
      },
      // The one of the five with no desert and no crater: two UNESCO cities, a fortress, a museum
      // and a bazaar. `history` rather than `classic`, and it is the only tour that earns it.
      category: 'history',
      days: 4,
      cities: 3,
      hotelStars: null,
      priceFromMinor: 78_000,
      priceCurrency: 'USD',
      isFeatured: true,
      isPublished: true,
      sortOrder: 3,
    },
    days: TRANSIT_DAYS,
    prices: TRANSIT_PRICES,
    // Three hotel nights and no camp — the one tour of the five where the accommodation line
    // would otherwise promise a tent the itinerary on the same page shows is not there.
    stay: 'hotel',
    /*
     * The white marble capital on the card: two of this tour's three nights are there and its one
     * full day is there, and it is the only one of the five whose card can say so. Merv is the
     * afternoon of day three, and it gets the card of the tour named after it instead.
     */
    cover: ['ashgabat', 14],
    gallery: [
      ['konyeUrgench', 4],
      ['ashgabat', 11],
      ['ashgabat', 8],
      ['nisa', 3],
      ['carpet', 1],
      ['merv', 6],
      ['merv', 5],
      ['cuisine', 2],
    ],
  },
  {
    slug: MERV_SLUG,
    values: {
      title: {
        ru: 'Туркменистан за 4 дня: Дарваза и Мерв',
        en: 'Turkmenistan in 4 days: Darvaza and Merv',
        tr: '4 günde Türkmenistan: Darvaza ve Merv',
      },
      summary: {
        ru: 'Газовый кратер Дарваза и Древний Мерв в одном маршруте: ранний перелёт Ашхабад — Мары отдаёт Мерву целый день.',
        en: 'The Darvaza gas crater and Ancient Merv on one route: an early flight from Ashgabat to Mary leaves a whole day for Merv.',
        tr: 'Tek rotada Darvaza gaz krateri ve Antik Merv: Aşkabat’tan Mary’ye erken uçuş, Merv’e bütün bir gün kazandırır.',
      },
      body: {
        ru: 'Куняургенч • Дарваза • Ашхабад • Древний Мерв\n\n4 дня и 3 ночи — въезд через границу Шават, выезд через границу Фарап. Ночь в отеле в Дашогузе, ночь в палатках и юртах у газового кратера Дарваза и ночь в Ашхабаде. Последний день целиком отдан Древнему Мерву — городу на Великом шёлковом пути и объекту Всемирного наследия ЮНЕСКО; туда из Ашхабада ведёт утренний внутренний рейс до Мары.',
        en: 'Koneurgench • Darvaza • Ashgabat • Ancient Merv\n\nFour days and three nights, entering at the Shavat border and leaving at the Farap border. A night in a hotel in Dashoguz, a night in tents and yurts beside the Darvaza gas crater and a night in Ashgabat. The last day belongs entirely to Ancient Merv — a city of the Silk Road and a UNESCO World Heritage Site — reached by an early morning domestic flight from Ashgabat to Mary.',
        tr: 'Köneürgenç • Darvaza • Aşkabat • Antik Merv\n\nDört gün, üç gece: giriş Şavat sınırından, çıkış Farap sınırından. Daşoğuz’da otelde bir gece, Darvaza gaz kraterinin yanında çadır kampında bir gece, Aşkabat’ta bir gece. Son gün tamamen Antik Merv’e ayrılmıştır — İpek Yolu şehri ve UNESCO Dünya Mirası alanı; oraya Aşkabat’tan Mary’ye sabah yapılan iç hat uçuşuyla ulaşılır.',
      },
      category: 'classic',
      days: 4,
      cities: 4,
      hotelStars: null,
      priceFromMinor: 90_000,
      priceCurrency: 'USD',
      isFeatured: true,
      isPublished: true,
      sortOrder: 4,
    },
    days: MERV_DAYS,
    prices: MERV_PRICES,
    stay: 'hotelAndCamp',
    /*
     * The Great Kyz Kala on the card — the corrugated walls are the one image in the library that
     * says «Merv» without a caption, and this is the tour that gives Merv a whole day and is named
     * for it. The crater goes in the strip, at night, which is when this itinerary is there.
     *
     * No Koneurgench frame, and that is deliberate rather than an oversight: the subject has six
     * photographs, two are already on the published tours, one carries a burnt-in date, one is a
     * medieval miniature rather than a photograph, and the two that are left are on the other two
     * transit tours, where Koneurgench is a longer part of the day. A day with no picture is
     * better than a page showing a manuscript painting of a siege as though it were scenery.
     */
    cover: ['merv', 3],
    gallery: [
      ['karakum', 5],
      ['darvaza', 5],
      ['cuisine', 3],
      ['ashgabat', 10],
      ['ashgabat', 12],
      ['merv', 4],
      ['merv', 2],
    ],
  },
];

/**
 * Which slugs this file owns — everything else in `tours` is the demo catalogue.
 *
 * Exported so the tests can tell the two apart without keeping their own copy of the list, which
 * is the copy that goes stale the day a third sheet arrives.
 */
export const OWNER_TOUR_SLUGS: readonly string[] = TOURS.map((tour) => tour.slug);

/**
 * Adds any owner tour the database does not have yet.
 *
 * Idempotent by slug, so it is safe from both `db:seed` on an empty database and `db:content` on
 * the live one (D-43 — the seeder refuses a non-empty database, and the live one is never empty).
 * A tour that is already there is left alone entirely: its text belongs to whoever last edited it
 * in the admin panel.
 */
export async function seedOwnerTours(db: Database): Promise<number> {
  const existing = new Set(
    (await db.select({ slug: t.tours.slug }).from(t.tours)).map((row) => row.slug),
  );

  let written = 0;

  for (const tour of TOURS) {
    if (existing.has(tour.slug)) continue;

    await db.insert(t.tours).values({ slug: tour.slug, ...tour.values });

    const [row] = await db
      .select({ id: t.tours.id })
      .from(t.tours)
      .where(eq(t.tours.slug, tour.slug))
      .limit(1);

    if (row === undefined) throw new Error(`the ${tour.slug} tour did not insert`);

    await db.insert(t.tourDays).values(
      tour.days.map((day, index) => ({
        tourId: row.id,
        dayNumber: index + 1,
        title: day.title,
        description: lines(day.lines),
        city: day.city,
      })),
    );

    await db.insert(t.tourInclusions).values([
      ...sheetIncluded(tour.stay).map((text, index) => ({
        tourId: row.id,
        kind: 'included' as const,
        text,
        sortOrder: (index + 1) * 10,
      })),
      ...SHEET_EXCLUDED.map((text, index) => ({
        tourId: row.id,
        kind: 'excluded' as const,
        text,
        sortOrder: (index + 1) * 10,
      })),
    ]);

    await db
      .insert(t.tourPrices)
      .values(tour.prices.map(([pax, minor]) => ({ tourId: row.id, pax, priceMinor: minor })));

    written += 1;
  }

  return written;
}

/**
 * Gives the owner's tours their photographs, once there are photographs to give.
 *
 * Separate from the insert above because a fresh database has the tours before it has a single
 * picture: the seeder runs first and the Commons import second. So this is called from the end of
 * the import, where the rows have just appeared, and from `db:content`, where they appeared
 * months ago — and it does nothing at all on a database that has neither.
 *
 * Idempotent on both halves, and in the direction that matters: a cover somebody has since
 * chosen is never replaced, and a tour that already has a strip is never added to. Editing a
 * gallery is what the admin panel is for (D-117), and a script that re-asserts its own opinion
 * every time it runs would quietly undo that work.
 */
export async function attachOwnerTourMedia(db: Database): Promise<number> {
  const photos = await db
    .select({
      id: t.media.id,
      alt: t.media.alt,
      width: t.media.width,
      height: t.media.height,
    })
    .from(t.media);

  if (photos.length === 0) return 0;

  const resolve = ([subject, nth]: Photo): number | undefined => {
    const phrase = SUBJECT_ALT[subject];
    const matching = photos
      // Landscape only: every frame a tour uses is wider than it is tall, and a portrait
      // photograph in one is a vertical strip of its own middle.
      .filter(
        (photo) =>
          (photo.alt?.en ?? '').includes(phrase) && (photo.width ?? 0) > (photo.height ?? 0),
      )
      .sort((a, b) => a.id - b.id);

    return matching[nth % matching.length]?.id;
  };

  let touched = 0;

  for (const tour of TOURS) {
    const [row] = await db
      .select({ id: t.tours.id, coverMediaId: t.tours.coverMediaId })
      .from(t.tours)
      .where(eq(t.tours.slug, tour.slug))
      .limit(1);

    if (row === undefined) continue;

    let changed = false;
    let cover = row.coverMediaId;

    if (cover === null) {
      const chosen = resolve(tour.cover);
      if (chosen !== undefined) {
        await db.update(t.tours).set({ coverMediaId: chosen }).where(eq(t.tours.id, row.id));
        cover = chosen;
        changed = true;
      }
    }

    const strip = await db
      .select({ id: t.tourMedia.id })
      .from(t.tourMedia)
      .where(eq(t.tourMedia.tourId, row.id));

    if (strip.length === 0) {
      const values = tour.gallery
        .map((photo, index) => ({ mediaId: resolve(photo), sortOrder: (index + 1) * 10 }))
        .filter(
          (entry): entry is { mediaId: number; sortOrder: number } => entry.mediaId !== undefined,
        )
        /*
         * Never the cover.
         *
         * The tour page draws the cover large and the strip beneath it, so the same photograph in
         * both is one photograph shown twice — which reads as a mistake rather than as a choice.
         * It is not hypothetical: the five-day tour's cover is the horse the round-robin dealt it,
         * and the second Akhal-Teke frame by id is that very row.
         */
        .filter((entry) => entry.mediaId !== cover)
        // And never the same file twice within the strip: the unique index on (tour, media)
        // would reject the whole insert rather than the repeat.
        .filter(
          (entry, index, all) =>
            all.findIndex((other) => other.mediaId === entry.mediaId) === index,
        );

      if (values.length > 0) {
        await db.insert(t.tourMedia).values(values.map((entry) => ({ tourId: row.id, ...entry })));
        changed = true;
      }
    }

    if (changed) touched += 1;
  }

  return touched;
}
