/**
 * The content translations, keyed by the string the prototypes gave.
 *
 * The design package is written in Russian for Global and Turkmen for Umrah, and until now the
 * seeds wrote exactly that: one language per site, with `en`, `tr` and `ru` simply absent. The
 * translation report called it what it was — Global 10.6% in English, Umrah 0% in Russian — and
 * the owner saw the consequence before the report did, on a Turkish page reading in English.
 *
 * **Keyed by the source string, not by row id.** Two reasons. The same phrase appears in several
 * tables — «Ашхабад» is a builder destination, a hotel city, a place and a hero slide — and one
 * entry serves all of them, which is also what keeps them from drifting into four spellings of
 * one city. And a string that changes in the prototypes stops matching, so the translation goes
 * missing and the report says so, rather than a stale translation quietly outliving its source.
 *
 * **Proper nouns are listed with identical values rather than skipped.** `Ýyldyz Hotel` is the
 * hotel's name in every language, and saying so explicitly is the difference between «translated»
 * and «forgotten»: the report counts a filled value, and a missing entry would show up as work
 * for a translator who has nothing to do.
 *
 * **The Turkish here is spelled properly, `ğ` and `İ` included.** Those two glyphs are missing
 * from Stolzl (question Q-17) and the browser substitutes a system font for them, which looks
 * wrong. Writing `Ingilizce` instead of `İngilizce` would look right and be wrong, and the fix
 * for a missing glyph is a font rather than a misspelling.
 */

