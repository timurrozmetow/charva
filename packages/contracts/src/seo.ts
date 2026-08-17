import { DEFAULT_LANG, type Lang, type Site, SITE_LANGS, type SiteLang } from './constants';

/**
 * The head of every page, in one place.
 *
 * Until phase 8 these strings lived in each SPA's copy file, which was right while the browser
 * was the only thing that read them. It stopped being right the moment the API started
 * rendering the head into the shell (decision D-4): a crawler and a Telegram preview read the
 * server's version, a visitor navigating in the app reads the browser's, and two copies of one
 * title is exactly how those two come to disagree — silently, and only for the half of the
 * audience nobody tests as.
 *
 * So the strings moved here, to the one package both the API and the three SPAs already
 * import. Page copy stayed where it was: this module holds only what goes in `<head>`.
 */

export interface RouteMeta {
  title: string;
  description: string;
}

/** Route ids per site. The same keys the copy files used, so nothing was renamed in the move. */
export const SITE_ROUTES = {
  choice: ['home'],
  global: [
    'home',
    'tours',
    'builder',
    'hotels',
    'country',
    'reviews',
    'gallery',
    'video',
    'contact',
    'article',
    'notFound',
  ],
  umrah: ['home', 'paket', 'ziyarat', 'maksatnama', 'suratlar', 'yazylmak', 'notFound'],
} as const satisfies Record<Site, readonly string[]>;

export type SiteRoute<S extends Site> = (typeof SITE_ROUTES)[S][number];

/**
 * The brand each site signs its titles with.
 *
 * A detail page is «<name> — <brand>», and the brand is not the same word on both: the whole
 * point of the chooser is that these are two businesses to the reader.
 */
export const SITE_BRAND = {
  choice: 'Charva Travel',
  global: 'Charva Travel',
  umrah: 'Charva Umrah',
} as const satisfies Record<Site, string>;

