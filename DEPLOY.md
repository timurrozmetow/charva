# Выкладка на VPS

Сверху вниз на чистой Ubuntu 24.04. Каждый шаг — команда, которую можно скопировать; каждый
блок заканчивается проверкой, по которой видно, что шаг удался.

Не Alpine: `sharp` и `@node-rs/argon2` собраны под glibc, а на musl падают при первом же
`require`.

---

## Что нужно до первой команды

| Что                                | Зачем                                                       | Статус                     |
| ---------------------------------- | ----------------------------------------------------------- | -------------------------- |
| VPS, Ubuntu 24.04, 2 ГБ ОЗУ, 40 ГБ | всё ниже                                                    | Q-6                        |
| Домен `charva-travel.com`          | четыре поддомена                                            | зарегистрирован            |
| **API-доступ к DNS-провайдеру**    | wildcard выдаётся только через DNS-01; HTTP-01 его не умеет | есть                       |
| Публичный ключ на сервере          | `deploy.sh` ходит по ключу, пароль не спрашивает            | `~/.ssh/charva-deploy.pub` |

**Диск — единственный параметр, который стоит проверить дважды.** Видео хостится на этой же
машине (D-8): 18 роликов Global плюс по три на каждую группу паломников. При 720p это десятки
гигабайт, а типичный VPS даёт 40. `MAX_VIDEO_UPLOAD_MB=400` — верхняя граница одного файла, а
не общего объёма. Следить: `df -h /`.

---

## 1. Пользователь и базовая настройка

Всё работает от `charva`, не от root. Один процесс Node, доступный из интернета через nginx,
не должен иметь права переписать систему.

```bash
adduser --disabled-password --gecos "" charva
mkdir -p /home/charva/.ssh && chmod 700 /home/charva/.ssh
cp /root/.ssh/authorized_keys /home/charva/.ssh/authorized_keys
chown -R charva:charva /home/charva/.ssh && chmod 600 /home/charva/.ssh/authorized_keys

apt update && apt upgrade -y
apt install -y curl git ufw fail2ban nginx mysql-server ffmpeg
timedatectl set-timezone UTC
```

**UTC — не косметика.** `umrah_trips.depart_at` хранится в UTC, отсчёт на трёх сайтах считается
от него, а `parseSqlDate` дописывает `Z` к строке из MySQL. Сервер в другом поясе сдвинет
вылет на пять часов, и заметит это первым паломник.

```bash
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

MySQL и API слушают только `127.0.0.1`, поэтому 3306 и 3002 в правилах не нужны — и не должны
там появиться.

**Проверка:** `ssh charva@<ip>` пускает по ключу; `ufw status` показывает открытыми только 22,
80 и 443.

---

## 2. Node 22, pnpm, PM2

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
corepack enable && corepack prepare pnpm@10 --activate
npm install -g pm2
```

**Проверка:** `node -v` → v22.x, `pnpm -v` → 10.x, `pm2 -v` отвечает.

---

## 3. База данных

```bash
mysql_secure_installation
```

```sql
CREATE DATABASE charva CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'charva'@'localhost' IDENTIFIED BY 'ПРИДУМАТЬ-И-СОХРАНИТЬ';
GRANT ALL PRIVILEGES ON charva.* TO 'charva'@'localhost';
FLUSH PRIVILEGES;
```

Права только на свою схему. Инъекция, дошедшая до драйвера, тогда упирается в границу базы, а
не читает всё, что есть на машине.

`sql_mode` должен совпадать с тем, против чего писались миграции и тесты. `STRICT_TRANS_TABLES`
— причина, по которой слишком длинная строка не обрезается молча, а `ONLY_FULL_GROUP_BY` ловит
агрегат, у которого нет группировки:

```bash
cat >> /etc/mysql/mysql.conf.d/mysqld.cnf <<'EOF'

[mysqld]
sql_mode = STRICT_TRANS_TABLES,ONLY_FULL_GROUP_BY,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
default-time-zone = '+00:00'
EOF
systemctl restart mysql
```