/** Russian, as it appears in the Global seeds → English and Turkish. */
const GLOBAL: Record<string, readonly [en: string, tr: string]> = {
  // ------------------------------------------------------------------------------------
  // Places, cities and regions. Shared by the builder, the hotels, the places and the hero.
  // ------------------------------------------------------------------------------------
  Ашхабад: ['Ashgabat', 'Aşkabat'],
  Дарваза: ['Darvaza', 'Darvaza'],
  'Мары / Мерв': ['Mary / Merv', 'Mary / Merv'],
  Мары: ['Mary', 'Mary'],
  Мерв: ['Merv', 'Merv'],
  Куняургенч: ['Konye-Urgench', 'Köneürgenç'],
  Йангыкала: ['Yangykala', 'Yangıkala'],
  Аваза: ['Awaza', 'Avaza'],
  Дашогуз: ['Dashoguz', 'Daşoguz'],
  Балканабат: ['Balkanabat', 'Balkanabat'],
  Каракумы: ['The Karakum', 'Karakum'],
  Геоктепе: ['Gokdepe', 'Gökdepe'],
  Туркменбаши: ['Turkmenbashy', 'Türkmenbaşy'],
  Ахал: ['Ahal', 'Ahal'],
  Балкан: ['Balkan', 'Balkan'],
  Каспий: ['The Caspian', 'Hazar'],
  'Кратер Дарваза': ['The Darvaza crater', 'Darvaza krateri'],
  'Древний Мерв': ['Ancient Merv', 'Antik Merv'],
  'Каньоны Йангыкала': ['The Yangykala canyons', 'Yangıkala kanyonları'],

  // ------------------------------------------------------------------------------------
  // Builder: option names
  // ------------------------------------------------------------------------------------
  '3 дня': ['3 days', '3 gün'],
  '5 дней': ['5 days', '5 gün'],
  '7 дней': ['7 days', '7 gün'],
  '10 дней': ['10 days', '10 gün'],
  '14 дней': ['14 days', '14 gün'],
  'Свои даты': ['My own dates', 'Kendi tarihlerim'],
  // Star ratings are the same mark everywhere, and listing them says so on purpose.
  '3 ★': ['3 ★', '3 ★'],
  '4 ★': ['4 ★', '4 ★'],
  '5 ★': ['5 ★', '5 ★'],
  'Бутик-отель': ['Boutique hotel', 'Butik otel'],
  'Юрточный лагерь': ['Yurt camp', 'Çadır kampı'],
  Смешанно: ['Mixed', 'Karışık'],
  Халяль: ['Halal', 'Helal'],
  'Национальная кухня': ['Turkmen cuisine', 'Türkmen mutfağı'],
  Европейская: ['European', 'Avrupa mutfağı'],
  Вегетарианское: ['Vegetarian', 'Vejetaryen'],
  'Без глютена': ['Gluten-free', 'Glutensiz'],
  'Без питания': ['No meals', 'Yemek dahil değil'],
  'Легковой авто': ['Car', 'Binek araç'],
  Минивэн: ['Minivan', 'Minivan'],
  Автобус: ['Coach', 'Otobüs'],
  'Внедорожник 4×4': ['4×4', '4×4 arazi aracı'],
  Поезд: ['Train', 'Tren'],
  'Внутренний перелёт': ['Domestic flight', 'İç hat uçuşu'],
  'Экскурсии по городу': ['City tours', 'Şehir turları'],
  'Пустыня и кемпинг': ['Desert and camping', 'Çöl ve kamp'],
  'Ахалтекинские кони': ['Akhal-Teke horses', 'Ahal-Teke atları'],
  Гастротур: ['Food tour', 'Gastronomi turu'],
  'Ремёсла и ковры': ['Crafts and carpets', 'El sanatları ve halılar'],
  'Каспий и пляж': ['The Caspian and the beach', 'Hazar ve plaj'],
  '1': ['1', '1'],
  '2': ['2', '2'],
  '3–5': ['3–5', '3–5'],
  '6–10': ['6–10', '6–10'],
  '10+': ['10+', '10+'],
  'Пока не знаю': ['Not sure yet', 'Henüz bilmiyorum'],
  Русский: ['Russian', 'Rusça'],
  Английский: ['English', 'İngilizce'],
  Турецкий: ['Turkish', 'Türkçe'],
  Туркменский: ['Turkmen', 'Türkmence'],
  'Несколько языков': ['Several languages', 'Birkaç dil'],
  'Без гида': ['No guide', 'Rehbersiz'],

  // ------------------------------------------------------------------------------------
  // Builder: the one-line note under each option
  // ------------------------------------------------------------------------------------
  'Белый мрамор, музеи': ['White marble, museums', 'Beyaz mermer, müzeler'],
  'Горящий кратер': ['The burning crater', 'Yanan krater'],
  'Древний Шёлковый путь': ['The ancient Silk Road', 'Antik İpek Yolu'],
  'Наследие ЮНЕСКО': ['UNESCO heritage', 'UNESCO mirası'],
  'Каньоны Каспия': ['Canyons by the Caspian', 'Hazar kanyonları'],
  'Каспийское море': ['The Caspian Sea', 'Hazar Denizi'],
  'Короткий визит': ['A short visit', 'Kısa ziyaret'],
  Классика: ['The classic route', 'Klasik rota'],
  'Города + пустыня': ['Cities and desert', 'Şehirler ve çöl'],
  'Полный круг': ['The full circuit', 'Tam tur'],
  'С Каспием': ['With the Caspian', 'Hazar dahil'],
  'Уточним в заявке': ['We confirm it with you', 'Talebinizde netleştiririz'],
  'Просто и чисто': ['Simple and clean', 'Sade ve temiz'],
  Комфорт: ['Comfort', 'Konfor'],
  Премиум: ['Premium', 'Premium'],
  'Небольшой, с характером': ['Small, with character', 'Küçük ve karakterli'],
  'Ночь в Каракумах': ['A night in the Karakum', 'Karakum çölünde bir gece'],
  'По ходу маршрута': ['As the route goes', 'Rotaya göre'],
  'Только халяльное': ['Halal only', 'Sadece helal'],
  'Дограма, плов, чорба': ['Dogroma, plov, chorba', 'Dograma, pilav, çorba'],
  'Привычное меню': ['A familiar menu', 'Alışılmış menü'],
  'Без мяса': ['No meat', 'Etsiz'],
  'Особая диета': ['A special diet', 'Özel diyet'],
  'Питаюсь сам': ['I will eat on my own', 'Yemeğimi kendim hallederim'],
  'До 3 человек': ['Up to 3 people', '3 kişiye kadar'],
  'До 7 человек': ['Up to 7 people', '7 kişiye kadar'],
  Группа: ['A group', 'Grup'],
  'Пустыня и каньоны': ['Desert and canyons', 'Çöl ve kanyonlar'],
  'Между городами': ['Between cities', 'Şehirler arası'],
  'Быстро и дальше': ['Fast, and further', 'Hızlı ve uzağa'],
  'Гид и памятники': ['A guide and the monuments', 'Rehber ve anıtlar'],
  'Ночь под звёздами': ['A night under the stars', 'Yıldızlar altında bir gece'],
  'Конезавод и катание': ['A stud farm and a ride', 'Hara ve binicilik'],
  'Базары и кухня': ['Bazaars and food', 'Pazarlar ve mutfak'],
  Мастерские: ['Workshops', 'Atölyeler'],
  Индивидуально: ['Just me', 'Bireysel'],
  Пара: ['A couple', 'Çift'],
  Семья: ['A family', 'Aile'],
  'Небольшая группа': ['A small group', 'Küçük grup'],
  'Большая группа': ['A large group', 'Büyük grup'],
  'Уточню позже': ['I will confirm later', 'Sonra netleştireceğim'],
  // Four notes the export left in Turkmen while everything around them is Russian. Translated
  // from what they mean rather than from the language they are accidentally in.
  'Rus dilinde': ['Russian', 'Rusça'],
  English: ['English', 'İngilizce'],
  Türkçe: ['Turkish', 'Türkçe'],
  'Türkmen dilinde': ['Turkmen', 'Türkmence'],
  'Смешанная группа': ['A mixed group', 'Karma grup'],
  'Сам разберусь': ['I will manage', 'Kendim hallederim'],

  // ------------------------------------------------------------------------------------
  // Builder: the nine steps
  // ------------------------------------------------------------------------------------
  'Куда хотите поехать?': ['Where would you like to go?', 'Nereye gitmek istersiniz?'],
  'Сколько дней в поездке?': ['How many days?', 'Kaç gün sürecek?'],
  'Где будете жить?': ['Where will you stay?', 'Nerede kalacaksınız?'],
  'Что предпочитаете есть?': ['What would you like to eat?', 'Ne yemeyi tercih edersiniz?'],
  'На чём передвигаемся?': ['How will you travel?', 'Nasıl seyahat edeceksiniz?'],
  'Что хотите посмотреть и сделать?': [
    'What would you like to see and do?',
    'Ne görmek ve yapmak istersiniz?',
  ],
  'Сколько вас будет?': ['How many of you?', 'Kaç kişisiniz?'],
  'Нужен гид? На каком языке?': [
    'Do you want a guide, and in which language?',
    'Rehber ister misiniz, hangi dilde?',
  ],
  'Проверьте тур и оставьте контакты': [
    'Check the tour and leave your details',
    'Turu kontrol edin ve iletişim bilgilerinizi bırakın',
  ],
  'можно выбрать несколько': ['you can choose several', 'birkaçını seçebilirsiniz'],
  'выберите один вариант': ['choose one', 'bir seçenek seçin'],
  'последний шаг': ['the last step', 'son adım'],
  'Направление / города': ['Destination / cities', 'Rota / şehirler'],
  'Даты и длительность': ['Dates and length', 'Tarih ve süre'],
  'Отель и звёздность': ['Hotel and class', 'Otel ve yıldız'],
  Питание: ['Meals', 'Yemek'],
  Транспорт: ['Transport', 'Ulaşım'],
  'Активности / экскурсии': ['Activities / excursions', 'Aktiviteler / geziler'],
  'Количество человек': ['Number of people', 'Kişi sayısı'],
  'Гид и язык гида': ['Guide and language', 'Rehber ve dili'],
  'Цена и онлайн-заявка': ['Price and enquiry', 'Fiyat ve online talep'],

  // ------------------------------------------------------------------------------------
  // Hotel amenities
  // ------------------------------------------------------------------------------------
  '10 номеров': ['10 rooms', '10 oda'],
  'Wi-Fi': ['Wi-Fi', 'Wi-Fi'],
  Аквапарк: ['Water park', 'Aquapark'],
  Бассейн: ['Pool', 'Havuz'],
  'Всё включено': ['All inclusive', 'Her şey dahil'],
  Гид: ['Guide', 'Rehber'],
  Завтрак: ['Breakfast', 'Kahvaltı'],
  Костёр: ['Campfire', 'Kamp ateşi'],
  Паркинг: ['Parking', 'Otopark'],
  'Парковка 4×4': ['4×4 parking', '4×4 otoparkı'],
  Пляж: ['Beach', 'Plaj'],
  'Порт рядом': ['Port nearby', 'Limana yakın'],
  'Ранний завтрак': ['Early breakfast', 'Erken kahvaltı'],
  Семейный: ['Family-friendly', 'Aile dostu'],
  Спа: ['Spa', 'Spa'],
  Терраса: ['Terrace', 'Teras'],
  Трансфер: ['Transfer', 'Transfer'],
  Ужин: ['Dinner', 'Akşam yemeği'],
  Центр: ['City centre', 'Şehir merkezi'],

  // ------------------------------------------------------------------------------------
  // The gallery
  // ------------------------------------------------------------------------------------
  'Кратер Дарваза, Каракумы': ['The Darvaza crater, the Karakum', 'Darvaza krateri, Karakum'],
  'Ковровый узор, макро': ['Carpet pattern, close up', 'Halı deseni, yakın çekim'],
  'Ашхабад, белый мрамор': ['Ashgabat, white marble', 'Aşkabat, beyaz mermer'],
  'Каньон Йангыкала на закате': ['Yangykala canyon at sunset', 'Gün batımında Yangıkala kanyonu'],
  Дограма: ['Dogroma', 'Dograma'],
  'Юрточный лагерь, ночь и звёзды': [
    'Yurt camp, night and stars',
    'Çadır kampı, gece ve yıldızlar',
  ],
  'Аваза, Каспийское море': ['Awaza, the Caspian Sea', 'Avaza, Hazar Denizi'],
  'Ахалтекинский конь': ['An Akhal-Teke horse', 'Ahal-Teke atı'],
  'Ткачихи в Геоктепе': ['Weavers in Gokdepe', 'Gökdepe dokumacıları'],
  'Минарет Куняургенча': ['The minaret of Konye-Urgench', 'Köneürgenç minaresi'],
  'Базар Толкучка': ['Tolkuchka bazaar', 'Tolkuçka pazarı'],
  'Ночной Ашхабад': ['Ashgabat at night', 'Gece Aşkabat'],
  'Копетдаг весной': ['The Kopet Dag in spring', 'İlkbaharda Kopet Dağ'],

  // ------------------------------------------------------------------------------------
  // The country page: facts and the visa steps
  // ------------------------------------------------------------------------------------
  Столица: ['Capital', 'Başkent'],
  Площадь: ['Area', 'Yüzölçümü'],
  Население: ['Population', 'Nüfus'],
  Язык: ['Language', 'Dil'],
  Валюта: ['Currency', 'Para birimi'],
  'Лучшее время': ['Best time to go', 'En iyi zaman'],
  'Часовой пояс': ['Time zone', 'Saat dilimi'],
  'Ашхабад — город в Книге рекордов по площади белого мрамора': [
    'Ashgabat — in the record books for its area of white marble',
    'Aşkabat — beyaz mermer alanıyla rekorlar kitabında',
  ],
  '491 200 км², около 80% занимают Каракумы': [
    '491,200 km², around 80% of it the Karakum',
    '491.200 km², yaklaşık yüzde 80 kadarı Karakum',
  ],
  'около 7,1 млн человек': ['around 7.1 million people', 'yaklaşık 7,1 milyon kişi'],
  'туркменский; русский широко распространён': [
    'Turkmen; Russian is widely spoken',
    'Türkmence; Rusça yaygın olarak konuşulur',
  ],
  'манат (TMT), 1 $ ≈ 3,5 TMT': ['manat (TMT), 1 $ ≈ 3.5 TMT', 'manat (TMT), 1 $ ≈ 3,5 TMT'],
  'апрель–май и сентябрь–октябрь': ['April–May and September–October', 'Nisan–Mayıs ve Eylül–Ekim'],
  'UTC+5, без перехода на летнее время': [
    'UTC+5, no daylight saving',
    'UTC+5, yaz saati uygulaması yok',
  ],
  'Мерв, Куняургенч и Ниса': ['Merv, Konye-Urgench and Nisa', 'Merv, Köneürgenç ve Nisa'],
  'Заявка у нас': ['Your request', 'Talebiniz'],
  Приглашение: ['The invitation', 'Davetiye'],
  Консульство: ['The consulate', 'Konsolosluk'],
  Встреча: ['Arrival', 'Karşılama'],
  'Присылаете скан паспорта и анкету — мы готовим документы.': [
    'You send a passport scan and the form; we prepare the papers.',
    'Pasaport taramanızı ve formu gönderirsiniz, belgeleri biz hazırlarız.',
  ],
  'Оформляем визовую поддержку, срок 7–10 рабочих дней.': [
    'We obtain the visa support, which takes 7–10 working days.',
    'Vize desteğini alırız, süre 7–10 iş günü.',
  ],
  'Получаете визу в консульстве или по прилёте в аэропорту.': [
    'You collect the visa at a consulate or on arrival at the airport.',
    'Vizeyi konsoloslukta ya da havalimanına varışta alırsınız.',
  ],
  'Встречаем в аэропорту и передаём программу тура.': [
    'We meet you at the airport and hand over the programme.',
    'Sizi havalimanında karşılar, tur programını veririz.',
  ],
  // The numerals beside the visa steps. The same characters in every language, and said so.
  '01': ['01', '01'],
  '02': ['02', '02'],
  '03': ['03', '03'],
  '04': ['04', '04'],

  // ------------------------------------------------------------------------------------
  // Tours: titles, tags and summaries
  // ------------------------------------------------------------------------------------
  'Классический Туркменистан': ['Classic Turkmenistan', 'Klasik Türkmenistan'],
  'Каракумы и Дарваза': ['The Karakum and Darvaza', 'Karakum ve Darvaza'],
  'Шёлковый путь: Мерв и Куняургенч': [
    'The Silk Road: Merv and Konye-Urgench',
    'İpek Yolu: Merv ve Köneürgenç',
  ],
  'Аваза: Каспий и отдых': ['Awaza: the Caspian and a rest', 'Avaza: Hazar ve tatil'],
  'Ахалтекинские скакуны': ['Akhal-Teke horses', 'Ahal-Teke atları'],
  'Вкус Туркменистана': ['The taste of Turkmenistan', 'Türkmen mutfağının tadı'],
  'Ковровые мастерские': ['Carpet workshops', 'Halı atölyeleri'],
  'Большой круг: с севера на юг': [
    'The grand circuit: north to south',
    'Büyük tur: kuzeyden güneye',
  ],
  'Шёлковый путь': ['The Silk Road', 'İpek Yolu'],
  'Большой круг': ['The grand circuit', 'Büyük tur'],
  Хит: ['Bestseller', 'En çok tercih edilen'],
  Пустыня: ['Desert', 'Çöl'],
  История: ['History', 'Tarih'],
  Природа: ['Nature', 'Doğa'],
  Море: ['Sea', 'Deniz'],
  Кони: ['Horses', 'Atlar'],
  Гастро: ['Food', 'Gastronomi'],
  Ковры: ['Carpets', 'Halılar'],
  'Весь круг': ['Full circuit', 'Tam tur'],
  'Ашхабад, Ниса, Мерв и ночь у кратера Дарваза.': [
    'Ashgabat, Nisa, Merv and a night at the Darvaza crater.',
    'Aşkabat, Nisa, Merv ve Darvaza kraterinde bir gece.',
  ],
  'Внедорожники, юрточный лагерь и горящий кратер.': [
    '4×4s, a yurt camp and the burning crater.',
    '4×4 araçlar, çadır kampı ve yanan krater.',
  ],
  'Древние города, минареты и мавзолеи ЮНЕСКО.': [
    'Ancient cities, minarets and UNESCO mausoleums.',
    'Antik şehirler, minareler ve UNESCO türbeleri.',
  ],
  'Розовые скалы, чинк Устюрта и закат над Каспием.': [
    'Pink cliffs, the Ustyurt escarpment and sunset over the Caspian.',
    'Pembe kayalar, Üstyurt yamacı ve Hazar üzerinde gün batımı.',
  ],
  'Пляжи, аквапарки и отели на побережье.': [
    'Beaches, water parks and hotels on the shore.',
    'Plajlar, aquaparklar ve sahil otelleri.',
  ],
  'Конезаводы, выездка и катание по степи.': [
    'Stud farms, dressage and a ride across the steppe.',
    'Haralar, binicilik gösterileri ve bozkırda at gezisi.',
  ],
  'Базар Толкучка, дограма, ишлекли и чайханы Ашхабада.': [
    'Tolkuchka bazaar, dogroma, ishlekli and the tea houses of Ashgabat.',
    'Tolkuçka pazarı, dograma, işlekli ve Aşkabat çayhaneleri.',
  ],
  'Музей ковра, мастерские и ткачихи в Геоктепе.': [
    'The carpet museum, the workshops and the weavers of Gokdepe.',
    'Halı Müzesi, atölyeler ve Gökdepe dokumacıları.',
  ],
  'Куняургенч, Дашогуз, Дарваза, Ашхабад, Мерв и Каспий.': [
    'Konye-Urgench, Dashoguz, Darvaza, Ashgabat, Merv and the Caspian.',
    'Köneürgenç, Daşoguz, Darvaza, Aşkabat, Merv ve Hazar.',
  ],

  // ------------------------------------------------------------------------------------
  // Hotels. The names are the names — listed identically rather than left blank.
  // ------------------------------------------------------------------------------------
  'Ýyldyz Hotel': ['Ýyldyz Hotel', 'Ýyldyz Hotel'],
  'Arkaç Resort': ['Arkaç Resort', 'Arkaç Resort'],
  'Margush Hotel': ['Margush Hotel', 'Margush Hotel'],
  'Nusay Hotel': ['Nusay Hotel', 'Nusay Hotel'],
  'Köneürgenç Guest House': ['Köneürgenç Guest House', 'Köneürgenç Guest House'],
  'Balkan Hotel': ['Balkan Hotel', 'Balkan Hotel'],
  'Garagum Camp': ['Garagum Camp', 'Garagum Camp'],
  'Nisa Boutique': ['Nisa Boutique', 'Nisa Boutique'],
  'Türkmenbaşy Plaza': ['Türkmenbaşy Plaza', 'Türkmenbaşy Plaza'],
  'Мраморная высотка с видом на город, спа и панорамный ресторан.': [
    'A marble tower with city views, a spa and a panoramic restaurant.',
    'Şehir manzaralı mermer kule, spa ve panoramik restoran.',
  ],
  'Первая линия Каспия, частный пляж и аквапарк рядом.': [
    'On the Caspian shore, with a private beach and a water park next door.',
    'Hazar kıyısında, özel plaj ve hemen yanında aquapark.',
  ],
  'В 30 минутах от древнего Мерва, тихий двор и своя кухня.': [
    'Thirty minutes from ancient Merv, with a quiet courtyard and its own kitchen.',
    'Antik Merv 30 dakika uzakta, sessiz avlu ve kendi mutfağı.',
  ],
  'Центр, рядом Музей ковра и парк Ынам. Хороший вариант для первой ночи.': [
    'Central, by the carpet museum and Ynam park. A good choice for the first night.',
    'Merkezde, Halı Müzesi ve Ynam parkının yanında. İlk gece için iyi bir seçim.',
  ],
  'Семейный гостевой дом с виноградным двором и домашними завтраками.': [
    'A family guest house with a vine courtyard and home-made breakfasts.',
    'Asma avlulu, ev yapımı kahvaltılı aile pansiyonu.',
  ],
  'Ближайшая база перед выездом в каньоны Йангыкала.': [
    'The nearest base before the drive out to the Yangykala canyons.',
    'Yangıkala kanyonlarına çıkmadan önceki en yakın konaklama.',
  ],
  'Юрты у кратера Дарваза, ужин у костра и полное небо звёзд.': [
    'Yurts by the Darvaza crater, dinner at the fire and a sky full of stars.',
    'Darvaza krateri yanında çadırlar, ateş başında akşam yemeği ve yıldızlarla dolu gökyüzü.',
  ],
  'Десять номеров в предгорьях Копетдага, авторские интерьеры.': [
    'Ten rooms in the Kopet Dag foothills, with designed interiors.',
    'Kopet Dağ eteklerinde on oda, özel tasarım iç mekanlar.',
  ],
  'Порт и вокзал в шаге, удобно для маршрутов вдоль Каспия.': [
    'The port and the station a step away, handy for routes along the Caspian.',
    'Liman ve istasyon bir adım ötede, Hazar rotaları için elverişli.',
  ],

  // ------------------------------------------------------------------------------------
  // Reviews. Two of the nine are already in English in the export; those keep their wording.
  // ------------------------------------------------------------------------------------
  'Стамбул, Турция': ['Istanbul, Türkiye', 'İstanbul, Türkiye'],
  'Москва, Россия': ['Moscow, Russia', 'Moskova, Rusya'],
  'Лондон, Великобритания': ['London, United Kingdom', 'Londra, Birleşik Krallık'],
  'Ашхабад, Туркменистан': ['Ashgabat, Turkmenistan', 'Aşkabat, Türkmenistan'],
  'Анкара, Турция': ['Ankara, Türkiye', 'Ankara, Türkiye'],
  'Алматы, Казахстан': ['Almaty, Kazakhstan', 'Almatı, Kazakistan'],
  'Милан, Италия': ['Milan, Italy', 'Milano, İtalya'],
  'Ташкент, Узбекистан': ['Tashkent, Uzbekistan', 'Taşkent, Özbekistan'],
  'Измир, Турция': ['Izmir, Türkiye', 'İzmir, Türkiye'],
  'Собрали тур через конструктор за десять минут. Все отели и трансферы совпали с тем, что выбрали на сайте.':
    [
      'We built the tour in the builder in ten minutes. Every hotel and transfer matched what we had chosen on the site.',
      'Turu oluşturucuda on dakikada kurduk. Tüm oteller ve transferler sitede seçtiklerimizle birebir aynıydı.',
    ],
  'Ночь в юрточном лагере у Дарвазы — самое сильное впечатление за последние годы. Гид говорил на русском и знал всё про кратер.':
    [
      'A night in the yurt camp by Darvaza was the strongest impression of the last few years. The guide spoke Russian and knew everything about the crater.',
      'Darvaza yanındaki çadır kampında geçen gece son yılların en güçlü izlenimiydi. Rehber Rusça konuşuyordu ve krater hakkında her şeyi biliyordu.',
    ],
  'Visa support was handled entirely by the team. Merv and Konye-Urgench were worth the whole trip.':
    [
      'Visa support was handled entirely by the team. Merv and Konye-Urgench were worth the whole trip.',
      'Vize desteğini tamamen ekip halletti. Merv ve Köneürgenç tüm yolculuğa değerdi.',
    ],
  'Ездил с семьёй на выходные. Внедорожник, вода, обед в дороге — всё продумано. Закат в каньонах невероятный.':
    [
      'We went with the family for a weekend. The 4×4, the water, lunch on the road — everything thought through. The sunset in the canyons is unbelievable.',
      'Ailemle bir hafta sonu gittik. Arazi aracı, su, yolda öğle yemeği — her şey düşünülmüş. Kanyonlarda gün batımı inanılmaz.',
    ],
  'Отель отличный, пляж чистый. Единственное — трансфер из аэропорта задержался на час, но менеджер сразу предупредил.':
    [
      'The hotel is excellent and the beach is clean. The one thing: the airport transfer was an hour late, though the manager warned us straight away.',
      'Otel mükemmel, plaj temiz. Tek şey: havalimanı transferi bir saat gecikti, ama yetkili hemen haber verdi.',
    ],
  'Ехал ради коней и не пожалел. Конезавод, катание, разговоры с тренерами — программа плотная, но не утомительная.':
    [
      'I came for the horses and did not regret it. The stud farm, the riding, talking to the trainers — a full programme, but never tiring.',
      'Atlar için gittim ve pişman olmadım. Hara, binicilik, antrenörlerle sohbet — program yoğun ama yorucu değil.',
    ],
  'The food tour was a discovery. Dogroma, ishlekli, and green tea in the chaikhana — I still think about it.':
    [
      'The food tour was a discovery. Dogroma, ishlekli, and green tea in the chaikhana — I still think about it.',
      'Gastronomi turu bir keşifti. Dograma, işlekli ve çayhanede yeşil çay — hâlâ aklımda.',
    ],
  'Четырнадцать дней — насыщенно. Хотелось бы один свободный день в середине, в остальном организация на высоте.':
    [
      'Fourteen days, and full ones. I would have liked one free day in the middle; otherwise the organisation was faultless.',
      'On dört gün, yoğun geçti. Ortada bir serbest gün olsaydı iyi olurdu; gerisi kusursuzdu.',
    ],
  'Музей ковра и мастерские в Геоктепе — то, за чем стоит ехать. Гид объяснила значение каждого гёля.':
    [
      'The carpet museum and the workshops in Gokdepe are what to come for. The guide explained the meaning of every gul.',
      'Halı Müzesi ve Gökdepe atölyeleri, gelmeye değer olan şey. Rehber her gölün anlamını açıkladı.',
    ],

  // ------------------------------------------------------------------------------------
  // Video, FAQ, places and articles
  // ------------------------------------------------------------------------------------
  'Ночь у кратера Дарваза': ['A night at the Darvaza crater', 'Darvaza kraterinde bir gece'],
  'Мерв: город, которого нет': ['Merv: the city that is gone', 'Merv: artık olmayan şehir'],
  'Кони Ахала': ['The horses of Ahal', 'Ahal atları'],
  'Ашхабад: город из мрамора': ['Ashgabat: a city of marble', 'Aşkabat: mermerden bir şehir'],
  'Дорога на Йангыкала': ['The road to Yangykala', 'Yangıkala yolu'],
  'Дограма и чайхана': ['Dogroma and the tea house', 'Dograma ve çayhane'],
  'Нужна ли виза в Туркменистан?': [
    'Do I need a visa for Turkmenistan?',
    'Türkmenistan için vize gerekir mi?',
  ],
  'Для большинства стран — да. Мы оформляем визовую поддержку и приглашение, срок 7–10 рабочих дней.':
    [
      'For most countries, yes. We arrange the visa support and the invitation, which takes 7–10 working days.',
      'Çoğu ülke için evet. Vize desteğini ve davetiyeyi biz hazırlıyoruz, süre 7–10 iş günü.',
    ],
  'Когда лучше ехать?': ['When is the best time to come?', 'Ne zaman gelmek daha iyi?'],
  'Апрель–май и сентябрь–октябрь: комфортная температура для пустыни и городов.': [
    'April–May and September–October: a comfortable temperature for both the desert and the cities.',
    'Nisan–Mayıs ve Eylül–Ekim: hem çöl hem şehirler için rahat bir sıcaklık.',
  ],
  'Можно ли изменить готовый тур?': [
    'Can a ready-made tour be changed?',
    'Hazır bir tur değiştirilebilir mi?',
  ],
  'Да. Любой маршрут из каталога перестраивается в сборщике — отель, питание, транспорт и даты.': [
    'Yes. Any route in the catalogue can be rebuilt in the builder — hotel, meals, transport and dates.',
    'Evet. Katalogdaki her rota oluşturucuda yeniden kurulabilir: otel, yemek, ulaşım ve tarihler.',
  ],
  'Как оплатить?': ['How do I pay?', 'Ödeme nasıl yapılır?'],
  'Предоплата 30% для брони отелей, остаток — за 10 дней до заезда. Наличные и банковский перевод.':
    [
      'A 30% deposit holds the hotels; the rest is due 10 days before arrival. Cash or bank transfer.',
      'Otel rezervasyonu için yüzde 30 ön ödeme, kalanı varıştan 10 gün önce. Nakit veya banka havalesi.',
    ],
  'На каких языках работают гиды?': [
    'Which languages do the guides speak?',
    'Rehberler hangi dillerde çalışıyor?',
  ],
  'Русский, английский, турецкий и туркменский. Язык выбирается в сборщике туров.': [
    'Russian, English, Turkish and Turkmen. The language is chosen in the tour builder.',
    'Rusça, İngilizce, Türkçe ve Türkmence. Dil, tur oluşturucuda seçilir.',
  ],
  'Есть ли групповые скидки?': ['Is there a group discount?', 'Grup indirimi var mı?'],
  'От 6 человек — скидка на трансфер и гида. Точный расчёт делает менеджер по заявке.': [
    'From six people there is a discount on the transfer and the guide. A manager works out the exact figure from your enquiry.',
    'Altı kişiden itibaren transfer ve rehberde indirim. Kesin tutarı yetkili talebinize göre hesaplar.',
  ],
  'Белый мрамор, фонтаны и Музей ковра. Отсюда начинается любой маршрут.': [
    'White marble, fountains and the carpet museum. Every route begins here.',
    'Beyaz mermer, fıskiyeler ve Halı Müzesi. Her rota buradan başlar.',
  ],
  'Горящая воронка в песках, ночёвка в юрточном лагере рядом.': [
    'A burning hollow in the sand, with a night in the yurt camp beside it.',
    'Kumlarda yanan bir çukur, hemen yanında çadır kampında bir gece.',
  ],
  'Один из крупнейших городов Шёлкового пути, наследие ЮНЕСКО.': [
    'One of the largest cities of the Silk Road, a UNESCO site.',
    'İpek Yolunun en büyük şehirlerinden biri, UNESCO mirası.',
  ],
  'Минарет Кутлуг-Тимура и мавзолеи XII–XIV веков.': [
    'The Kutlug-Timur minaret and mausoleums of the 12th to 14th centuries.',
    'Kutlug-Timur minaresi ve 12.–14. yüzyıl türbeleri.',
  ],
  'Розово-оранжевые слои древнего моря на закате.': [
    'Pink and orange layers of an ancient sea at sunset.',
    'Gün batımında antik bir denizin pembe ve turuncu katmanları.',
  ],
  'Курортная зона на Каспии: пляжи, отели и аквапарки.': [
    'A resort strip on the Caspian: beaches, hotels and water parks.',
    'Hazar kıyısında tatil bölgesi: plajlar, oteller ve aquaparklar.',
  ],
  'Ковёр как паспорт страны': [
    'A carpet as the passport of a country',
    'Ülkenin pasaportu olarak halı',
  ],
  'Что есть в Туркменистане': ['What to eat in Turkmenistan', 'Türkmenistan mutfağında ne yenir'],
  Культура: ['Culture', 'Kültür'],
  Кухня: ['Food', 'Mutfak'],

  // Opening hours, from the settings row. The address beside it is already above, as the home
  // city of a reviewer — one entry, one spelling, which is the whole reason for keying on the
  // string rather than on the row.
  'Пн–Сб, 09:00–18:00': ['Mon–Sat, 09:00–18:00', 'Pzt–Cmt, 09:00–18:00'],
  'Как читать туркменские гёли и почему ковёр на флаге.': [
    'How to read Turkmen guls, and why a carpet is on the flag.',
    'Türkmen göllerini nasıl okumalı ve halı neden bayrakta.',
  ],
  'Дограма, чорба, ишлекли и чай в пиалах.': [
    'Dogroma, chorba, ishlekli and tea in bowls.',
    'Dograma, çorba, işlekli ve kâselerde çay.',
  ],
};

