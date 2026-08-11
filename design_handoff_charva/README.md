# Handoff: Charva Travel + Charva Umrah

Два публичных сайта на одном домене и одна общая админ-панель.

- `charva-travel.com` — страница выбора направления (Charva Choice)
- `global.charva-travel.com` — туристический сайт по Туркменистану (Charva Travel Global)
- `umra.charva-travel.com` — сайт умры для туркмен (Charva Umrah)
- `admin.charva-travel.com` — единая админ-панель, управляет обоими сайтами

Стек: **React (frontend) + Node.js (API) + MySQL (БД)**.

---

## О файлах в этом пакете

Файлы в папке `design/` — это **дизайн-референсы, сделанные в HTML**. Это прототипы, показывающие внешний вид и поведение, а не production-код для копирования. Задача — **воссоздать эти дизайны в React-приложении**, используя нормальные компоненты, роутинг и данные из API. HTML брать как источник точных значений (цвета, размеры, отступы, тексты), а не как код.

Файлы `.dc.html` — самодостаточные HTML-страницы, открываются в браузере напрямую. `support.js` — рантайм превью, в production не нужен. `image-slot.js` — плейсхолдеры под фото, в production заменить на `<img>` с реальными URL.

## Fidelity

**High-fidelity.** Все цвета, шрифты, размеры и отступы финальные. Верстать пиксель-в-пиксель по значениям из этого README и HTML-файлов. Дизайн сделан под **десктоп от 1280px**; мобильную адаптацию делать по правилам в разделе «Адаптив».

---

## 1. Архитектура

```
charva-travel.com                → React SPA «Choice» (одна страница)
global.charva-travel.com         → React SPA «Global», 9 маршрутов
umra.charva-travel.com           → React SPA «Umrah», 6 маршрутов
api.charva-travel.com            → Node.js (Express/Fastify) REST API
admin.charva-travel.com          → React SPA админки (защищена авторизацией)
```

Рекомендуемая структура монорепозитория:

```
charva/
├── apps/
│   ├── web-choice/     # страница выбора
│   ├── web-global/     # Charva Travel
│   ├── web-umrah/      # Charva Umrah
│   ├── admin/          # админ-панель
│   └── api/            # Node.js API
├── packages/
│   ├── ui/             # общие компоненты (Navbar, Footer, Card, Button)
│   ├── tokens/         # цвета, типографика, отступы
│   └── i18n/           # переводы
└── docker-compose.yml
```

Альтернатива: три сайта одним Next.js-приложением с определением поддомена в middleware. Оба варианта допустимы; монорепо с общим `packages/ui` предпочтительнее, т.к. Navbar/Footer/карточки повторяются.

### Языки

| Сайт | Языки | По умолчанию |
|---|---|---|
| Choice | RU, EN, TR, TM | RU |
| Global | RU, EN, TR | RU |
| Umrah | TM, RU | TM |

Переключатель языка спрятан под иконкой глобуса в navbar, открывается по клику. Язык хранить в URL-префиксе (`/ru/tours`, `/en/tours`) для SEO + дублировать в localStorage. Библиотека: `i18next` + `react-i18next`.

Весь текстовый контент (туры, отели, статьи, места зиярата, программа) переводимый — в БД хранить переводы в отдельных таблицах `*_translations`.

---

## 2. Design tokens

### Цвета — Global (тёплая песочно-коричневая гамма)

| Токен | HEX | Использование |
|---|---|---|
| `--sand` | `#DFA059` | Акцент, кнопки, активные состояния |
| `--sand-light` | `#F0C48E` | Hover акцента |
| `--sand-dark` | `#A9722C` | Ссылки, надзаголовки |
| `--brown-900` | `#33261B` | Тёмные секции, основной текст |
| `--brown-800` | `#2C221A` | Секция видео |
| `--brown-950` | `#241C15` | Footer |
| `--brown-700` | `#4A382A` | Текст navbar, вторичный тёмный |
| `--brown-500` | `#6E594A` | Основной body-текст на светлом |
| `--brown-400` | `#93806E` | Подписи, meta |
| `--brown-300` | `#B7A695` | Пустые значения |
| `--bg` | `#FAF6EF` | Фон страницы |
| `--surface` | `#FFFDFA` | Карточки |
| `--cream` | `#FDF9F3` | Текст на тёмном |
| `--btn-text` | `#3A2A18` | Текст на песочной кнопке |

Границы и тени на светлом: `rgba(90,66,44,.1)` — рамка карточки, `rgba(90,66,44,.11–.13)` — разделители, тень карточки при hover `0 26px 50px -26px rgba(90,66,44,.34)`.

### Цвета — Umrah (зелёно-песочная гамма)

