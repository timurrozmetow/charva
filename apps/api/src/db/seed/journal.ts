import { eq } from 'drizzle-orm';

import { type Database } from '../client';
import * as t from '../schema';

/**
 * The journal.
 *
 * A section the design never drew and the site badly needed. Everything a visitor wants to know
 * before coming here — how the visa actually works, whether Darvaza is worth a night in a tent,
 * when the heat breaks — is a question somebody types into a search engine months before they
 * ever type the name of a tour operator. A catalogue page cannot answer any of it, and the two
 * articles that existed were a headline and one sentence each, with an empty body: two pages in
 * the sitemap with nothing on them.
 *
 * Three rules govern what is written below, and they are worth stating because the temptation
 * runs the other way on every one of them.
 *
 * **No figure that moves.** No visa fee, no processing time, no opening hours, no prices. Those
 * change, nobody here is the authority on them, and a wrong one on a page that reads
 * confidently is worse than a page that does not mention them — it costs somebody a flight.
 * Where a number matters, the text says to ask, which is also true and also useful.
 *
 * **No claim about the business.** These are articles about a country. The one operational thing
 * they state — that a Turkmen tourist visa runs on an invitation obtained by a licensed operator
 * — is the reason this company exists and is written plainly rather than sold.
 *
 * **Disputed things are said to be disputed.** The usual story about when the Darvaza crater was
 * lit is repeated everywhere and is not settled; saying so costs one clause and is the
 * difference between a travel page and a page that copied another travel page.
 *
 * Russian and English only. Turkish is retired from the site (Q-17), and ten articles of
 * machine-grade Turkish would be worse than none — `pickLocale` falls back, and the i18n report
 * counts the gap honestly.
 *
 * Idempotent by slug, because unlike the rest of the seeds this also runs against the live
 * database, where the catalogue already exists. An article that is already there is left alone
 * except for one case: a row whose body is still empty gets one, which is how the two the design
 * left behind are filled in.
 */

interface Article {
  slug: string;
  tag: { ru: string; en: string };
  title: { ru: string; en: string };
  summary: { ru: string; en: string };
  body: { ru: string; en: string };
  readMinutes: number;
  isFeatured?: boolean;
}