/** Turkmen, as it appears in the Umrah seeds → Russian. */
const UMRAH: Record<string, string> = {
  // ------------------------------------------------------------------------------------
  // What the package includes, and on what terms
  // ------------------------------------------------------------------------------------
  'Uçar bileti Aşgabat — Jidda': 'Авиабилет Ашхабад — Джидда',
  'Umra wizasy we resminamalar': 'Виза на умру и документы',
  'Otel 4 ★, Haremden 400 m': 'Отель 4 ★, 400 м от Харама',
  '2–3 adamlyk otag': 'Номер на 2–3 человека',
  'Gündelik 3 wagt nahar': 'Трёхразовое питание каждый день',
  'Bedir we Uhud ziýarat': 'Зиярат в Бадр и Ухуд',
  'Awtobus we ähli transfer': 'Автобус и все трансферы',
  'Türkmen dilli ýolbaşçy 24/7': 'Руководитель, говорящий по-туркменски, 24/7',
  Ugramak: 'Вылет',
  Dolanmak: 'Возвращение',
  Dowamlylygy: 'Длительность',
  Topar: 'Группа',
  Otel: 'Отель',
  Otag: 'Номер',
  Nahar: 'Питание',
  Ýolbaşçy: 'Руководитель группы',
  '18.09.2026, Aşgabat aeroporty': '18.09.2026, аэропорт Ашхабада',
  '28.09.2026': '28.09.2026',
  '10 gün — Mekgede 5, Medinede 4 gün': '10 дней — 5 в Мекке, 4 в Медине',
  '45 adam, ýolbaşçy bilen': '45 человек, вместе с руководителем',
  '4 ★ — Mekgede Haremden 400 m, Medinede 300 m': '4 ★ — в Мекке 400 м от Харама, в Медине 300 м',
  '2–3 adamlyk; 1 adamlyk otag mümkin': 'На 2–3 человека; возможен одноместный',
  'Gündelik 3 wagt, türkmen we arap tagamlary': 'Три раза в день, туркменская и арабская кухня',
  'Türkmen we rus dilinde, 24/7': 'На туркменском и русском, 24/7',
  'Aşgabat — Jidda — Aşgabat uçar bileti': 'Авиабилет Ашхабад — Джидда — Ашхабад',
  'Umra wizasy we ähli resminamalar': 'Виза на умру и все документы',
  'Mekge we Medinede 4 ★ otel': 'Отель 4 ★ в Мекке и Медине',
  'Saud Arabystanynda transfer we awtobus': 'Трансферы и автобус в Саудовской Аравии',
  'Türkmen we rus dilli ýolbaşçy': 'Руководитель со знанием туркменского и русского',
  'Ihram we ziýarat toplumy': 'Ихрам и набор для зиярата',

  // ------------------------------------------------------------------------------------
  // How the signup goes, and the day
  // ------------------------------------------------------------------------------------
  Arza: 'Заявка',
  'Öňünden töleg': 'Предоплата',
  'Galan töleg': 'Остаток оплаты',
  Resminamalar: 'Документы',
  'Onlaýn form ýa-da ofisde şertnama. Topar sanawynda ýer bellenilýär.':
    'Онлайн-форма или договор в офисе. Место закрепляется в списке группы.',
  'Otel we uçar bileti bronlanýar.': 'Бронируются отель и авиабилет.',
  'Ugramakdan 10 gün öň dolulygyna tölenýär.': 'Вносится полностью за 10 дней до вылета.',
  'Passport, 4 surat we sanjym kepilnamasy tabşyrylýar.':
    'Сдаются паспорт, 4 фотографии и справка о прививках.',
  '04:30': '04:30',
  '08:00': '08:00',
  '10:00': '10:00',
  '13:00': '13:00',
  '19:30': '19:30',
  'Fejr namazy Haremde, topar bilen': 'Фаджр в Хараме, вместе с группой',
  'Ertirlik naharyň otelde': 'Завтрак в отеле',
  'Ziýarat ýa-da erkin ybadat': 'Зиярат или свободное поклонение',
  'Günortanlyk we dynç alyş': 'Обед и отдых',
  'Agşam nahary, soň ýatsy namazy': 'Ужин, затем иша',

  // ------------------------------------------------------------------------------------
  // The ten days
  // ------------------------------------------------------------------------------------
  'Ýygnanyşyk we uçuş': 'Сбор и вылет',
  'Umra ybadaty': 'Обряд умры',
  'Harem we erkin ybadat': 'Харам и свободное поклонение',
  'Taryhy ýerler': 'Исторические места',
  'Erkin gün': 'Свободный день',
  'Bedir ziýaraty': 'Зиярат в Бадр',
  'Masjid an-Nabawi': 'Масджид ан-Набави',
  'Uhud, Kuba, Kyblateýn': 'Ухуд, Куба, Киблатайн',
  'Soňky erkin gün': 'Последний свободный день',
  'Aşgabat → Jidda': 'Ашхабад → Джидда',
  Mekge: 'Мекка',
  'Mekge → Bedir': 'Мекка → Бадр',
  Medine: 'Медина',
  'Medine → Aşgabat': 'Медина → Ашхабад',
  'Aeroportda ýygnanyşyk, resminamalaryň barlagy, uçuş. Jiddada garşy alyş we awtobus bilen Mekgä geçiş.':
    'Сбор в аэропорту, проверка документов, вылет. Встреча в Джидде и переезд автобусом в Мекку.',
  'Ihram, tawaf, saý we saç kesmek. Ýolbaşçy ähli ädimi türkmen dilinde düşündirýär.':
    'Ихрам, таваф, саъй и подстригание волос. Руководитель объясняет каждый шаг по-туркменски.',
  'Bäş wagt namaz Haremde, goşmaça tawaf, Zemzem suwy.':
    'Пять намазов в Хараме, дополнительный таваф, вода Замзам.',
  'Jebel an-Nur, Hira gowagy, Arafat, Mina we Muzdalifa boýunça gezelenç.':
    'Поездка к Джабаль ан-Нур, пещере Хира, на Арафат, в Мину и Муздалифу.',
  'Şahsy ybadat, bazar we sowgatlyk. Isleýänler üçin goşmaça umra.':
    'Личное поклонение, базар и покупки. Для желающих — дополнительная умра.',
  'Awtobus bilen ýola düşmek, Bedir söweş meýdany we metjit, soň Medinä geçiş.':
    'Выезд автобусом, поле битвы при Бадре и мечеть, затем переезд в Медину.',
  'Rowda, Bakyy gonamçylygy we metjitde ybadat. Agşam erkin wagt.':
    'Равда, кладбище Баки и поклонение в мечети. Вечером свободное время.',
  'Uhud dagy we şehitler gonamçylygy, Kuba metjidinde iki rekagat namaz.':
    'Гора Ухуд и кладбище шахидов, два ракаата в мечети Куба.',
  'Şahsy ybadat, hoşlaşyk namazy, ýük ýygnamak.': 'Личное поклонение, прощальный намаз, сборы.',
  'Aeroporta transfer, uçuş we Aşgabatda garşy alyş.':
    'Трансфер в аэропорт, перелёт и встреча в Ашхабаде.',

  // ------------------------------------------------------------------------------------
  // Places of ziyarat
  // ------------------------------------------------------------------------------------
  'Masjid al-Haram': 'Масджид аль-Харам',
  'Jebel an-Nur · Hira': 'Джабаль ан-Нур · Хира',
  'Arafat, Mina we Muzdalifa': 'Арафат, Мина и Муздалифа',
  'Uhud dagy': 'Гора Ухуд',
  'Bedir söweş meýdany': 'Поле битвы при Бадре',
  'Kuba metjidi': 'Мечеть Куба',
  'Kyblateýn metjidi': 'Мечеть Киблатайн',
  'Jidda — deňiz kenary': 'Джидда — морская набережная',
  '4 gün': '4 дня',
  '3 gün': '3 дня',
  '3 sagat': '3 часа',
  '4 sagat': '4 часа',
  '2 sagat': '2 часа',
  '1 sagat': '1 час',
  'Kaba, tawaf we saý. Toparyň esasy ybadat ýeri, ähli günler ýanynda ýaşaýarys.':
    'Кааба, таваф и саъй. Главное место поклонения группы — все дни живём рядом.',
  'Nur dagy we Hira gowagy — ilkinji wahyýyň gelen ýeri.':
    'Гора Нур и пещера Хира — место первого откровения.',
  'Haj maksatnamasynyň esasy ýerlerine tanyşdyryş gezelenji.':
    'Обзорная поездка по главным местам программы хаджа.',
  'Pygamberimiziň metjidi, Rowda we Bakyy gonamçylygyna ziýarat.':
    'Мечеть Пророка, Равда и зиярат на кладбище Баки.',
  'Uhud söweşiniň ýeri we şehitler gonamçylygy, taryhy düşündiriş bilen.':
    'Место битвы при Ухуде и кладбище шахидов, с историческим рассказом.',
  'Bedir şäherine ýörite gezelenç, söweş meýdany we metjit.':
    'Отдельная поездка в город Бадр: поле битвы и мечеть.',
  'Yslamda ilkinji metjit. Ýörite iki rekagat namaz üçin barýarys.':
    'Первая мечеть в исламе. Едем специально ради двух ракаатов.',
  'Kybla üýtgän metjit — Medinäniň merkezine ýakyn.':
    'Мечеть, где сменилась кибла, — недалеко от центра Медины.',
  'Uçuşdan öň erkin wagt: köne şäher Al-Balad we kenar.':
    'Свободное время перед вылетом: старый город Аль-Балад и набережная.',

  // ------------------------------------------------------------------------------------
  // Past groups
  // ------------------------------------------------------------------------------------
  'Iýun aýyndaky toparymyz': 'Наша июньская группа',
  'Mart aýyndaky toparymyz': 'Наша мартовская группа',
  'Ýanwar aýyndaky toparymyz': 'Наша январская группа',
  'Oktýabr aýyndaky toparymyz': 'Наша октябрьская группа',
  'Iýul aýyndaky toparymyz': 'Наша июльская группа',
  'Aprel aýyndaky toparymyz': 'Наша апрельская группа',
  'Iýun 2026': 'Июнь 2026',
  'Mart 2026': 'Март 2026',
  'Ýanwar 2026': 'Январь 2026',
  'Oktýabr 2025': 'Октябрь 2025',
  'Iýul 2025': 'Июль 2025',
  'Aprel 2025': 'Апрель 2025',
  'Iýun toparymyz Mekgede 5, Medinede 4 gün boldy. Bedir we Uhud ziýaraty maksatnama girdi.':
    'Июньская группа провела 5 дней в Мекке и 4 в Медине. Зиярат в Бадр и Ухуд вошёл в программу.',
  'Mart toparymyz 10 gün ziýaratda boldy. Iň uly topar — 42 zyýaratçy.':
    'Мартовская группа была в зиярате 10 дней. Самая большая группа — 42 паломника.',
  'Gyş möwsümi — howa maýyl, Haremde adam az. Toparymyz goşmaça umra hem etdi.':
    'Зимний сезон — погода мягкая, в Хараме немноголюдно. Группа совершила и дополнительную умру.',
  'Doly topar — 45 adam. Medinede Kuba we Kyblateýn metjitlerine ziýarat edildi.':
    'Полная группа — 45 человек. В Медине совершён зиярат в мечети Куба и Киблатайн.',
  'Tomus möwsümi. Ýolbaşçy suw we dynç alyş tertibini aýratyn gözegçilikde tutdy.':
    'Летний сезон. Руководитель особо следил за питьевым режимом и отдыхом.',
  'Remezan aýyndan soňky ilkinji topar. Haremde agşam ybadatlary aýratyn ýatda galdy.':
    'Первая группа после рамадана. Вечерние молитвы в Хараме запомнились особенно.',

  // ------------------------------------------------------------------------------------
  // The hero slides and the two hotel lines on the current departure
  // ------------------------------------------------------------------------------------
  'Mekge — Harem golaýynda 4★ otel': 'Мекка — отель 4★ рядом с Харамом',
  'Medine — Metjidiň golaýynda 4★ otel': 'Медина — отель 4★ рядом с мечетью',
  // The numerals beside the four signup steps — the same characters in both languages, said
  // out loud so the report counts them translated rather than outstanding.
  '01': '01',
  '02': '02',
  '03': '03',
  '04': '04',
  'Du–Şe, 09:00–18:00': 'Пн–Сб, 09:00–18:00',
  'Aşgabat, Türkmenistan': 'Ашхабад, Туркменистан',
};

/**
 * A Global value in all three languages.
 *
 * An untranslated string comes back with `ru` alone rather than throwing. A seed that stops on
 * a missing translation is a seed nobody can run while the dictionary is being filled in, and
 * the gap is already reported by `pnpm --filter @charva/api i18n:report`, which is where a
 * translator looks. `translations.test.ts` is what fails when a gap appears.
 */
export function ru3(source: string): { ru: string; en?: string; tr?: string } {
  const found = GLOBAL[source];
  if (found === undefined) return { ru: source };
  return { ru: source, en: found[0], tr: found[1] };
}

/** An Umrah value in both languages. Same rule as above. */
export function tm2(source: string): { tm: string; ru?: string } {
  const found = UMRAH[source];
  if (found === undefined) return { tm: source };
  return { tm: source, ru: found };
}

/** For the test that walks the seeds and reports what is still missing. */
export const GLOBAL_KEYS = Object.keys(GLOBAL);
export const UMRAH_KEYS = Object.keys(UMRAH);

/** The same, when the seed only knows the language as a variable. */
export function byLang(lang: 'ru' | 'tm', source: string): Record<string, string> {
  return lang === 'ru' ? ru3(source) : tm2(source);
}