| Токен | HEX | Использование |
|---|---|---|
| `--sand` | `#DFA059` | Акцент (общий с Global) |
| `--green-900` | `#0E1714` | Hero, тёмные блоки |
| `--green-800` | `#22322B` | Секции, карточка пакета |
| `--green-950` | `#0B1310` | Footer |
| `--green-700` | `#2A3A33` | Текст navbar |
| `--green-500` | `#55655C` | Body-текст |
| `--green-400` | `#7A8981` | Подписи, meta |
| `--ink` | `#16201C` | Заголовки |
| `--bg` | `#F7F4EE` | Фон страницы |
| `--surface` | `#FFFDFA` | Карточки |
| `--cream` | `#FCF9F4` | Текст на тёмном |
| `--link` | `#A8752F` | Ссылки |

Границы на светлом: `rgba(34,50,43,.09)`; тень карточки при hover `0 26px 50px -28px rgba(34,50,43,.34)`.

### Цвета — Choice

Фон `#0D0906`. Градиент на левой половине: `linear-gradient(to top, rgba(13,9,6,.96) 0%, rgba(13,9,6,.74) 34%, rgba(13,9,6,.22) 68%, rgba(13,9,6,.52) 100%)`. На правой то же, но с базой `rgba(7,14,12,…)`. Разделитель половин: `border-left: 1px solid rgba(223,160,89,.28)`.

### Типографика

Шрифт **Stolzl** (файлы в `design/assets/`, лицензию проверить перед публикацией):

```css
@font-face { font-family:'Stolzl'; src:url('/fonts/stolzl_regular.otf') format('opentype'); font-weight:400; font-display:swap; }
@font-face { font-family:'Stolzl'; src:url('/fonts/stolzl_medium.otf')  format('opentype'); font-weight:500; font-display:swap; }
@font-face { font-family:'Stolzl'; src:url('/fonts/stolzl_medium.otf')  format('opentype'); font-weight:600; font-display:swap; }
@font-face { font-family:'Stolzl'; src:url('/fonts/stolzl_bold.otf')    format('opentype'); font-weight:700; font-display:swap; }
@font-face { font-family:'Stolzl'; src:url('/fonts/stolzl_bold.otf')    format('opentype'); font-weight:800; font-display:swap; }
```

Для production конвертировать OTF → WOFF2 (экономия ~60% веса). Fallback-стек: `'Stolzl', 'Manrope', sans-serif`.

| Роль | Размер / вес / межстрочный | letter-spacing |
|---|---|---|
| Hero H1 (главная Global) | 82 / 500 / 1.0 | −0.02em |
| Hero H1 (Umrah) | 72 / 500 / 1.02 | −0.02em |
| H1 внутренних страниц | 62–64 / 500 / 1.04 | −0.02em |
| H2 секции | 40–50 / 500 / 1.1–1.14 | −0.015em |
| H3 / карточка большая | 30–34 / 500 / 1.15 | — |
| Заголовок карточки | 22–25 / 500 / 1.2–1.25 | — |
| Лид-абзац | 18–19 / 300 / 1.65 | — |
| Body | 14–16 / 300 / 1.6–1.7 | — |
| Надзаголовок секции | 11 / 700 / 1 | 0.3em, UPPERCASE |
| Метка / чип | 11–13 / 600–800 | 0.1–0.16em |
| Цифра статистики | 26–46 / 500 / 1 | — |

### Отступы и геометрия

- Контейнер: `max-width: 1480px`, padding `0 60px`. Navbar-остров: `max-width: 1440px`, padding `18px 40px 0`.
- Вертикальный ритм между секциями: `100–110px`.
- Радиусы: `999px` (кнопки, чипы, navbar), `30px` (крупные CTA-блоки), `26–28px` (панели), `20–24px` (карточки, фото), `16–18px` (мелкие элементы), `12px` (инпуты).
- Сетки: туры/отели/отзывы/места — 3 колонки, gap 24–26px; галерея — 4 колонки, `grid-auto-rows: 220px`, gap 16px, отдельные ячейки `span 2`.
- Переходы: hover карточки `transform: translateY(-6px)` + тень, 320ms `cubic-bezier(.22,.8,.2,1)`. Цвета — 240–260ms. Слайдер — 1000–1200ms `cubic-bezier(.4,0,.2,1)`. Раскрытие половины на Choice — 1100ms `cubic-bezier(.16,1,.3,1)`.

---

## 3. Общие компоненты

### Navbar (остров)

Sticky сверху, `z-index: 100`. Стеклянная плашка: `background: rgba(255,253,250,.88)`, `backdrop-filter: blur(26px) saturate(140%)`, рамка `1px solid rgba(90,66,44,.1)` (Umrah: `rgba(34,50,43,.1)`), тень `0 16px 44px -22px rgba(90,66,44,.3)`, радиус `999px`, padding `10px 14px 10px 22px`.

