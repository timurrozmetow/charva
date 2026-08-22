# Выкладка на VPS

Сверху вниз на чистой Ubuntu. Каждый шаг — команда, которую можно скопировать; каждый блок
заканчивается проверкой, по которой видно, что шаг удался.

Не Alpine: `sharp` и `@node-rs/argon2` собраны под glibc, а на musl падают при первом же
`require`.

---

## Машина, на которой это выполнено

Снято с сервера 2026-08-22, до первой команды. План писался под 24.04 и 2 ГБ — реальность
отличается в двух местах, и оба разбираются ниже, а не замалчиваются.

| Что     | Факт                                | Расхождение с планом                                |
| ------- | ----------------------------------- | --------------------------------------------------- |
| ОС      | **Ubuntu 26.04 LTS**, x86_64        | план писался под 24.04 — см. «Что изменилось»       |
| Ядер    | 2                                   | —                                                   |
| Память  | **956 МБ**, свопа не было           | план предполагал 2 ГБ — **это главное расхождение** |
| Диск    | 50 ГБ, свободно 44                  | —                                                   |
| Часовой | был `Europe/Prague`                 | обязан быть UTC, см. шаг 1                          |
| Хост    | `charva-travel.com`, 109.238.94.210 | —                                                   |

### Память — единственное, что здесь по-настоящему тесно

956 МБ на MySQL 8.4, Node и nginx — это работает, но без запаса. MySQL 8.4 «из коробки»
рассчитывает на машину покрупнее: одна только `performance_schema` берёт около 200 МБ, а
`innodb_buffer_pool_size` по умолчанию — 128 МБ сверх того. Node с `sharp` при обработке
загруженной фотографии выделяет в нативной куче, которую сборщик мусора не видит.

Сумма этого на 956 МБ без свопа — OOM-killer, и выбирает он обычно `mysqld`, потому что тот
крупнее всех. Сайт при этом не падает — он начинает отдавать 500 на каждый запрос к базе, что
выглядит как ошибка приложения и ищется совсем не там.

Поэтому **до установки MySQL**:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo "/swapfile none swap sw 0 0" >> /etc/fstab
printf "vm.swappiness=10
" > /etc/sysctl.d/99-charva.conf && sysctl --system
```

`swappiness=10`, а не значение по умолчанию: своп здесь — страховка от пика, а не рабочий
режим. База, которая живёт в свопе, медленнее базы, которой не хватает памяти.

Настройка самого MySQL под эту память — шаг 3.

### Что изменилось из-за 26.04

**Шаг с NodeSource не нужен.** В 26.04 всё есть в родных репозиториях, и версии те самые:

| Пакет        | Из репозитория 26.04 |
| ------------ | -------------------- |
| nodejs       | 22.22.1              |
| mysql-server | 8.4.10               |
| nginx        | 1.28.3               |
| certbot      | 4.0.0                |
| ffmpeg       | 8.0.1                |

Node 22 — ровно то, на что собран `tsup` (`target: node20`) и что стоит в CI.

**MySQL 8.4, а не 8.0.** Всё, на чём построена схема, там есть: `JSON_SCHEMA_VALID` (с 8.0.17),
`CHECK`, генерируемые колонки, оконные функции. Существенное отличие 8.4 — убран
`mysql_native_password`; драйвер `mysql2` работает через `caching_sha2_password`, который здесь
и используется по умолчанию.

**`/etc/sysctl.conf` в 26.04 нет** — вместо него каталог `/etc/sysctl.d/`.

---

## Что нужно до первой команды

| Что                                 | Зачем                                               | Статус                    |
| ----------------------------------- | --------------------------------------------------- | ------------------------- |
| VPS                                 | всё ниже                                            | есть, характеристики выше |
| Домен `charva-travel.com`           | пять поддоменов                                     | зарегистрирован, reg.ru   |
| **Шесть `A`-записей, разошедшихся** | HTTP-01 проверяет каждое имя отдельно — см. шаг 5.1 | сделать до выпуска        |
| Публичный ключ на сервере           | `deploy.sh` ходит по ключу, пароль не спрашивает    | положен, проверен         |

**Диск — второе, за чем стоит следить.** Видео хостится на этой же машине (D-8): 18 роликов
Global плюс по три на каждую группу паломников. При 720p это десятки гигабайт, а здесь свободно 44. `MAX_VIDEO_UPLOAD_MB=400` — верхняя граница одного файла, а не общего объёма. Следить:
`df -h /`.

---

## 1. Пользователь и базовая настройка

Всё работает от `charva`, не от root. Один процесс Node, доступный из интернета через nginx,
не должен иметь права переписать систему.

```bash
timedatectl set-timezone UTC

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y -o Dpkg::Options::=--force-confold upgrade
apt-get -y install curl git ufw fail2ban nginx mysql-server ffmpeg nodejs npm