const ROUTE_META = {
  choice: {
    home: {
      ru: {
        title: 'Charva Travel — туры по Туркменистану и умра',
        description:
          'Готовые туры и конструктор путешествий по Туркменистану, а также организованная умра с туркменской группой.',
      },
      en: {
        title: 'Charva Travel — tours of Turkmenistan and Umrah',
        description:
          'Ready-made tours and a trip builder for Turkmenistan, plus organised Umrah with a Turkmen-speaking group.',
      },
      tr: {
        title: 'Charva Travel — Türkmenistan turları ve umre',
        description:
          'Türkmenistan için hazır turlar ve gezi oluşturucu, ayrıca Türkmence konuşan grupla organize umre.',
      },
      tm: {
        title: 'Charva Travel — Türkmenistana syýahat we umra',
        description:
          'Türkmenistan boýunça taýýar turlar we syýahat gurnaýjy, şeýle hem türkmen topary bilen umra ziýarady.',
      },
    },
  },
  global: {
    tours: {
      ru: {
        title: 'Готовые туры по Туркменистану — Charva Travel',
        description:
          'Маршруты по Туркменистану с отелями, гидом и оформлением документов. Классика, пустыня, история, культура и отдых.',
      },
      en: {
        title: 'Ready-made tours of Turkmenistan — Charva Travel',
        description:
          'Routes across Turkmenistan with hotels, a guide and paperwork handled. Classic, desert, history, culture and leisure.',
      },
      tr: {
        title: 'Türkmenistan hazır turları — Charva Travel',
        description:
          'Otel, rehber ve belge işlemleri dahil Türkmenistan rotaları. Klasik, çöl, tarih, kültür ve dinlence.',
      },
    },
    builder: {
      ru: {
        title: 'Сборщик туров по Туркменистану — Charva Travel',
        description:
          'Соберите маршрут сами: города, дни, класс отеля, питание, транспорт и экскурсии. Стоимость видна сразу.',
      },
      en: {
        title: 'Turkmenistan tour builder — Charva Travel',
        description:
          'Build the route yourself: cities, days, hotel class, meals, transport and excursions. The price is visible as you go.',
      },
      tr: {
        title: 'Türkmenistan tur oluşturucu — Charva Travel',
        description:
          'Rotayı kendiniz kurun: şehirler, günler, otel sınıfı, yemek, ulaşım ve geziler. Fiyat anında görünür.',
      },
    },
    hotels: {
      ru: {
        title: 'Отели Туркменистана — Charva Travel',
        description:
          'Отели, бутик-отели и юрточный лагерь по Туркменистану: Ашхабад, Мары, Дашогуз, Аваза, Каракумы.',
      },
      en: {
        title: 'Hotels in Turkmenistan — Charva Travel',
        description:
          'Hotels, boutique hotels and a yurt camp across Turkmenistan: Ashgabat, Mary, Dashoguz, Awaza, the Karakum.',
      },
      tr: {
        title: 'Türkmenistan otelleri — Charva Travel',
        description:
          'Türkmenistan genelinde oteller, butik oteller ve çadır kampı: Aşkabat, Mary, Daşoguz, Avaza, Karakum.',
      },
    },
    country: {
      ru: {
        title: 'Туркменистан: о стране и визе — Charva Travel',
        description:
          'Факты о Туркменистане, порядок получения визы по приглашению и шесть мест, ради которых сюда едут.',
      },
      en: {
        title: 'Turkmenistan: the country and visas — Charva Travel',
        description:
          'Facts about Turkmenistan, how the invitation-based visa works, and six places people come for.',
      },
      tr: {
        title: 'Türkmenistan: ülke ve vize — Charva Travel',
        description:
          'Türkmenistan hakkında bilgiler, davetiyeli vize süreci ve uğruna gelinen altı yer.',
      },
    },
    reviews: {
      ru: {
        title: 'Отзывы о турах по Туркменистану — Charva Travel',
        description:
          'Отзывы путешественников о маршрутах Charva Travel: оценки, города и что запомнилось.',
      },
      en: {
        title: 'Reviews of tours in Turkmenistan — Charva Travel',
        description:
          'Travellers on Charva Travel routes: ratings, cities and what stayed with them.',
      },
      tr: {
        title: 'Türkmenistan tur yorumları — Charva Travel',
        description:
          'Charva Travel rotaları hakkında gezginlerin yorumları: puanlar, şehirler ve akılda kalanlar.',
      },
    },
    gallery: {
      ru: {
        title: 'Галерея Туркменистана — Charva Travel',
        description:
          'Фотографии из поездок по Туркменистану: Дарваза, Мерв, Ашхабад, Йангыкала, Аваза.',
      },
      en: {
        title: 'Turkmenistan gallery — Charva Travel',
        description:
          'Photographs from trips across Turkmenistan: Darvaza, Merv, Ashgabat, Yangykala, Awaza.',
      },
      tr: {
        title: 'Türkmenistan galerisi — Charva Travel',
        description:
          'Türkmenistan gezilerinden fotoğraflar: Darvaza, Merv, Aşkabat, Yangıkala, Avaza.',
      },
    },
    video: {
      ru: {
        title: 'Видео о Туркменистане — Charva Travel',
        description: 'Видео из поездок по Туркменистану: кратер Дарваза, Мерв, ахалтекинские кони.',
      },
      en: {
        title: 'Video about Turkmenistan — Charva Travel',
        description:
          'Video from trips across Turkmenistan: the Darvaza crater, Merv, Akhal-Teke horses.',
      },
      tr: {
        title: 'Türkmenistan videoları — Charva Travel',
        description: 'Türkmenistan gezilerinden videolar: Darvaza krateri, Merv, Ahal-Teke atları.',
      },
    },
    home: {
      ru: {
        title: 'Charva Travel — туры по Туркменистану',
        description:
          'Туроператор по Туркменистану: готовые маршруты, отели, виза по приглашению и гид. Соберите свой тур — расчёт появится сразу.',
      },
      en: {
        title: 'Charva Travel — tours of Turkmenistan',
        description:
          'A tour operator in Turkmenistan: ready-made routes, hotels, visa support and guides. Build your own tour and see the price at once.',
      },
      tr: {
        title: 'Charva Travel — Türkmenistan turları',
        description:
          'Türkmenistan tur operatörü: hazır rotalar, oteller, davetiyeli vize ve rehber. Kendi turunuzu kurun, fiyatı hemen görün.',
      },
    },
    contact: {
      ru: {
        title: 'Онлайн-заявка — Charva Travel',
        description:
          'Заявка на тур по Туркменистану: маршрут, отели, виза и трансфер. Ответ менеджера в течение 15 минут.',
      },
      en: {
        title: 'Online enquiry — Charva Travel',
        description:
          'Enquire about a tour of Turkmenistan: route, hotels, visa and transfers. A manager replies within 15 minutes.',
      },
      tr: {
        title: 'Çevrimiçi talep — Charva Travel',
        description:
          'Türkmenistan turu talebi: rota, oteller, vize ve transfer. Yetkilimiz 15 dakika içinde yanıtlar.',
      },
    },
    article: {
      ru: {
        title: 'Журнал о Туркменистане — Charva Travel',
        description:
          'Статьи о поездках по Туркменистану: когда ехать, как получить визу, что попробовать и что привезти.',
      },
      en: {
        title: 'A journal about Turkmenistan — Charva Travel',
        description:
          'Articles about travelling in Turkmenistan: when to go, how to get a visa, what to eat and what to bring home.',
      },
      tr: {
        title: 'Türkmenistan dergisi — Charva Travel',
        description:
          'Türkmenistan gezileri üzerine yazılar: ne zaman gitmeli, vize nasıl alınır, ne yenir ve ne getirilir.',
      },
    },
    notFound: {
      ru: {
        title: 'Страница не найдена — Charva Travel',
        description:
          'Возможно, ссылка устарела. Начните с главной или напишите нам — подскажем маршрут.',
      },
      en: {
        title: 'Page not found — Charva Travel',
        description:
          'The link may be out of date. Start from the home page, or write to us and we will point the way.',
      },
      tr: {
        title: 'Sayfa bulunamadı — Charva Travel',
        description:
          'Bağlantı eski olabilir. Ana sayfadan başlayın ya da bize yazın, yolu gösterelim.',
      },
    },
  },
  umrah: {
    home: {
      tm: {
        title: 'Charva Umrah — türkmen topary bilen umra ziýaraty',
        description:
          'Aşgabatdan umra: uçar bileti, wiza, Mekgede we Medinede 4 ★ otel, türkmen dilli ýolbaşçy. Toparyň ugraýan senesi we boş ýerler.',
      },
      ru: {
        title: 'Charva Umrah — умра с туркменской группой',
        description:
          'Умра из Ашхабада: перелёт, виза, отели 4 ★ в Мекке и Медине, сопровождающий на туркменском. Дата вылета и свободные места.',
      },
    },
    paket: {
      tm: {
        title: 'Umra paketiniň düzümi — Charva Umrah',
        description:
          'Umra paketine näme girýär: uçar bileti, wiza, otel, nahar, transfer we türkmen dilli ýolbaşçy. Şertler we ýazylyş tertibi.',
      },
      ru: {
        title: 'Состав пакета умры — Charva Umrah',
        description:
          'Что входит в пакет умры: перелёт, виза, отель, питание, транспорт и сопровождающий на туркменском. Условия и порядок записи.',
      },
    },
    ziyarat: {
      tm: {
        title: 'Ziýarat ýerleri — Charva Umrah',
        description:
          'Masjid al-Haram, Masjid an-Nabawi, Uhud, Bedir, Kuba we beýleki ziýarat ýerleri — umra maksatnamasynda.',
      },
      ru: {
        title: 'Места зиярата — Charva Umrah',
        description:
          'Масджид аль-Харам, Масджид ан-Набави, Ухуд, Бадр, Куба и другие места зиярата в программе умры.',
      },
    },
    maksatnama: {
      tm: {
        title: 'Umra maksatnamasy gün-günden — Charva Umrah',
        description:
          'Aşgabatdan ugramakdan dolanmaga çenli umra maksatnamasy: Mekge, Medine, Bedir we Uhud ziýaratlary.',
      },
      ru: {
        title: 'Программа умры по дням — Charva Umrah',
        description:
          'Программа умры от вылета из Ашхабада до возвращения: Мекка, Медина, зияраты Бадра и Ухуда.',
      },
    },
    suratlar: {
      tm: {
        title: 'Toparlarymyzyň suratlary — Charva Umrah',
        description: 'Umra toparlarymyzyň suratlary we wideolary: Mekge, Medine, Bedir we Uhud.',
      },
      ru: {
        title: 'Фотографии наших групп — Charva Umrah',
        description: 'Фото и видео групп умры: Мекка, Медина, Бадр и Ухуд.',
      },
    },
    yazylmak: {
      tm: {
        title: 'Topara ýazylmak — Charva Umrah',
        description:
          'Umra toparyna onlaýn arza: ady, telefony we adam sany. Ýolbaşçy jaň edip şertleri düşündirer.',
      },
      ru: {
        title: 'Записаться в группу — Charva Umrah',
        description:
          'Онлайн-заявка в группу умры: имя, телефон и число человек. Сопровождающий позвонит и объяснит условия.',
      },
    },
    notFound: {
      tm: {
        title: 'Sahypa tapylmady — Charva Umrah',
        description:
          'Belki salgy köneldi. Baş sahypadan başlaň ýa-da topara ýazylyň — ýolbaşçy jaň eder.',
      },
      ru: {
        title: 'Страница не найдена — Charva Umrah',
        description:
          'Возможно, ссылка устарела. Начните с главной или запишитесь в группу — сопровождающий позвонит.',
      },
    },
  },
} as const satisfies {
  /*
   * Every route of every site, in every language that site offers.
   *
   * Not `Partial`: these are interface strings, and they are ours to write rather than
   * something a translator still owes us (R-4 is about *content*). A missing Turkish title
   * would otherwise fall back to Russian silently and stay that way, because a head is the one
   * part of a page nobody looks at.
   */
  [S in Site]: Record<SiteRoute<S>, Record<SiteLang<S>, RouteMeta>>;
};