Слева логотип (высота 36px, ведёт на главную своего сайта), затем вертикальный разделитель 1×26px. **Пункты меню центрированы** (`flex: 1; justify-content: center`), каждый — пилюля `padding: 10px 15px`, при hover фон `rgba(223,160,89,.18)` и цвет `#8A5A22`. Активный пункт: вес 600, фон `rgba(223,160,89,.16)`.

Справа — переключатель языка (иконка глобуса SVG + код языка + каретка), по клику выпадает меню: `position: absolute; top: calc(100% + 12px); right: 0; min-width: 188px`, радиус 20px, анимация `navdrop` (fade + translateY(−8px) + scale(.97), 260ms). В строке — полное название языка, под ним код, справа галочка у активного.

Крайний справа — CTA-кнопка (`Онлайн-заявка` / `Ýazylmak`): фон `#DFA059`, текст `#3A2A18`, `padding: 13px 24px`, тень `0 8px 20px -10px rgba(176,118,43,.7)`; hover — фон тёмный (`#4A382A` / `#22322B`), текст кремовый.

### Footer

Тёмный (`#241C15` Global, `#0B1310` Umrah), padding `76px 0 0`. Сетка `1.4fr 1fr 1fr 1fr`, gap 50px: логотип + юр. текст + соцкнопки (40×40, круглые, при hover заливаются песочным), затем три колонки ссылок. Нижняя строка через `border-top`: копирайт слева, справа ссылки на страницу выбора и на второй сайт.

### Карточка тура/отеля/места

`background: #FFFDFA`, рамка `1px solid rgba(90,66,44,.1)`, радиус 22px, overflow hidden. Фото сверху (240px туры, 220px отели, 230px зиярат), поверх фото бейдж-пилюля в левом верхнем углу (`rgba(255,253,250,.94)`, 11px/800, uppercase). Контент: padding `26px`, gap 14px — заголовок, описание (`flex: 1`), meta-строка, разделительная линия, снизу цена и «Подробнее →».

### Фильтры-чипы

Ряд чипов над сеткой, `border-top` + `padding-top: 30px`. Неактивный: прозрачный фон, рамка `rgba(90,66,44,.18)`, текст `#4A382A`. Активный: фон `#33261B` (Umrah: `#22322B`), текст цвета фона страницы. Справа в том же ряду — счётчик «Показано N из M».

---

## 4. Страницы — Charva Travel Global

### 4.1 Главная (`/`)

- **Hero-слайдер**, высота `88vh` (min 720px), заходит под navbar (`margin-top: -78px`). 4 слайда (Дарваза, Йангыкала, Ашхабад, Мерв), автопрокрутка 6500ms, перекрёстное затухание через `opacity` 1200ms. Справа по центру вертикальный список индикаторов: подпись + полоска (активная 40px/`#DFA059`, неактивная 18px/`rgba(253,249,243,.4)`), по клику переход к слайду. Оверлей: `linear-gradient(to top, rgba(38,27,18,.94) 0%, rgba(38,27,18,.5) 46%, rgba(38,27,18,.34) 100%)`.
- Внутри hero: надзаголовок, H1 (82px), лид, **строка поиска** — стеклянная панель `max-width: 1000px`, 3 поля (Направление, Даты, Гостей) + песочная кнопка «Подобрать».
- **Популярные туры** — 6 карточек, ссылка «Все туры — 32».
- **Отели** — 4 карточки в ряд.
- **Интересное про Туркменистан** — крупная карточка-статья (`1.35fr`) + две горизонтальные (`200px` фото + текст).
- **Галерея** — мозаика 4 колонки с ячейками `span 2`.
- **Видео** — тёмная секция `#2C221A`: большое видео слева (`1.6fr`) + список из 3 справа.
- **Информация о стране** — таблица фактов слева, карточка «Виза» с 4 шагами справа.
- **Отзывы** — 3 карточки.
- **Онлайн-заявка** — тёмный блок `#33261B`, радиус 30px: форма слева, фото справа.
- Footer.

### 4.2 Туры (`/tours`)

H1, лид, три показателя справа (32 маршрута / 3–14 дней / минимальная цена). Фильтры: Все, Классика, Природа, История, Культура, Отдых. Сетка 3×3 из 9 туров. Внизу CTA-блок «Не нашли нужный маршрут?» → сборщик.

Данные туров (цены за человека, USD): Классический Туркменистан 1 190 · Каракумы и Дарваза 540 · Шёлковый путь 870 · Каньоны Йангыкала 690 · Аваза 1 340 · Ахалтекинские скакуны 620 · Вкус Туркменистана 710 · Ковровые мастерские 580 · Большой круг 2 180.

### 4.3 Сборщик туров (`/builder`) — ключевая функция

Тёмная секция `#33261B`, три колонки `250px | 1fr | 320px`.