const ARTICLES: Article[] = [
  {
    slug: 'viza-v-turkmenistan',
    tag: { ru: 'Виза', en: 'Visa' },
    title: {
      ru: 'Виза в Туркменистан: как она на самом деле устроена',
      en: 'The Turkmen visa: how it actually works',
    },
    summary: {
      ru: 'Почему нельзя просто подать документы в посольство и при чём здесь туроператор.',
      en: 'Why you cannot simply apply at an embassy, and where the tour operator comes in.',
    },
    readMinutes: 6,
    isFeatured: true,
    body: {
      ru: `Туркменистан — одна из немногих стран, куда туристическая виза не выдаётся по заявлению путешественника. Всё начинается не с посольства, а с приглашения, и получить его может только лицензированный туроператор внутри страны.

Порядок такой. Вы выбираете маршрут и даты и присылаете оператору сканы паспорта и анкетные данные. Оператор подаёт документы в Государственную миграционную службу и ждёт решения. Если приглашение одобрено, вам приходит его номер — и только с этим номером вы идёте в посольство или получаете визу по прилёте в Ашхабад, если это оговорено заранее.

Из этого следует главное, чего обычно не ожидают: **виза привязана к маршруту**. Приглашение оформляется на конкретную программу с конкретными городами и датами, и сопровождение оператора — часть этой схемы, а не дополнительная услуга, от которой можно отказаться ради экономии. Свободное самостоятельное перемещение по стране туристическая виза не предполагает.

Отдельно существует транзитная виза — на несколько дней, для тех, кто едет из одной соседней страны в другую, скажем из Ирана в Узбекистан. Она не требует приглашения, но выдаётся по усмотрению консульства, и отказ не объясняют. Планировать поездку вокруг транзитной визы рискованно: если её не дадут, заменить её будет нечем.

Сроки и сборы здесь сознательно не названы. И то и другое меняется, и единственный честный ответ — спросить перед подачей: мы назовём то, что действует на сегодня, и скажем, сколько ждать именно в вашем случае. Одно правило устойчиво: начинать стоит сильно заранее. Приглашение — это не формальность, которую оформляют за день.

Что подготовить заранее: загранпаспорт, действительный не меньше полугода после предполагаемого выезда, скан главной страницы, данные о месте работы и маршрут, который вы готовы подтвердить. Чем раньше приходят сканы, тем раньше уходит заявка.`,
      en: `Turkmenistan is one of the few countries where a tourist visa is not issued on the traveller's own application. It does not begin at an embassy. It begins with a letter of invitation, and only a licensed tour operator inside the country can obtain one.

The order is this. You settle on a route and dates and send the operator a scan of your passport and the application details. The operator files with the State Migration Service and waits for a decision. If the invitation is approved you receive its number — and only with that number do you go to the embassy, or collect the visa on arrival in Ashgabat if that has been agreed in advance.

From which follows the thing most people do not expect: **the visa is tied to the itinerary**. The invitation is issued against a specific programme, with specific cities and dates, and the operator's accompaniment is part of that arrangement rather than an add-on to be declined for economy. A tourist visa does not contemplate travelling the country unaccompanied.

There is also a transit visa — a few days, for travellers crossing from one neighbouring country to another, say Iran to Uzbekistan. It needs no invitation, but it is granted at the consulate's discretion and a refusal is not explained. Planning a trip around one is a risk: if it does not come, there is nothing to replace it with.

Fees and processing times are deliberately not given here. Both change, and the only honest answer is to ask before you file: we will tell you what applies today and how long it is likely to take in your case. One rule holds steady — start well ahead. An invitation is not a formality anybody arranges in a day.

What to have ready: a passport valid for at least six months beyond your intended departure, a scan of its main page, your employment details, and an itinerary you are prepared to commit to. The sooner the scans arrive, the sooner the application goes in.`,
    },
  },
  {
    slug: 'krater-darvaza',
    tag: { ru: 'Пустыня', en: 'Desert' },
    title: {
      ru: 'Кратер Дарваза: зачем ехать ночью в середину пустыни',
      en: 'The Darvaza crater: why you go into the desert at night',
    },
    summary: {
      ru: 'Горящая яма в Каракумах, дорога к ней и почему днём там смотреть почти не на что.',
      en: 'A burning pit in the Karakum, the road to it, and why daylight wastes the trip.',
    },
    readMinutes: 5,
    isFeatured: true,
    body: {
      ru: `Примерно в двухстах шестидесяти километрах к северу от Ашхабада, рядом с посёлком Дарваза, в песке горит яма около семидесяти метров в поперечнике. Горит она десятилетиями, и местные называют её «Вратами ада» — название прижилось настолько, что его знают люди, которые больше ничего о Туркменистане не знают.

Обычно рассказывают, что кратер образовался при бурении, а газ подожгли, чтобы он не отравлял окрестности, и он не потух. Датируют это началом семидесятых. Историю повторяют все путеводители, но документальных подтверждений у неё мало, и точная дата спорна. Честнее сказать так: яма рукотворная, горит очень давно, и сколько именно — никто не может подтвердить бумагой.

**Ехать надо на ночь.** Днём это неглубокая серая воронка с дрожащим воздухом над ней; фотографии, ради которых сюда едут, получаются, когда вокруг темно. Поэтому стандартная схема — выехать из Ашхабада во второй половине дня, приехать к закату, ночевать рядом в юртовом лагере или палатках и уехать утром.

Дорога: асфальт до поворота, дальше несколько километров по песку, которые проходятся только на полном приводе. Обычная легковая машина туда не доедет, и это не осторожность, а факт.

Что взять: тёплую одежду — в пустыне ночью холодно в любое время года, включая июль; воду больше, чем кажется нужным; и фонарь. У края нет ограждения и нет освещения, кроме самого огня.

Стоит иметь в виду, что власти не раз заявляли о намерении потушить кратер. Пока он горит, но обещать, что он будет гореть через пять лет, нельзя.`,
      en: `About two hundred and sixty kilometres north of Ashgabat, beside the village of Darvaza, a pit some seventy metres across burns in the sand. It has burned for decades, and locally it is called the Gates of Hell — a name that has travelled so well that people who know nothing else about Turkmenistan know it.

The usual account is that the crater opened during drilling and the gas was set alight so that it would not poison the area, and that it never went out. The date given is the early 1970s. Every guidebook repeats it; documentary evidence is thin and the date is disputed. The honest version: the pit is man-made, it has burned a very long time, and nobody can produce a paper saying exactly how long.

**Go at night.** By day it is a shallow grey hollow with the air shaking above it; the photographs people come for happen when everything around is dark. So the standard shape of the trip is to leave Ashgabat in the afternoon, arrive at sunset, sleep beside it in a yurt camp or tents, and drive back in the morning.

The road: tarmac to the turning, then a few kilometres of sand that only a four-wheel drive will cross. An ordinary car does not get there. That is not caution, it is a fact.

What to bring: warm clothes — the desert is cold at night in any season, July included; more water than seems necessary; and a torch. There is no railing at the edge and no light but the fire.

Worth knowing that the authorities have more than once announced an intention to extinguish it. For now it burns, but nobody can promise it will still be burning in five years.`,
    },
  },
  {
    slug: 'drevniy-merv',
    tag: { ru: 'История', en: 'History' },
    title: {
      ru: 'Мерв: город, от которого остались стены',
      en: 'Merv: the city that is now its walls',
    },
    summary: {
      ru: 'Пять городов один рядом с другим, мавзолей Санджара и почему всё это из глины.',
      en: 'Five cities side by side, the Sanjar mausoleum, and why all of it is mud brick.',
    },
    readMinutes: 6,
    body: {
      ru: `Под Мары, в получасе езды от современного города, лежит то, что ЮНЕСКО внесло в список Всемирного наследия в 1999 году: Государственный историко-культурный парк «Древний Мерв». Это не одни развалины, а несколько городов, стоящих рядом — каждый следующий строили не поверх предыдущего, а поодаль.

Самая старая часть — Эрк-Кала, круглая крепость, от которой остался земляной вал высотой с трёхэтажный дом. Вокруг неё Гяур-Кала эллинистического времени, затем Султан-Кала — Мерв времён Сельджукидов, когда город был одним из крупнейших в мире. Отдельно стоят две Кыз-Калы, «девичьи крепости», с характерными гофрированными стенами, каких больше почти нигде не увидеть.

Главное здание — мавзолей султана Санджара, XII век. Огромный куб с куполом посреди пустой равнины; когда-то он стоял внутри плотно застроенного города, и именно это труднее всего вообразить на месте.

**Всё здесь построено из сырцового кирпича и глины.** Это объясняет и вид, и судьбу: камня в оазисе не было, строили из того, что под ногами, и дождь с ветром работают над этими стенами уже восемь веков. Поэтому Мерв не выглядит как античный город с колоннами — он выглядит как рельеф. Тому, кто ждёт открыток, стоит настроиться заранее; тому, кто понимает, на что смотрит, здесь мало равных в Средней Азии.

Практическое: тени почти нет, расстояния между объектами — километры, и передвигаться между ними надо на машине. Лучшее время — утро или вечер, худшее — середина летнего дня. Без человека, который объяснит, где кончается один город и начинается другой, значительная часть впечатления пропадает.`,
      en: `Outside Mary, half an hour from the modern city, lies what UNESCO inscribed on the World Heritage list in 1999: the State Historical and Cultural Park «Ancient Merv». It is not one ruin but several cities standing side by side — each new one built not on top of the last but a little way off.

The oldest part is Erk Gala, a round citadel now reduced to an earth rampart the height of a three-storey house. Around it is Gyaur Gala of the Hellenistic period, then Sultan Gala — the Merv of the Seljuks, when the city was among the largest in the world. Apart from these stand the two Kyz Galas, the «maiden fortresses», with the corrugated walls you will hardly see anywhere else.

The principal building is the mausoleum of Sultan Sanjar, twelfth century: an enormous domed cube in the middle of an empty plain. It once stood inside a densely built city, and that is the hardest thing to picture while standing there.

**All of it is mud brick and clay.** That explains both the look and the fate: there was no stone in the oasis, so they built with what was underfoot, and rain and wind have been working on these walls for eight centuries. Merv therefore does not look like a classical city with columns — it looks like terrain. Anyone expecting postcards should adjust in advance; anyone who understands what they are looking at will find few equals in Central Asia.

Practical notes: there is almost no shade, the distances between sites are kilometres, and you move between them by car. Morning or evening is best, the middle of a summer day is worst. Without someone to explain where one city ends and the next begins, a good deal of the point is lost.`,
    },
  },
  {
    slug: 'kunya-urgench',
    tag: { ru: 'История', en: 'History' },
    title: {
      ru: 'Куня-Ургенч: минарет выше всех в Средней Азии',
      en: 'Kunya-Urgench: the tallest minaret in Central Asia',
    },
    summary: {
      ru: 'Столица Хорезма, которую дважды разрушили, и что от неё осталось на севере страны.',
      en: 'The Khorezm capital destroyed twice over, and what is left of it in the north.',
    },
    readMinutes: 5,
    body: {
      ru: `На севере Туркменистана, в Дашогузском велаяте у самой узбекской границы, стоит Куня-Ургенч — «Старый Ургенч». В Средние века это была столица Хорезма и один из главных городов исламского мира. Город разрушали дважды: монголы в XIII веке и Тимур в конце XIV. После второго раза его не стали восстанавливать на прежнем месте, и именно поэтому здесь есть что смотреть — новый город не сел поверх старого. ЮНЕСКО включило Куня-Ургенч в список Всемирного наследия в 2005 году.

Самое заметное — минарет Кутлуг-Тимура, около шестидесяти метров. Это самый высокий древний минарет в Средней Азии; он стоит один посреди поля, без мечети, к которой когда-то относился, и масштаб доходит только вблизи.

Рядом мавзолей Тюрабек-ханым — здание, ради которого сюда едут те, кто разбирается. Под куполом сохранилась мозаика, и когда в неё всматриваешься, понимаешь, что это не орнамент вообще, а очень точная геометрия. Чуть в стороне — мавзолей Иль-Арслана, небольшой, с редкой конической крышей.

**Куня-Ургенч — действующее место паломничества**, а не только памятник. Туркмены приезжают сюда с собственными традициями и обрядами, и в выходные здесь бывает людно. Это стоит учитывать: вы находитесь не в музее, и вести себя разумно — не только вежливость, но и условие того, чтобы вас здесь были рады видеть.

Логистика: от Ашхабада это долгий день на машине через пустыню, поэтому Куня-Ургенч обычно ставят в маршрут вместе с Дашогузом и переходом в Узбекистан, а не отдельной поездкой туда и обратно.`,
      en: `In the north of Turkmenistan, in Dashoguz province close to the Uzbek border, stands Kunya-Urgench — «Old Urgench». In the Middle Ages it was the capital of Khorezm and one of the principal cities of the Islamic world. It was destroyed twice: by the Mongols in the thirteenth century and by Timur at the end of the fourteenth. After the second time it was not rebuilt on the same spot, which is exactly why there is something to see — no new town settled on top of the old one. UNESCO inscribed it in 2005.

The most conspicuous thing is the Kutlug Timur minaret, some sixty metres high. It is the tallest ancient minaret in Central Asia, and it stands alone in a field without the mosque it once belonged to; the scale only registers close up.

Beside it is the mausoleum of Turabek Khanum — the building the people who know come for. Mosaic survives under the dome, and when you look into it properly you realise it is not ornament in general but very exact geometry. A little apart stands the mausoleum of Il-Arslan, small, with an unusual conical roof.

**Kunya-Urgench is a working place of pilgrimage**, not only a monument. Turkmen come here with their own traditions and observances, and at weekends it can be busy. That is worth keeping in mind: you are not in a museum, and behaving sensibly is not only courtesy but the condition of being welcome.

Logistics: from Ashgabat this is a long day's drive across the desert, so Kunya-Urgench is normally built into a route together with Dashoguz and the crossing into Uzbekistan rather than made a trip out and back.`,
    },
  },
  {
    slug: 'ashgabat-za-odin-den',
    tag: { ru: 'Города', en: 'Cities' },
    title: {
      ru: 'Ашхабад за один день',
      en: 'Ashgabat in a day',
    },
    summary: {
      ru: 'Белый мрамор, рекорд Гиннесса, парфянская Ниса под боком и что успеть, если день один.',
      en: 'White marble, a Guinness record, Parthian Nisa next door, and what fits into one day.',
    },
    readMinutes: 6,
    body: {
      ru: `Ашхабад ни на что не похож, и понимаешь это в первые пятнадцать минут по дороге из аэропорта. Город почти целиком выстроен заново за последние тридцать лет и облицован белым мрамором — в 2013 году он попал в Книгу рекордов Гиннесса как город с самой высокой плотностью зданий из белого мрамора. Улицы широкие, здания стоят просторно, и днём от всего этого рябит в глазах.

Так вышло не от избытка вкуса к белому. В 1948 году Ашхабад был почти полностью разрушен землетрясением, и того города, что был до него, практически не осталось. Нынешний — целиком послевоенный и в значительной части постсоветский.

Если день один, разумный порядок такой. Утром — **Ниса**, парфянская крепость в получасе от города, тоже объект ЮНЕСКО: земляные стены на холме и вид на Копетдаг, который ближе к полудню начинает теряться в дымке. Затем город: Монумент нейтралитета, площади, мечеть Эртогрул-Гази. Во второй половине дня — **музей ковра**, где хранится один из крупнейших в мире ковров ручной работы; это не «ещё один музей», а самое туркменское, что есть в городе.

Вечер стоит оставить на прогулку: подсветку здесь включают щедро, и город, который днём слепит, вечером выглядит совсем иначе.

Два практических замечания. Съёмка государственных зданий и людей в форме — тема, к которой относятся серьёзно; если сомневаетесь, спросите сопровождающего, а не проверяйте на себе. И второе: летом с полудня до четырёх на улице делать нечего, планируйте на это время помещение.`,
      en: `Ashgabat resembles nothing else, and you understand that within fifteen minutes of leaving the airport. The city has been rebuilt almost entirely over the last thirty years and faced in white marble — in 2013 it entered the Guinness Book of Records for the highest concentration of white marble buildings in the world. The streets are wide, the buildings stand far apart, and in daylight the whole thing dazzles.

This did not happen out of a fondness for white. In 1948 Ashgabat was almost completely destroyed by an earthquake, and virtually nothing of the earlier city survived. What stands now is entirely post-war and in large part post-Soviet.

If you have one day, a sensible order is this. Morning: **Nisa**, the Parthian fortress half an hour out of town and also a UNESCO site — earth walls on a hill and a view of the Kopetdag that starts dissolving into haze towards noon. Then the city: the Neutrality Monument, the squares, the Ertugrul Gazi mosque. In the afternoon, the **carpet museum**, which holds one of the largest hand-woven carpets in the world; this is not «another museum» but the most Turkmen thing in the city.

Leave the evening for a walk. The lighting here is generous, and a city that dazzles by day looks like something else entirely after dark.

Two practical notes. Photographing government buildings and people in uniform is taken seriously; if in doubt ask your guide rather than find out for yourself. And from midday to four in summer there is nothing to be done outdoors — plan something indoors for those hours.`,
    },
  },
  {
    slug: 'yangykala-kanony',
    tag: { ru: 'Природа', en: 'Nature' },
    title: {
      ru: 'Йангыкала: каньоны на дне исчезнувшего океана',
      en: 'Yangykala: canyons on the floor of a vanished ocean',
    },
    summary: {
      ru: 'Розовые и белые слои в трёх часах от Каспия, и почему ехать надо к закату.',
      en: 'Pink and white strata three hours from the Caspian, and why you go for sunset.',
    },
    readMinutes: 4,
    body: {
      ru: `Йангыкала — обрывы в Балканском велаяте, примерно в ста шестидесяти километрах от Туркменбаши. Слои породы идут полосами: розовой, красной, жёлтой, белой, — и тянутся до горизонта. Название переводят как «огненные крепости», и на закате понятно почему.

Это дно древнего океана Тетис. Полосы — осадочные отложения, оставшиеся, когда вода ушла, и в них читается время: каждая линия — это эпоха. Ракушки в камне здесь находят прямо под ногами.

**Свет решает всё.** В полдень порода выцветает и выглядит серовато-бежевой; за час до заката она становится тем, ради чего сюда едут за четыреста километров в один конец. Поэтому маршруты строят так, чтобы приехать под вечер, а не «заглянуть по дороге».

Инфраструктуры нет никакой: ни воды, ни тени, ни ограждений, ни связи на значительной части пути. Дорога частично грунтовая, нужен полный привод и водитель, который здесь уже был. Обрывы отвесные и края осыпаются — подходить к ним близко ради кадра здесь опаснее, чем кажется.

Йангыкала обычно совмещают с Каспием: ночь в Туркменбаши или в Авазе, день на каньоны, и обратно. Отдельной поездкой из Ашхабада это очень длинно.`,
      en: `Yangykala is a line of cliffs in Balkan province, about a hundred and sixty kilometres from Turkmenbashi. The rock runs in bands — pink, red, yellow, white — stretching to the horizon. The name is usually translated as «fire fortresses», and at sunset it is obvious why.

This is the floor of the ancient Tethys Ocean. The bands are sediment left behind when the water withdrew, and time is legible in them: every line is an epoch. Shells turn up in the stone underfoot.

**Light decides everything here.** At midday the rock bleaches out to a greyish beige; an hour before sunset it becomes the thing people drive four hundred kilometres one way to see. So routes are built to arrive towards evening rather than to look in on the way past.

There is no infrastructure of any kind: no water, no shade, no railings, and no phone signal over much of the drive. Part of the road is unsurfaced, and it takes a four-wheel drive and a driver who has been there before. The cliffs are sheer and the edges crumble — going close for a photograph is more dangerous here than it looks.

Yangykala is normally combined with the Caspian: a night in Turkmenbashi or Awaza, a day for the canyons, and back. As a separate trip from Ashgabat it is a very long way.`,
    },
  },
  {
    slug: 'kogda-ehat-v-turkmenistan',
    tag: { ru: 'Практика', en: 'Practical' },
    title: {
      ru: 'Когда ехать в Туркменистан',
      en: 'When to travel to Turkmenistan',
    },
    summary: {
      ru: 'Два коротких окна в году, в которые здесь по-настоящему хорошо, и что происходит в остальные месяцы.',
      en: 'Two short windows when the country is genuinely comfortable, and what the rest is like.',
    },
    readMinutes: 5,
    isFeatured: true,
    body: {
      ru: `Климат здесь резко континентальный и пустынный, поэтому разброс температур в течение года огромный, а межсезонье короткое. Практически весь туризм укладывается в два окна.

**Апрель — май.** Лучшее время. Днём тепло, но не жарко, пустыня после зимних дождей ненадолго зеленеет и цветёт, воздух прозрачный — горы видно. В конце апреля отмечают День туркменского скакуна, и это единственная возможность увидеть ахалтекинцев в массе, а не поодиночке.

**Сентябрь — октябрь.** Жара спадает, вода в Каспии ещё тёплая, и это сезон дынь и винограда. Многие считают осень даже лучше весны: людей меньше, а еда в это время такая, ради какой стоит ехать отдельно.

Лето — с июня по август — это сорок с лишним градусов днём, регулярно и без перерыва. Ехать можно, но программу придётся строить вокруг жары: ранний выезд, длинный перерыв в середине дня, осмотр под вечер. Развалины Мерва в два часа дня в июле — плохая идея, а не испытание характера.

Зима мягче, чем ожидают, но ветреная и неуютная: около нуля, иногда ниже, и открытые пространства продуваются насквозь. Пустыня и каньоны зимой выглядят голо.

И отдельно: **в пустыне ночью холодно круглый год.** Тёплая вещь нужна и в июле — это первое, что забывают те, кто собирается на Дарвазу.`,
      en: `The climate is sharply continental and desert, so the annual range is enormous and the shoulder seasons are short. Practically all travel here fits into two windows.

**April and May.** The best time. Warm by day without being hot, the desert briefly green and flowering after the winter rain, the air clear enough to see the mountains. The Turkmen Horse Day falls at the end of April, and it is the one occasion to see Akhal-Tekes in numbers rather than one at a time.

**September and October.** The heat breaks, the Caspian is still warm, and it is the season of melons and grapes. Plenty of people think autumn beats spring: fewer visitors, and food worth making a separate journey for.

Summer — June to August — means forty degrees and more by day, steadily and without relief. You can travel, but the programme has to be built around the heat: an early start, a long break in the middle of the day, sightseeing towards evening. The ruins of Merv at two in the afternoon in July are a bad idea, not a test of character.

Winter is milder than people expect but windy and uncomfortable: around freezing, sometimes below, and open ground offers nothing to shelter behind. The desert and the canyons look bare.

And separately: **the desert is cold at night all year round.** You need something warm even in July — the first thing forgotten by anyone packing for Darvaza.`,
    },
  },
  {
    slug: 'ahaltekinskie-koni',
    tag: { ru: 'Культура', en: 'Culture' },
    title: {
      ru: 'Ахалтекинец: конь, который на гербе',
      en: 'The Akhal-Teke: the horse on the coat of arms',
    },
    summary: {
      ru: 'Одна из древнейших пород в мире, металлический блеск шерсти и где её увидеть.',
      en: 'One of the oldest breeds in the world, its metallic sheen, and where to see it.',
    },
    readMinutes: 4,
    body: {
      ru: `Ахалтекинская лошадь — не просто местная порода, а государственный символ: она изображена на гербе Туркменистана. Порода считается одной из древнейших в мире и выводилась в оазисе Ахал у подножия Копетдага; отсюда и название — ахалтекинец, конь текинцев Ахала.

Узнать её легко. Очень сухая, высокая, с длинной шеей и тонкой кожей, под которой видно всё. Главное — шерсть: у многих ахалтекинцев она отливает металлом, буквально как позолота или серебро на солнце. Этот блеск — особенность структуры волоса, и на фотографиях он передаётся хуже, чем есть.

Порода выводилась для пустыни, и это объясняет её характер: выносливость на длинных переходах, терпимость к жаре и жажде — и привязанность к одному человеку. Ахалтекинца принято описывать не как послушного, а как избирательного.

**Где увидеть.** Конные комплексы есть под Ашхабадом, и заехать можно в любой сезон. Но если выбирать дату — это последнее воскресенье апреля, День туркменского скакуна: скачки, конкурс красоты лошадей, показательные выступления. Единственный день в году, когда порода показывается целиком, а не по одной лошади в деннике.

Если конная тема для вас главная, стоит сказать об этом заранее: это меняет и даты, и маршрут, и то, куда именно имеет смысл заезжать.`,
      en: `The Akhal-Teke is not merely a local breed but a state symbol: it appears on the coat of arms of Turkmenistan. It is held to be one of the oldest breeds in the world, developed in the Akhal oasis at the foot of the Kopetdag — hence the name, the horse of the Teke of Akhal.

It is easy to recognise. Very lean, tall, long-necked, with skin thin enough to show everything under it. Above all the coat: on many Akhal-Tekes it has a metallic sheen, literally like gilt or silver in the sun. The shine comes from the structure of the hair, and photographs convey it worse than it deserves.

The breed was made for the desert, which explains its temperament: endurance over long distances, tolerance of heat and thirst — and attachment to one person. Akhal-Tekes are usually described not as obedient but as selective.

**Where to see them.** There are equestrian complexes outside Ashgabat, and you can visit in any season. But if you are choosing a date, it is the last Sunday of April, the Turkmen Horse Day: racing, a horse beauty contest, displays. The one day in the year when the breed is shown as a whole rather than one animal in a stall.

If horses are the main reason you are coming, say so early: it changes the dates, the route, and which places are actually worth including.`,
    },
  },
  {
    slug: 'chto-est-v-turkmenistane',
    tag: { ru: 'Кухня', en: 'Food' },
    title: {
      ru: 'Что есть в Туркменистане',
      en: 'What to eat in Turkmenistan',
    },
    summary: {
      ru: 'Догрома, ишлекли, чорба и дыни, из-за которых сюда стоит ехать в конце лета.',
      en: 'Dograma, ishlekli, chorba, and the melons worth timing a trip around.',
    },
    readMinutes: 5,
    body: {
      ru: `Туркменская кухня — пустынная и степная: много мяса, мало зелени, хлеб при каждой еде и чай без ограничений. С узбекской и казахской у неё общие корни, но несколько блюд есть только здесь.

**Дограма.** Самое туркменское из всего. Варёная баранина, лук и лепёшка, разломанные руками на мелкие кусочки и залитые бульоном. Ножом не режут принципиально — считается, что вкус получается другим. Готовят чаще всего по праздникам и на большую компанию.

**Ишлекли.** Большой пирог с мясом и луком, который пекут в песке под углями. Внутри он остаётся сочным, снаружи — с хрустящей коркой. Родом из Балканского велаята, и там же он лучше всего.

**Чорба.** Густой суп на баранине с овощами, простой и ежедневный. Им обычно начинается обед.

Отдельно — **гутап**, лепёшки с зеленью, тыквой или мясом, жаренные на сковороде, и **шашлык**, который здесь делают на саксауле: у дыма от него свой запах, и мясо получается не такое, как на углях из магазина.

Пьют зелёный чай, много и целый день, в том числе в жару — местные считают, что горячий чай в жару работает лучше холодной воды, и после недели здесь с этим трудно спорить.

И главное, ради чего стоит подгадать даты: **дыни**. Туркменская дыня — предмет национальной гордости, ей посвящён отдельный праздник в августе. Сезон — конец лета и начало осени, и то, что продаётся в это время на рынке, к тому, что называют дыней в других местах, отношения почти не имеет.`,
      en: `Turkmen cooking is food of the desert and the steppe: a lot of meat, few greens, bread at every meal and tea without limit. It shares roots with Uzbek and Kazakh cooking, but several dishes exist only here.

**Dograma.** The most Turkmen thing there is. Boiled mutton, onion and flatbread, torn into small pieces by hand and covered with broth. A knife is not used, on principle — the taste is held to come out differently. It is usually made for holidays and for a crowd.

**Ishlekli.** A large meat and onion pie baked in sand under coals. It stays juicy inside and comes out with a crust. It belongs to Balkan province, and that is where it is best.

**Chorba.** A thick mutton and vegetable soup, plain and everyday. Lunch usually begins with it.

Then **gutap**, flatbreads fried with herbs, pumpkin or meat, and **shashlik**, grilled here over saxaul wood: the smoke has a smell of its own and the meat is not what you get over shop charcoal.

People drink green tea, a great deal of it, all day, including in the heat — the local view is that hot tea works better than cold water when it is forty degrees, and after a week here it is hard to argue.

And the thing worth timing a trip around: **melons**. The Turkmen melon is a point of national pride with a holiday of its own in August. The season is late summer into early autumn, and what is on the market then bears little relation to what the word means elsewhere.`,
    },
  },
  {
    slug: 'kover-kak-pasport-strany',
    tag: { ru: 'Культура', en: 'Culture' },
    title: {
      ru: 'Ковёр как паспорт страны',
      en: 'The carpet as the country’s passport',
    },
    summary: {
      ru: 'Как читать туркменские гёли и почему ковёр оказался на государственном флаге.',
      en: 'How to read Turkmen gels, and why a carpet ended up on the national flag.',
    },
    readMinutes: 5,
    body: {
      ru: `На флаге Туркменистана вдоль древка идёт вертикальная полоса с пятью узорами. Это гёли — ковровые медальоны, и каждый принадлежит своему племени: теке, йомуд, сарык, човдур, арсары. Другой страны, поместившей на государственный флаг элемент ковра, нет.

Гёль — не украшение и не случайная фигура. Это устойчивый знак, по которому опознают, где ковёр выткан. Форма медальона, его пропорции, заполнение внутри, цвет фона — всё это говорит о происхождении так же определённо, как говор. Отсюда и выражение, что ковёр здесь — паспорт: по нему читают, чей он.

Цвет почти всегда строится вокруг красного — от кирпичного до глубокого бордового. Традиционно краску получали из марены, гранатовой кожуры, орехового листа, и старые ковры с годами не выцветают, а темнеют.

**Ковёр в Туркменистане — не сувенир.** Он входит в приданое, им застилают пол в доме, его дарят на свадьбу, о нём говорят как о вещи, которая переживёт того, кто её купил. Празднику ковра отведено отдельное воскресенье в мае.

В Ашхабаде есть музей ковра, где хранится один из крупнейших в мире ковров ручной работы — стоит зайти хотя бы ради масштаба. И практическое: вывоз ковров из страны регулируется, старые изделия требуют разрешения. Если собираетесь покупать всерьёз, спросите об этом до покупки, а не в аэропорту.`,
      en: `Along the hoist of the Turkmen flag runs a vertical band carrying five designs. These are gels — carpet medallions — and each belongs to a tribe: Teke, Yomut, Saryk, Chowdur, Arsary. No other country has put an element of a carpet on its national flag.

A gel is not decoration and not an arbitrary figure. It is a fixed sign by which the origin of a carpet is identified. The shape of the medallion, its proportions, what fills it, the colour behind it — all of that states where the carpet was woven as plainly as an accent states where a person is from. Hence the saying that a carpet here is a passport: you read off whose it is.

The colour is almost always built around red, from brick to deep burgundy. The dye traditionally came from madder, pomegranate rind and walnut leaf, and old carpets do not fade over the years so much as darken.

**A carpet in Turkmenistan is not a souvenir.** It goes into a dowry, it covers the floor of a house, it is given at a wedding, and it is spoken of as a thing that will outlive whoever bought it. A Sunday in May is set aside for the carpet holiday.

Ashgabat has a carpet museum holding one of the largest hand-woven carpets in the world — worth going in for the scale alone. And a practical note: taking carpets out of the country is regulated, and older pieces require a permit. If you mean to buy seriously, ask about that before you buy, not at the airport.`,
    },
  },
];