/**
 * The head for a static route.
 *
 * Falls back to the site's default language rather than to an empty string: a Turkish page
 * whose title never got translated should carry the Russian one, which is at least a title.
 * Which languages a site has at all is `SITE_LANGS`, so this can only ever fall back within
 * the set that site actually offers.
 */
export function routeMeta<S extends Site>(site: S, route: SiteRoute<S>, lang: Lang): RouteMeta {
  const perLang = (ROUTE_META[site] as Record<string, Partial<Record<Lang, RouteMeta>>>)[route];
  if (perLang === undefined) {
    throw new Error(`No head copy for ${site}/${route}`);
  }

  /*
   * The fallback is for a language this site does not speak.
   *
   * Within the set a site offers, the type above guarantees every string exists — so this only
   * fires when `?lang=tr` reaches Umrah, which is a routing bug. The head still has to say
   * something, and the site's own default is the only sensible thing for it to say.
   */
  return (
    perLang[lang] ?? perLang[DEFAULT_LANG[site]] ?? { title: SITE_BRAND[site], description: '' }
  );
}

/**
 * The head for a page built out of a database row — a tour, a hotel, an article, a place.
 *
 * The template is here rather than at the two call sites for the same reason the static
 * strings are: the API renders this for the crawler and the SPA renders it again on
 * navigation, and they have to produce the same string.
 */
export function contentMeta(
  site: Site,
  content: { name: string; summary?: string | null | undefined },
): RouteMeta {
  const summary = content.summary ?? '';
  return {
    title: `${content.name} — ${SITE_BRAND[site]}`,
    // Long descriptions are cut by every consumer of them anyway, and cut mid-word. 160
    // characters is where Google stops and where a Telegram card stops looking deliberate.
    description: summary.length > 160 ? `${summary.slice(0, 157).trimEnd()}…` : summary,
  };
}

/** Every language a site offers, plus `x-default`, which points at that site's default. */
export function hreflangSet(site: Site): { hreflang: string; lang: Lang }[] {
  const langs: readonly Lang[] = SITE_LANGS[site];
  return [
    ...langs.map((lang) => ({ hreflang: lang, lang })),
    { hreflang: 'x-default', lang: DEFAULT_LANG[site] },
  ];
}