**Левая** — вертикальный рельс из 9 шагов. Кружок с номером; у заполненного шага — галочка и полупрозрачный песочный фон; у активного — песочный фон и тёмный текст, строка подсвечена `rgba(223,160,89,.16)`. Клик по шагу — переход к нему.

**Центр** — панель `min-height: 540px`: «Шаг N из 9», подсказка справа, заголовок вопроса, сетка вариантов 3 колонки. Вариант — карточка с названием и пояснением; выбранный: рамка `#DFA059`, фон `rgba(223,160,89,.16)`, текст песочный. Внизу «← Назад», прогресс «Заполнено N из 8» и песочная кнопка «Далее →» (на последнем шаге — «Отправить заявку»).

Шаги и варианты:

| # | Шаг | Тип | Варианты |
|---|---|---|---|
| 1 | Направление / города | множественный | Ашхабад, Дарваза, Мары/Мерв, Куняургенч, Йангыкала, Аваза |
| 2 | Даты и длительность | один | 3, 5, 7, 10, 14 дней, Свои даты |
| 3 | Отель и звёздность | один | 3★, 4★, 5★, Бутик-отель, Юрточный лагерь, Смешанно |
| 4 | Питание | множественный | Халяль, Национальная, Европейская, Вегетарианское, Без глютена, Без питания |
| 5 | Транспорт | один | Легковой авто, Минивэн, Автобус, Внедорожник 4×4, Поезд, Внутренний перелёт |
| 6 | Активности / экскурсии | множественный | Экскурсии по городу, Пустыня и кемпинг, Ахалтекинские кони, Гастротур, Ремёсла и ковры, Каспий и пляж |
| 7 | Количество человек | один | 1, 2, 3–5, 6–10, 10+, Пока не знаю |
| 8 | Гид и язык гида | один | Русский, Английский, Турецкий, Туркменский, Несколько языков, Без гида |
| 9 | Цена и онлайн-заявка | форма | Имя, Телефон, Комментарий, согласие на обработку |

**Правая колонка** — sticky-смета (`top: 110px`), светлая на тёмном фоне. Строки «шаг → выбранное значение» (незаполненные — «—» цветом `#B7A695`), итоговая цена, пояснение, кнопка «Отправить заявку», «Ответим в течение 15 минут».

**Формула расчёта (перенести в API, не в клиент):**

```
pax        = 1|2|4(3–5)|8(6–10)|12(10+), иначе 2
nights     = 3|5|7|10|14, иначе 6
hotelRate  = 3★:46, 4★:78, 5★:145, Бутик:96, Юрта:95, Смешанно:88 (USD/ночь)
perPerson  = nights × hotelRate + (кол-во городов × 60) + (кол-во активностей × 45) + 180
total      = perPerson × pax
```

Клиент показывает предварительную оценку, окончательную цену подтверждает менеджер. Ставки хранить в БД (`pricing_rules`), чтобы менялись из админки без деплоя.

### 4.4 Отели (`/hotels`)

Фильтры: Все, 5★, 4★, 3★, Бутик, Кемп. 9 карточек: Ýyldyz Hotel (Ашхабад, 145 $), Arkaç Resort (Аваза, 168 $), Margush Hotel (Мары, 78 $), Nusay Hotel (Ашхабад, 92 $), Köneürgenç Guest House (Дашогуз, 46 $), Balkan Hotel (Балканабат, 52 $), Garagum Camp (Каракумы, 95 $), Nisa Boutique (Геоктепе, 96 $), Türkmenbaşy Plaza (Туркменбаши, 84 $). У каждого — чипы удобств.

### 4.5 Туркменистан (`/turkmenistan`)

Статьи (крупная + 2 малых), таблица фактов (8 строк), карточка «Виза» (4 шага), сетка «Что стоит увидеть» (6 мест).

### 4.6 Галерея (`/gallery`)

Фильтры: Все, Природа, Города, История, Культура, Кухня. Мозаика 14 фото с подписями на градиенте. Кнопка «Показать ещё» — пагинация по 16.

### 4.7 Видео (`/video`)

Тёмная страница `#2C221A`. Главное видео 560px с круглой кнопкой play 96px, ниже сетка 3×2. У карточки — бейдж длительности в правом нижнем углу превью.

### 4.8 Отзывы (`/reviews`)

Показатели: 4,8 / 214 отзывов / 92% советуют. Фильтры: Все, 5 звёзд, 4 звезды, Сначала новые. 9 карточек: звёзды, дата, название тура, текст, аватар + имя + город.

### 4.9 Онлайн-заявка (`/contact`)

Слева форма (`1.15fr`): табы «Заявка на тур» / «Общий вопрос», 4 поля, чипы «Интересует» (Готовый тур, Свой маршрут, Только отель, Виза, Трансфер), комментарий, чекбокс, кнопка. Справа — тёмная карточка контактов + фото офиса. Внизу FAQ-аккордеон в 2 колонки (6 вопросов), у раскрытого рамка `#DFA059`.