adduser --disabled-password --gecos "" charva
mkdir -p /home/charva/.ssh && chmod 700 /home/charva/.ssh
cp /root/.ssh/authorized_keys /home/charva/.ssh/authorized_keys
chown -R charva:charva /home/charva/.ssh && chmod 600 /home/charva/.ssh/authorized_keys
```

**UTC — не косметика, и ставится первым.** `umrah_trips.depart_at` хранится в UTC, отсчёт на
трёх сайтах считается от него, а `parseSqlDate` дописывает `Z` к строке из MySQL. Сервер в
другом поясе сдвинет вылет на несколько часов, и заметит это первым паломник. Первым — потому
что MySQL при установке возьмёт часовой пояс системы, и менять его потом дороже.

`--force-confold` — чтобы обновление не остановилось на вопросе о файле конфигурации, которого
никто не правил.

```bash
ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw --force enable
```

MySQL и API слушают только `127.0.0.1`, поэтому 3306 и 3002 в правилах не нужны — и не должны
там появиться.

**Проверка:** `ssh charva@<ip>` пускает по ключу; `ufw status` показывает открытыми только 22,
80 и 443.

---

## 2. pnpm и PM2

Node пришёл из репозитория на предыдущем шаге — в 26.04 это 22.22, ровно то, на что собран
`tsup` и что стоит в CI. NodeSource не нужен.

```bash
corepack enable && corepack prepare pnpm@10 --activate
npm install -g pm2
```

**Проверка:** `node -v` → v22.x, `pnpm -v` → 10.x, `pm2 -v` отвечает.

---

## 3. База данных

MySQL 8.4 из репозитория 26.04. Всё, на чём построена схема, там есть: `JSON_SCHEMA_VALID`,
`CHECK`, генерируемые колонки, оконные функции.

```bash
mysql_secure_installation
```

### 3.1 Конфигурация — и корректность, и память

```bash
cp deploy/mysql/charva.cnf /etc/mysql/mysql.conf.d/99-charva.cnf
systemctl restart mysql
```

Файл лежит в репозитории и прокомментирован построчно. Две вещи из него стоит знать, не
открывая.

**`sql_mode` обязан совпадать с тем, против чего писались миграции и тесты.**
`STRICT_TRANS_TABLES` — причина, по которой слишком длинная строка не обрезается молча, а
`ONLY_FULL_GROUP_BY` ловит агрегат без группировки. Тесты доказывают, что правила держит база,
а не приложение; при другом `sql_mode` они доказывают что-то другое. Там же `utf8mb4` и
`default-time-zone = '+00:00'` — не `SYSTEM`, потому что унаследованный от системы пояс однажды
сменится при переносе машины и сдвинет дату вылета, а не сломает запрос.

**`performance_schema = OFF` — примерно 200 МБ.** На 956 МБ это соизмеримо со всем остальным
сервером. Это инструмент профилирования для базы, которую профилируют; эту не профилирует
никто. Плюс `innodb_buffer_pool_size = 128M` (весь контент — несколько сотен строк, влезает
целиком с запасом) и `max_connections = 50` вместо 151 — при `DATABASE_POOL_SIZE=10` и одном
инстансе (D-7) это пятикратный запас.

### 3.2 Схема и пользователь

```sql
CREATE DATABASE charva CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'charva'@'localhost' IDENTIFIED BY 'ПРИДУМАТЬ-И-СОХРАНИТЬ';
GRANT ALL PRIVILEGES ON charva.* TO 'charva'@'localhost';
FLUSH PRIVILEGES;
```

Права только на свою схему. Инъекция, дошедшая до драйвера, упирается тогда в границу базы, а
не читает всё, что есть на машине. `ALL PRIVILEGES` внутри неё нужны: миграции создают и
изменяют таблицы от этого же пользователя.

Пароль — в `DATABASE_URL` шага 4. Спецсимволы в нём придётся кодировать по правилам URL (`@`
как `%40`, `:` как `%3A`), поэтому проще взять пароль без них:
`node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"`.