**Проверка:** `mysql -e "SELECT @@sql_mode, @@character_set_server, @@time_zone"` — строгий
режим, utf8mb4, `+00:00`.

---

## 4. Каталоги и секреты

```bash
sudo -u charva mkdir -p /opt/charva/{releases,shared/uploads,shared/logs,backups}
```

Владелец — `charva`. `/opt` по умолчанию принадлежит root, поэтому либо `chown -R charva
/opt/charva`, либо создать каталог от root и передать.

Скопировать `.env.production.example` из репозитория в `/opt/charva/shared/.env`, заполнить и
закрыть:

```bash
chmod 600 /opt/charva/shared/.env
```

Пять секретов обязаны быть настоящими — API с дефолтными значениями под `NODE_ENV=production`
не стартует, и это сделано намеренно:

```bash
for i in 1 2 3 4; do node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"; done
```

**`PASSPORT_ENCRYPTION_KEY` — тот, который нельзя потерять.** Им расшифрованы все уже
сохранённые номера паспортов (D-18). Потеря ключа — потеря этих строк; замена — то же самое.
Хранить там же, где пароль от базы, и в бэкап класть вместе.

**Проверка:** `grep -c 'replace-me' /opt/charva/shared/.env` → `0`.

---

## 5. Сертификат

Wildcard выдаётся **только** через DNS-01. HTTP-01 wildcard не умеет в принципе — это
ограничение ACME, а не настройки.

`*.charva-travel.com` **не покрывает сам `charva-travel.com`**, поэтому в сертификате должны
быть оба имени.

```bash
snap install --classic certbot
ln -sf /snap/bin/certbot /usr/bin/certbot
snap set certbot trust-plugin-with-root=ok
snap install certbot-dns-cloudflare   # или другой плагин под вашего провайдера

mkdir -p /root/.secrets && chmod 700 /root/.secrets
printf 'dns_cloudflare_api_token = ТОКЕН\n' > /root/.secrets/cloudflare.ini
chmod 600 /root/.secrets/cloudflare.ini

certbot certonly \
  --dns-cloudflare --dns-cloudflare-credentials /root/.secrets/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 60 \
  -d 'charva-travel.com' -d '*.charva-travel.com' \
  --agree-tos -m ПОЧТА --non-interactive
```

Провайдер не Cloudflare — плагин другой (`certbot-dns-route53`, `certbot-dns-digitalocean`,
`certbot-dns-namecheap`), остальное то же.

DNS: `A` для `charva-travel.com` и `A` либо `CNAME` для `www`, `global`, `umra`, `admin`, `api`.

**Проверка:** `certbot certificates` показывает оба имени; `certbot renew --dry-run` проходит.

---

## 6. nginx

```bash
mkdir -p /etc/nginx/snippets /var/cache/nginx/charva /var/www/certbot
chown -R www-data:www-data /var/cache/nginx/charva

# из репозитория
cp deploy/nginx/charva.conf          /etc/nginx/sites-available/charva.conf
cp deploy/nginx/snippets/*.conf      /etc/nginx/snippets/
ln -sf /etc/nginx/sites-available/charva.conf /etc/nginx/sites-enabled/charva.conf
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx
```

**HSTS включается последним.** Строка `Strict-Transport-Security` в `charva-tls.conf` живёт два
года, и браузер, который её увидел, два года откажется ходить на любое имя `charva-travel.com`
по HTTP. Отменить это с сервера нельзя. Включать после того, как все пять хостов отдают
валидный TLS, — до тех пор строку закомментировать.

**Проверка:** `nginx -t` без ошибок. Сайты ещё не отвечают — кода на сервере пока нет.

---

## 7. Первая выкладка

С машины разработчика, из корня репозитория:

```bash
export DEPLOY_HOST=<ip>
export DEPLOY_USER=charva
./scripts/deploy.sh
```

Скрипт собирает локально (`pnpm verify` целиком), заливает только `dist`, ставит production-
зависимости на сервере, накатывает миграции, переключает симлинк, перезапускает PM2 и проверяет
`/health` — а при неудаче возвращает симлинк на предыдущий релиз.