---

## 5. Страницы — Charva Umrah

Один вид умры (не несколько пакетов). **Цены на сайте не показываются** — их сообщает сопровождающий по телефону. Это осознанное требование: не возвращать цены в публичный интерфейс.

### 5.1 Главная (`/`)

- **Hero-слайдер** (Мекка, Медина, группа), автопрокрутка 6500ms, индикаторы горизонтально под кнопками. Оверлей диагональный: `linear-gradient(105deg, rgba(14,23,20,.96) 0%, rgba(14,23,20,.84) 46%, rgba(14,23,20,.42) 100%)`.
- Слева: пульсирующий бейдж «Indiki topar · 18.09.2026», H1 (72px), лид, две кнопки.
- Справа — **карточка отсчёта**: 4 ячейки (дни / часы / минуты / секунды, цифры 42px, тик раз в секунду), прогресс набора группы «33 / 45 adam» (полоса 73%, градиент `#DFA059 → #F0C48E`), свободные места 12, отель, строка про предыдущую группу (42 человека, 14.03.2026).
- Полоса статистики `#22322B`: 68 групп / 2 840 паломников / 12 лет / 7–12 дней.
- **Блок пакета**: слева тёмная карточка с составом (8 пунктов в 2 колонки) и кнопками, справа — **второй слайдер** (отель, питание, транспорт, сопровождающий), автопрокрутка 5000ms, подпись слева внизу + точки справа.
- Превью зиярата (3 карточки), два больших превью-блока (программа и медиа), CTA-блок записи, footer.

### 5.2 Paket (`/paket`)

Карточка состава + слайдер, таблица условий (8 строк: даты, длительность, группа, отель, номер, питание, сопровождающий), «Baha girýär» (7 пунктов) и «Ýazylyş tertibi» (4 шага). Без сумм.

### 5.3 Ziýarat ýerleri (`/ziyarat`)

Фильтры: Ählisi, Mekge, Medine, Bedir. 9 мест: Masjid al-Haram, Jebel an-Nur/Hira, Arafat-Mina-Muzdalifa, Masjid an-Nabawi, Uhud, Bedir, Kuba, Kyblateýn, Jidda. У каждого — город, описание, длительность, в каком пакете.

### 5.4 Maksatnama (`/maksatnama`)

Тёмная страница `#22322B`. 10 дней списком: сетка `110px | 300px | 1fr | auto` — номер дня (32px, песочный), заголовок, описание, город справа. Клик по строке подсвечивает её. Ниже — распорядок дня (5 строк) и фото.

### 5.5 Suratlar we wideo (`/suratlar`) — важный раздел

Материалы сгруппированы **по группам паломников**. Сверху ряд табов-карточек «Topary saýlaň»: название месяца, под ним «N adam · M surat». Активный таб — тёмный фон.

При выборе группы показываются: заголовок группы («Iýun aýyndaky toparymyz»), бейдж «Zyýaratçy · дата», описание, счётчик «N surat · M wideo», мозаика 8 фото с подписями и 3 видео-карточки.

Ниже — **архив всех групп** таблицей: `Topar | Ugralan wagty | Zyýaratçy | Material | Görmek →`. Клик по строке переключает активную группу.

Группы в дизайне: Iýun 2026 (12.06, 44 чел., 38 фото, 4 видео), Mart 2026 (14.03, 42 чел., 41/3), Ýanwar 2026 (18.01, 39 чел., 33/3), Oktýabr 2025 (05.10, 45 чел., 36/4), Iýul 2025 (22.07, 38 чел., 29/2), Aprel 2025 (09.04, 40 чел., 31/3).

**Это основной контент для админки**: администратор создаёт группу и загружает в неё фото и видео.

### 5.6 Ýazylmak (`/yazylmak`)

Сверху бейдж «Boş ýer: 12 · N gün galdy» (считается от даты вылета). Слева форма: сводка тура в песочной плашке (без цены), 4 поля (Ф.И.О., телефон, номер паспорта, количество человек), выбор типа номера чипами (1/2/3/4-местный), комментарий, чекбокс, кнопка. Справа: тёмная карточка со сводкой (вылет, возврат, длительность, отель, номер) и строкой «о цене расскажет сопровождающий», карточка контактов, фото.

---

## 6. Страница выбора (Charva Choice)

Полноэкранный сплит на две половины (`height: 100vh`, `min-height: 760px`, `min-width: 1280px`).