**Проверка:**

```bash
mysql -e "SELECT @@sql_mode, @@character_set_server, @@time_zone, @@performance_schema"
mysql -e "SELECT @@innodb_buffer_pool_size/1024/1024 AS pool_mb, @@max_connections"
free -m
```

Строгий режим, utf8mb4, `+00:00`, `performance_schema` = 0. В `free -m` после запуска MySQL
должно оставаться не меньше 400 МБ доступной памяти — если меньше, дальше ставить нечего, и
разбираться надо здесь.

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

## 5. DNS и сертификат — HTTP-01, один сертификат на шесть имён

Выбрано владельцем: **без wildcard и без DNS API**. Обоснование простое и верное — wildcard
нужен, когда поддомены заводятся на ходу, а здесь их шесть и список закрыт: `charva-travel.com`,
`www`, `global`, `umra`, `admin`, `api`. Ради фиксированного списка держать API-доступ к зоне
незачем. Альтернативы записаны в конце раздела на случай, если поддомены когда-нибудь поедут.

Это **один** сертификат с шестью именами внутри (SAN), а не шесть сертификатов: одна lineage,
одно продление, одна пара файлов, на которую смотрят все пять server-блоков.

### 5.1 Записи в зоне reg.ru

`A` на IP сервера для каждого из шести имён. `CNAME` на апекс тоже работает, но `A` проще
отлаживать: `dig +short <имя>` должен вернуть IP сервера для всех шести.

**Это должно быть сделано и разойтись ДО следующего шага.** HTTP-01 проверяет каждое имя,
подключаясь к нему по DNS; имя, которое ещё не разошлось, даёт отказ по всему запросу — включая
те пять имён, которые уже были готовы.

```bash
for h in charva-travel.com www global umra admin api; do
  case $h in charva-travel.com) n=$h;; *) n=$h.charva-travel.com;; esac
  printf '%-28s %s
' "$n" "$(dig +short "$n" | tail -1)"
done
```

Шесть строк с одним и тем же IP — можно продолжать. Пустая строка хотя бы у одного — ждать.

### 5.2 Петля, на которой этот способ обычно и застревает

`charva.conf` подключает `charva-tls.conf`, а тот называет файлы сертификата. На чистой машине
их нет, поэтому `nginx -t` падает и nginx не стартует. А HTTP-01 работает так: Let's Encrypt
забирает файл по обычному HTTP с каждого из шести имён — **для чего нужен работающий nginx**.
Конфигу нужен сертификат, сертификату нужен конфиг.

Поэтому в репозитории лежит `deploy/nginx/charva-bootstrap.conf` — только 80-й порт, только
ответ на проверку и редирект. Включается первым, живёт двадцать минут, заменяется.

```bash
mkdir -p /var/www/certbot /etc/nginx/snippets
cp deploy/nginx/charva-bootstrap.conf /etc/nginx/sites-available/charva-bootstrap.conf
ln -sf /etc/nginx/sites-available/charva-bootstrap.conf /etc/nginx/sites-enabled/charva.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

**Проверка перед выпуском — обязательная.** Она стоит одну минуту и снимает почти все причины
отказа ACME:

```bash
echo ok > /var/www/certbot/.well-known/acme-challenge/probe 2>/dev/null   || (mkdir -p /var/www/certbot/.well-known/acme-challenge && echo ok > /var/www/certbot/.well-known/acme-challenge/probe)

for h in charva-travel.com www.charva-travel.com global.charva-travel.com          umra.charva-travel.com admin.charva-travel.com api.charva-travel.com; do
  printf '%-28s %s
