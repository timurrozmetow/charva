# Charva Travel

Три публичных сайта на одном домене и одна общая админ-панель для туроператора из Ашхабада.

| Домен                      | Что                         | Языки          |
| -------------------------- | --------------------------- | -------------- |
| `charva-travel.com`        | страница выбора направления | RU, EN, TR, TM |
| `global.charva-travel.com` | туризм по Туркменистану     | RU, EN, TR     |
| `umra.charva-travel.com`   | умра для туркмен            | TM, RU         |
| `admin.charva-travel.com`  | админка на оба сайта        | RU             |
| `api.charva-travel.com`    | REST API                    | —              |

Монорепо на pnpm и Turborepo: React 18 + Vite + TypeScript на фронтендах,
Fastify + Drizzle + MySQL 8 на бэкенде.

---

## С чего начать

| Хочу                                 | Читать                                                   |
| ------------------------------------ | -------------------------------------------------------- |
| понять, где стоит работа             | [STATE.md](STATE.md)                                     |
| писать код                           | [CLAUDE.md](CLAUDE.md) — стек, правила, локальные грабли |
| понять, что и в каком порядке делаем | [PLAN.md](PLAN.md)                                       |
| узнать, как выглядит экран           | [docs/design/SCREENS.md](docs/design/SCREENS.md)         |
| что спросить у заказчика             | [QUESTIONS.md](QUESTIONS.md)                             |
| что отложено и почему                | [BACKLOG.md](BACKLOG.md)                                 |
| какие нужны фотографии               | [docs/design/photo-brief.md](docs/design/photo-brief.md) |

**Не открывать `design_handoff_charva/design/*.dc.html` напрямую** — это 250 КБ прототипов
дизайн-инструмента. Всё, что из них нужно, разобрано в `docs/design/SCREENS.md`. Сам пакет
read-only и не редактируется никогда.

---

## Состояние

**Планирование завершено, код не начат.** Следующий шаг — Фаза 0 из [PLAN.md](PLAN.md).

Оценка объёма: 416–526 часов на десять фаз. После Фазы 5 сайт Global полностью работоспособен
и его можно выложить, пока Umrah и админка в работе.

---

## Запуск

Требуется Node ≥ 20 и pnpm 10. Docker не нужен — локальные сервисы ставятся портативными
бинарниками под `.services/`.

```bash
pnpm install
pnpm setup:services     # MySQL 8 на 3308, Mailpit, ffmpeg
cp .env.example .env
pnpm dev
```

| Приложение   | Адрес                 |
| ------------ | --------------------- |
| `web-choice` | http://localhost:5180 |
| `web-global` | http://localhost:5181 |
| `web-umrah`  | http://localhost:5182 |
| `admin`      | http://localhost:5183 |
| `api`        | http://localhost:3002 |
| Mailpit      | http://localhost:8026 |

Ни один из этих портов не является значением по умолчанию: на машине параллельно живёт проект
`silkgrain`, который занимает 3001, 5173, 5174, 4173, 1025 и 8025, а XAMPP держит 3306. Полная
карта портов и объяснение — в [CLAUDE.md](CLAUDE.md).

Полный список команд — в [CLAUDE.md](CLAUDE.md).

---

## Устройство репозитория

```
apps/
  web-choice/     страница выбора направления
  web-global/     Charva Travel Global
  web-umrah/      Charva Umrah
  admin/          админка на оба сайта
  api/            Fastify + Drizzle + MySQL
packages/
  ui/             компоненты, токены, Tailwind preset, шрифты
  contracts/      Zod-схемы и чистые функции — общие для api и web
  config/         eslint, tsconfig, prettier
docker/           compose для CI и прода, локально не используется
scripts/          dev-setup.ps1, извлечение контента, деплой
docs/design/      выжимка дизайна и ТЗ на фото
design_handoff_charva/   исходный пакет дизайна, read-only
```