- Каждая половина — ссылка на свой поддомен, `flex: 1 1 0`. При наведении `flex-grow: 1.45`, переход `1100ms cubic-bezier(.16,1,.3,1)`.
- Фон половины — фото + градиент затемнения снизу. По центру половины полупрозрачная цифра «01» / «02» (230px, `rgba(253,249,243,.05)`).
- Контент внизу: линия + название бренда + список языков, H1 в две строки (64px), лид, чипы разделов, три показателя, кнопка.
- На стороне Umrah дополнительно бейдж «Набор открыт · 12 мест» с пульсирующей точкой (справа сверху) и живой счётчик дней до вылета в показателях.
- Сверху — navbar-остров (логотип + переключатель языка под глобусом). Снизу — строка с лицензией слева и подсказкой справа.

Показатели: Global — 32 маршрута, 46 отелей, 1 400+ гостей в год. Umrah — дней до вылета (расчёт), 45 мест в группе, 68 групп отправлено.

---

## 7. База данных (MySQL)

Схема-минимум. Все пользовательские тексты — в таблицах переводов; ниже показано на примере `tours`, тот же приём применить к `hotels`, `articles`, `ziyarat_places`, `program_days`, `packages`.

```sql
-- ── общее
CREATE TABLE languages (
  code VARCHAR(5) PRIMARY KEY,          -- ru, en, tr, tm
  name VARCHAR(50) NOT NULL,
  site ENUM('global','umrah','both') NOT NULL,
  is_default TINYINT(1) DEFAULT 0
);

CREATE TABLE media (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  type ENUM('image','video') NOT NULL,
  url VARCHAR(500) NOT NULL,
  thumb_url VARCHAR(500),
  width INT, height INT, duration_sec INT,
  alt VARCHAR(255),
  uploaded_by BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(120),
  role ENUM('superadmin','editor','manager') NOT NULL DEFAULT 'editor',
  site_scope ENUM('global','umrah','both') NOT NULL DEFAULT 'both',
  last_login_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Global
CREATE TABLE tours (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) UNIQUE NOT NULL,
  category ENUM('classic','nature','history','culture','leisure') NOT NULL,
  days INT, cities_count INT, stars VARCHAR(10),
  price_from DECIMAL(10,2), currency CHAR(3) DEFAULT 'USD',
  cover_media_id BIGINT,
  is_published TINYINT(1) DEFAULT 0,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE tour_translations (
  tour_id BIGINT, lang VARCHAR(5),
  title VARCHAR(200), summary TEXT, body MEDIUMTEXT, tag VARCHAR(60),
  PRIMARY KEY (tour_id, lang)
);

CREATE TABLE hotels (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) UNIQUE NOT NULL,
  city VARCHAR(80), stars VARCHAR(10), category VARCHAR(20),
  price_per_night DECIMAL(10,2), currency CHAR(3) DEFAULT 'USD',
  amenities JSON, cover_media_id BIGINT,
  is_published TINYINT(1) DEFAULT 0, sort_order INT DEFAULT 0
);

CREATE TABLE articles (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(120) UNIQUE NOT NULL,
  tag VARCHAR(60), read_minutes INT,
  cover_media_id BIGINT, is_featured TINYINT(1) DEFAULT 0,
  is_published TINYINT(1) DEFAULT 0, published_at DATETIME
);

CREATE TABLE gallery_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  media_id BIGINT NOT NULL,
  category ENUM('nature','cities','history','culture','food') NOT NULL,
  caption VARCHAR(200), grid_span ENUM('1x1','2x1','1x2','2x2') DEFAULT '1x1',
  sort_order INT DEFAULT 0, is_published TINYINT(1) DEFAULT 1
);

CREATE TABLE videos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  media_id BIGINT, external_url VARCHAR(500),
  title VARCHAR(200), tag VARCHAR(60),
  duration VARCHAR(10), views_count INT DEFAULT 0,
  is_featured TINYINT(1) DEFAULT 0, sort_order INT DEFAULT 0
);

CREATE TABLE reviews (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  author_name VARCHAR(120), author_city VARCHAR(120),
  avatar_media_id BIGINT, rating TINYINT NOT NULL,
  tour_id BIGINT, body TEXT, visited_at DATE,
  status ENUM('pending','published','rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── сборщик туров
CREATE TABLE builder_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) UNIQUE NOT NULL,     -- dest, dates, hotel, food, transport, activities, people, guide
  is_multi TINYINT(1) DEFAULT 0,
  sort_order INT
);
CREATE TABLE builder_options (
  id INT AUTO_INCREMENT PRIMARY KEY,
  step_id INT NOT NULL,
  code VARCHAR(60) NOT NULL,
  price_modifier DECIMAL(10,2) DEFAULT 0,  -- ставка отеля, надбавка за город и т.п.
  modifier_type ENUM('per_night','per_item','flat','multiplier') DEFAULT 'flat',
  sort_order INT
);
CREATE TABLE builder_option_translations (
  option_id INT, lang VARCHAR(5),
  name VARCHAR(120), note VARCHAR(200),
  PRIMARY KEY (option_id, lang)
);
CREATE TABLE pricing_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_name VARCHAR(60) UNIQUE NOT NULL,   -- base_fee, city_fee, activity_fee
  value DECIMAL(10,2) NOT NULL
);

CREATE TABLE leads (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  site ENUM('global','umrah') NOT NULL,
  source ENUM('builder','contact','tour','hotel','umrah_signup') NOT NULL,
  name VARCHAR(150), phone VARCHAR(40), email VARCHAR(190),
  people_count VARCHAR(20), comment TEXT,
  payload JSON,                            -- полный набор выборов сборщика
  estimated_price DECIMAL(10,2),
  status ENUM('new','in_progress','confirmed','rejected') DEFAULT 'new',
  assigned_to BIGINT, lang VARCHAR(5),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Umrah
CREATE TABLE umrah_trips (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  depart_date DATETIME NOT NULL,
  return_date DATETIME,
  seats_total INT NOT NULL DEFAULT 45,
  seats_taken INT NOT NULL DEFAULT 0,
  hotel_info VARCHAR(200),
  status ENUM('upcoming','open','closed','departed','completed') DEFAULT 'open',
  is_current TINYINT(1) DEFAULT 0          -- какой рейс показывать в баннере
);

CREATE TABLE umrah_groups (              -- прошедшие группы для галереи
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT,
  slug VARCHAR(80) UNIQUE NOT NULL,       -- iyun26, mart26
  departed_at DATE NOT NULL,
  pilgrims_count INT,
  is_published TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0
);
CREATE TABLE umrah_group_translations (
  group_id BIGINT, lang VARCHAR(5),
  label VARCHAR(160),                     -- «Iýun aýyndaky toparymyz»
  short_label VARCHAR(60),                -- «Iýun 2026»
  description TEXT,
  PRIMARY KEY (group_id, lang)
);
CREATE TABLE umrah_group_media (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  group_id BIGINT NOT NULL,
  media_id BIGINT NOT NULL,
  caption VARCHAR(200),
  grid_span ENUM('1x1','2x1','1x2','2x2') DEFAULT '1x1',
  sort_order INT DEFAULT 0
);

CREATE TABLE ziyarat_places (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(80) UNIQUE, city ENUM('mekge','medine','bedir','jidda'),
  duration_label VARCHAR(60), cover_media_id BIGINT, sort_order INT
);

CREATE TABLE umrah_program_days (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT, day_number INT, city VARCHAR(80), sort_order INT
);

CREATE TABLE umrah_signups (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  trip_id BIGINT,
  full_name VARCHAR(150), phone VARCHAR(40),
  passport_number VARCHAR(40), people_count INT,
  room_type ENUM('single','double','triple','quad'),
  comment TEXT,
  status ENUM('new','contacted','confirmed','paid','cancelled') DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Индексы: `is_published + sort_order` на всех публичных таблицах, `created_at` на `leads` и `umrah_signups`, `group_id + sort_order` на `umrah_group_media`.

---

## 8. API (Node.js)

Публичные (GET, без авторизации, кэш 5 минут):

```
GET  /api/v1/:site/settings?lang=ru
GET  /api/v1/global/tours?category=&lang=
GET  /api/v1/global/tours/:slug?lang=
GET  /api/v1/global/hotels?stars=&lang=
GET  /api/v1/global/articles?lang=
GET  /api/v1/global/gallery?category=&page=
GET  /api/v1/global/videos?lang=
GET  /api/v1/global/reviews?rating=&page=
GET  /api/v1/global/builder/config?lang=      → шаги, варианты, ставки
POST /api/v1/global/builder/quote             → расчёт цены на сервере
POST /api/v1/global/leads                     → заявка (rate limit + captcha)