' "$h" "$(curl -s -m 10 "http://$h/.well-known/acme-challenge/probe")"
done
rm -f /var/www/certbot/.well-known/acme-challenge/probe
```

Шесть раз `ok` — можно выпускать. Что-то другое хотя бы у одного имени — сначала чинить это:
Let's Encrypt увидит ровно то же самое.

### 5.3 Выпуск

```bash
apt install -y certbot
certbot certonly --webroot -w /var/www/certbot   -d charva-travel.com -d www.charva-travel.com   -d global.charva-travel.com -d umra.charva-travel.com   -d admin.charva-travel.com -d api.charva-travel.com   --agree-tos -m ПОЧТА --non-interactive
```

**`certonly --webroot`, а не `--nginx`.** Плагин `--nginx` правит конфигурацию сам: дописывает
`ssl_certificate` в найденные им server-блоки и меняет то, что вокруг. Наш конфиг собран из
сниппетов и рассчитывает на конкретную структуру; переписанный автоматикой, он перестанет быть
тем, что лежит в репозитории, и следующий `cp` из репозитория молча вернёт всё назад. `certonly`
кладёт файлы и не трогает ничего.

Первое имя в списке задаёт имя lineage — `/etc/letsencrypt/live/charva-travel.com/`. Именно этот
путь прописан в `snippets/charva-tls.conf`, поэтому `charva-travel.com` идёт первым.

**Продление уже настроено.** Пакет certbot ставит systemd-таймер; проверить —
`systemctl list-timers | grep certbot`. Нужен только перезапуск nginx после обновления:

```bash
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh
systemctl reload nginx
' > /etc/letsencrypt/renewal-hooks/deploy/nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/nginx.sh
```

Без этого сертификат обновится, а nginx на девяносто дней останется с прежним — и истечёт он
уже по-настоящему.

**Проверка:**

```bash
certbot certificates                # шесть имён в одной lineage
certbot renew --dry-run             # проходит целиком
```

### Цена решения — записать, чтобы потом не удивляться

Новый поддомен **не появится сам**: `certbot certonly` нужно вызвать заново со всеми шестью
именами плюс новым, иначе он заведёт вторую lineage и второй каталог, на который никто не
смотрит. И `/.well-known/acme-challenge/` обязан оставаться доступным по HTTP — в `charva.conf`
он специально исключён из общего редиректа на HTTPS, эту строку трогать нельзя.

### Если поддомены когда-нибудь станут динамическими

Тогда нужен wildcard, а он выдаётся **только** через DNS-01 — это ограничение ACME, а не
настройки. Официального плагина certbot под reg.ru нет; рабочих путей два.

**acme.sh с `dns_regru`** — поддержка внутри самого проекта, домен остаётся на reg.ru. Две
ловушки: в кабинете reg.ru нужно включить API **и добавить IP сервера в белый список** (иначе
отказ выглядит как неверный пароль), а зона расходится медленно, так что нужен `--dnssleep 120`
(иначе Let's Encrypt проверит запись раньше, чем она появится, и это выглядит как неправильный
токен).

**DNS на Cloudflare**, регистратор остаётся reg.ru — меняются только NS, дальше официальный
`certbot-dns-cloudflare` и токен с правом `Zone:DNS:Edit`. Ценой ещё одного стороннего сервиса
на пути к сайту.

Учесть в обоих случаях: `*.charva-travel.com` **не покрывает сам `charva-travel.com`** — в
сертификате должны быть оба имени.

---

## 6. nginx — полный конфиг вместо загрузочного

Сертификат есть, значит `charva-tls.conf` теперь ссылается на существующие файлы и полный
конфиг наконец пройдёт проверку.

```bash
mkdir -p /var/cache/nginx/charva
chown -R www-data:www-data /var/cache/nginx/charva

cp deploy/nginx/charva.conf     /etc/nginx/sites-available/charva.conf
cp deploy/nginx/snippets/*.conf /etc/nginx/snippets/

# Симлинк перевешивается с загрузочного конфига на полный. Сам bootstrap остаётся в
# sites-available — он понадобится, если сертификат когда-нибудь придётся выпускать заново
# на машине, где nginx уже не стартует без него.
ln -sf /etc/nginx/sites-available/charva.conf /etc/nginx/sites-enabled/charva.conf

nginx -t && systemctl reload nginx
```

`nginx -t` упал на `charva-tls.conf` — сертификата нет там, где его ждут. Вернуться к шагу 5:
`certbot certificates` покажет, где lineage на самом деле, и её имя должно быть
`charva-travel.com`.

**HSTS включается последним, и это не осторожность, а необратимость.** Строка
`Strict-Transport-Security` в `charva-tls.conf` действует два года: браузер, который её увидел,
два года откажется ходить на любое имя `charva-travel.com` по HTTP — и отменить это с сервера
нельзя, потому что отменяющий заголовок пришлось бы отдать по тому самому HTTP, на который
браузер уже не пойдёт. Включать после того, как все пять хостов отдают валидный TLS; до тех пор
строку закомментировать.

**Проверка:** `nginx -t` без ошибок; `curl -I https://api.charva-travel.com/api/v1/health`
отвечает по TLS. Остальные хосты пока отдают 502 — кода на сервере ещё нет, это следующий шаг.

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