/**
 * Insert what is missing, fill what is empty, touch nothing else.
 *
 * Runs from the seeds on a fresh database and from `db:journal` against the live one, where the
 * two design-export rows already exist with a title and no text. Matching on the slug is what
 * makes both safe: an article an editor has since rewritten keeps its rewrite.
 */
export async function seedJournal(db: Database): Promise<number> {
  const existing = await db
    .select({ id: t.articles.id, slug: t.articles.slug, body: t.articles.body })
    .from(t.articles);
  const bySlug = new Map(existing.map((row) => [row.slug, row]));

  let written = 0;

  for (const [index, article] of ARTICLES.entries()) {
    const row = bySlug.get(article.slug);

    const values = {
      title: article.title,
      summary: article.summary,
      body: article.body,
      tag: article.tag,
      readMinutes: article.readMinutes,
      isFeatured: article.isFeatured ?? false,
      isPublished: true,
      sortOrder: index,
    };

    if (row === undefined) {
      await db.insert(t.articles).values({
        slug: article.slug,
        ...values,
        publishedAt: new Date(),
      });
      written += 1;
      continue;
    }

    // Only a row the design left empty. One that already has text belongs to whoever wrote it.
    const hasBody = Object.values(row.body ?? {}).some((text) => text.trim() !== '');
    if (hasBody) continue;

    await db.update(t.articles).set(values).where(eq(t.articles.id, row.id));
    written += 1;
  }

  return written;
}