GET  /api/v1/umrah/trip/current?lang=         → дата вылета, места, статус
GET  /api/v1/umrah/package?lang=
GET  /api/v1/umrah/ziyarat?city=&lang=
GET  /api/v1/umrah/program?lang=
GET  /api/v1/umrah/groups?lang=               → список групп для табов
GET  /api/v1/umrah/groups/:slug?lang=         → фото и видео группы
POST /api/v1/umrah/signups
```

Админские (`/api/v1/admin/*`, JWT + refresh, роли): CRUD по всем сущностям, загрузка медиа (multipart → S3/MinIO, генерация webp-превью в 3 размерах), управление заявками (смена статуса, назначение менеджеру, экспорт CSV), настройки рейса умры, дашборд со сводкой.

Обязательно: валидация входа (zod/joi), rate limit на POST-эндпоинты, honeypot + captcha на формах, CORS только для своих поддоменов, helmet, логирование заявок, уведомления менеджеру (Telegram-бот или e-mail) при новой заявке.

---

## 9. Админ-панель

Одна панель на оба сайта, переключатель сайта в шапке (Global / Umrah). Разделы:

**Global** — Туры, Отели, Статьи, Галерея, Видео, Отзывы (модерация), Сборщик туров (шаги, варианты, ставки цен), Заявки.

**Umrah** — Текущий рейс (дата вылета, всего мест, занято — это питает баннер обратного отсчёта), Состав пакета, Места зиярата, Программа по дням, **Группы** (создать группу → загрузить фото и видео → подписи → порядок), Записи на умру.

**Общее** — Медиатека (drag-and-drop загрузка, кроп, alt-тексты), Переводы (таблица ключей по языкам), Пользователи и роли, Настройки сайта (контакты, соцсети, лицензия), Логи.

Дизайн админки не рисовался. Взять готовую библиотеку в тех же токенах: песочный `#DFA059` как primary, `#33261B` как тёмный, шрифт Stolzl, радиусы 12–20px.

---

## 10. Адаптив

Дизайн десктопный (`min-width: 1280px`). Правила сжатия:

- **≥1280px** — как в макетах.
- **1024–1279px** — контейнер `padding: 0 40px`, сетки 3→2 колонки, галерея 4→3, hero H1 82→56px, сборщик: рельс шагов превращается в горизонтальную полосу над панелью, смета уезжает под панель.
- **768–1023px** — все сетки в 1–2 колонки, navbar-пункты сворачиваются в бургер (выезжающая панель), hero-высота 70vh, слайдер-индикаторы переносятся вниз по центру.
- **<768px** — одна колонка, H1 36–40px, отступы секций 56px, кнопки на всю ширину, Choice-сплит становится вертикальным (две половины по 50vh, раскрытие по тапу отключить), карточка обратного отсчёта — 4 ячейки в 2 ряда, таблица архива групп — карточками.

Минимальный тап-таргет 44px.

---

## 11. Ассеты и изображения

- В прототипах все изображения — плейсхолдеры `<image-slot>` с русской подписью, что за фото должно быть. **Реальных фотографий в пакете нет.** В production заменить на `<img loading="lazy" srcset>` с URL из медиатеки.
- Логотип: `design/assets/logo-mark-brown.png` (для светлого navbar), `logo-mark-sand.png` (для тёмного footer и Choice), `logo-crop.png` — исходник. Оригинал — растр; для качества на ретине попросить у заказчика векторный SVG.
- Шрифт Stolzl — `design/assets/*.otf`. Конвертировать в WOFF2, проверить лицензию на веб-использование.
- Формат фото: WebP + AVIF, ленивая загрузка, blur-up placeholder. Hero — до 2400px по ширине, карточки — 800px, галерея — 1200px.

---

## 12. Дальнейшие шаги

1. Поднять монорепо, вынести токены и общие компоненты в `packages/`.
2. Схема БД + сиды из данных, зашитых в HTML-прототипы (туры, отели, отзывы, места зиярата, программа, группы).
3. API с публичными эндпоинтами, затем админские.
4. Три фронтенда по макетам, начиная с Choice (самый простой) → Global → Umrah.
5. Админка.
6. Настроить поддомены, SSL (wildcard-сертификат на `*.charva-travel.com`), CDN для медиа.
7. SEO: sitemap на каждый поддомен, hreflang между языковыми версиями, OG-теги, schema.org (`TouristTrip`, `Hotel`, `Review`).

## Файлы в пакете

```
design/
├── Charva Choice.dc.html            — страница выбора
├── Charva Nav.dc.html               — navbar Global
├── Charva Footer.dc.html            — footer Global
├── Charva Travel Global.dc.html     — главная Global
├── Charva Tours.dc.html             — туры
├── Charva Builder.dc.html           — сборщик туров
├── Charva Hotels.dc.html            — отели
├── Charva Turkmenistan.dc.html      — о стране и виза
├── Charva Gallery.dc.html           — галерея
├── Charva Video.dc.html             — видео
├── Charva Reviews.dc.html           — отзывы
├── Charva Contact.dc.html           — онлайн-заявка
├── Charva Umrah.dc.html             — главная Umrah
├── Charva Umrah Nav.dc.html         — navbar Umrah
├── Charva Umrah Footer.dc.html      — footer Umrah
├── Charva Umrah Packages.dc.html    — состав пакета
├── Charva Umrah Route.dc.html       — места зиярата
├── Charva Umrah Program.dc.html     — программа по дням
├── Charva Umrah Media.dc.html       — фото и видео по группам
├── Charva Umrah Signup.dc.html      — запись
├── image-slot.js                    — плейсхолдер фото (только для прототипа)
├── support.js                       — рантайм превью (в production не нужен)
└── assets/                          — шрифты Stolzl и логотипы
```

Чтобы посмотреть дизайн: открыть любой `.dc.html` в браузере. Страницы связаны ссылками между собой.