**Собирает локально, а не на сервере, намеренно.** Четыре сборки Vite и tsup рядом с MySQL не
помещаются в память маленького VPS, а OOM-kill посреди сборки — это наполовину заменённый сайт.

### Скрипт откажется выкладывать

```
174 placeholder photographs are in the database (decision D-25).
```

Так и задумано. Все фотографии сейчас — временные с Викисклада; часть под CC BY, которая
требует указания автора, а сайт его не печатает. Вопрос Q-1. Для закрытого стенда — согласиться
явно:

```bash
ALLOW_PLACEHOLDER_MEDIA=yes ./scripts/deploy.sh
```

### База пустая — заполнить один раз

```bash
ssh charva@<ip> 'cd /opt/charva/current/apps/api && node dist/seed.js'
ssh charva@<ip> 'cd /opt/charva/current/apps/api && \
  node dist/create-admin.js --email=ВАША@ПОЧТА --name="Имя" --role=owner'
```

Пароль печатается один раз и нигде не хранится — только Argon2id-хешем. **Скопировать сразу.**

Аккаунты не сидируются никогда (D-79): сид, создающий владельца, — это известный пароль в
публичном репозитории.

### Автозапуск

```bash
ssh charva@<ip> 'pm2 startup systemd -u charva --hp /home/charva' # выполнить выданную строку от root
ssh charva@<ip> 'pm2 save'
```

**Проверка:** все пять хостов отвечают по HTTPS; `pm2 status` — `online`; в админку удаётся
войти.

---

## 8. Бэкап по расписанию

```bash
crontab -u charva -e
```

```cron
30 3 * * * /opt/charva/current/scripts/backup.sh >> /opt/charva/shared/logs/backup.log 2>&1
```

`scripts/` в релиз не попадает — скопировать `backup.sh` в `/opt/charva/shared/backup.sh` и
указать в cron его, чтобы путь не зависел от текущего релиза.

**Бэкап без `uploads/` — ложный бэкап.** `media.storage_key` хранит путь, а не байты (D-8):
дамп базы восстановит сайт, у которого каждая картинка — 404. Поэтому `backup.sh` кладёт в один
архив и дамп, и файлы, и `--verify` падает на архиве, где есть строки и нет файлов.

**Проверка — обязательная, и делается один раз руками:**

```bash
./scripts/backup.sh
./scripts/backup.sh --verify /opt/charva/backups/charva-<stamp>.tar.gz
```

Бэкап, который никогда не восстанавливали, — это не бэкап.

---

## 9. Логи и место на диске

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
```

Кеш ресайза (`uploads/.cache/`) растёт от каждой новой ширины и чистится безнаказанно — файлы
пересоздаются по запросу:

```cron
0 4 * * 0 find /opt/charva/shared/uploads/.cache -type f -atime +30 -delete
```

---

## Обычная выкладка

```bash
./scripts/deploy.sh
```

## Откат

```bash
./scripts/rollback.sh            # на предыдущий релиз
./scripts/rollback.sh 20260822-101500
```

Симлинк, а не пересборка. **Схему откат не трогает** — миграции forward-only. Пока они
аддитивные, старый релиз переживает новую схему: колонка, которую он не выбирает. Миграция,
которая что-то удаляет или переименовывает, это ломает, и такую пару «схема + код» нужно
раскладывать на две выкладки.

---

## Что ещё не сделано

| Что                       | Почему                                                      |
| ------------------------- | ----------------------------------------------------------- |
| Уведомление о заявках     | Q-11 — Telegram или SMTP не выбран; заявки видно в `/inbox` |
| Sentry                    | нужен DSN                                                   |
| Внешний uptime-чек        | `/health` есть, мониторинг снаружи не подключён             |
| Реальные фотографии       | Q-1 — 174 временных, D-25 блокирует прод                    |
| Лицензия Stolzl           | Q-2 — не проверена; в шрифте нет турецких `Ğ ğ İ` (Q-17)    |
| Контакты и номер лицензии | Q-12 — в базе заглушки, помеченные `unconfirmed`            |
