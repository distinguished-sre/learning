# Учебный проект «Магазин»

Это чужой сервис, который нужно исследовать как тестировщику: проверить API,
создать нагрузку, сопоставить метрики и логи, найти причину замедления и проверить исправление.
Исходники доступны для темы «Поиск узких мест». В `examples/` лежат эталонные решения;
сначала попробуйте написать свои.

## Запуск

Нужны Docker Engine с Compose v2 или Docker Desktop, свободные порты из таблицы ниже
и примерно 4 ГБ памяти для полного стенда. Все команды выполняются из `project/shop/`.

```bash
cp .env.example .env
# Только API, оплата, PostgreSQL и Redis:
docker compose up -d --build --wait --wait-timeout 300
# Или весь стенд с наблюдением:
docker compose --profile monitoring up -d --build --wait --wait-timeout 300
curl http://localhost:8000/readyz
```

При первом запуске PostgreSQL создаёт 20 категорий, 10 000 товаров, 1000 пользователей,
200 000 исторических заказов и примерно 400 000 позиций. Инициализация рассчитана
примерно на 30 секунд; время зависит от диска и CPU. Healthcheck PostgreSQL ждёт
завершения сида. SQL-файлы выполняются только на пустом томе.

| Сервис | Адрес / порт хоста |
| --- | --- |
| Магазин, Swagger | http://localhost:8000/docs |
| Оплата | http://localhost:8001 |
| PostgreSQL | localhost:5432, база/пользователь/пароль `shop` |
| Redis | localhost:6379 |
| Prometheus | http://localhost:9090 |
| Alertmanager | http://localhost:9093 |
| Grafana | http://localhost:3000 |
| Loki | http://localhost:3100 |
| Tempo (трейсы, API поиска) | http://localhost:3200, смотреть в Grafana: Explore → Tempo |
| Alloy | http://localhost:12345 (внутри сети Compose также OTLP/HTTP `alloy:4318`) |

Реквизиты стенда открытые, Grafana разрешает анонимному пользователю роль Admin,
а конфигурация оплаты меняется без авторизации. Запускайте стенд на своей учебной машине.
На Docker Desktop node-exporter и cAdvisor наблюдают Linux-VM Docker.

```bash
# Смотреть ошибки и жизненный цикл сервисов:
docker compose --profile monitoring logs -f shop payment postgres
# Остановить, сохранив данные PostgreSQL и мониторинга:
docker compose --profile monitoring down
# Полностью сбросить стенд, включая ВСЕ заказы и сохранённые графики:
docker compose --profile monitoring down -v
```

Все долгоживущие сервисы имеют `restart: unless-stopped`: упавший или убитый по памяти
(OOM) контейнер Docker поднимает сам, а после `docker compose stop` или `down` он остаётся
остановленным. Число перезапусков: `docker inspect -f '{{.RestartCount}} {{.State.OOMKilled}}' shop-shop-1`
(имя контейнера смотрите в `docker compose ps`). После рестарта shop его счётчики Prometheus
начинаются с нуля, а `depends_on` заново не проверяется.

Redis не имеет постоянного тома: сессии, корзины и кеш могут исчезнуть при пересоздании
контейнера. Изменение `.env` применяется после `docker compose up -d`; для изменения
Python-кода добавьте `--build`. При рестарте shop каталог multiprocess-метрик очищается.

## Первый запрос

У пользователей `user0001@shop.lab` … `user1000@shop.lab` пароль `password`.
Цена указана в условных денежных единицах; значения `price` и `total` — JSON-числа.

```bash
TOKEN=$(curl -fsS http://localhost:8000/api/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user0001@shop.lab","password":"password"}' | jq -r .token)
curl -fsS http://localhost:8000/api/products
curl -fsS http://localhost:8000/api/cart/items \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"product_id":1,"qty":2}'
curl -fsS -X POST http://localhost:8000/api/orders -H "Authorization: Bearer $TOKEN"
```

При ошибке API возвращает `{"detail": ...}`. Авторизация — `Authorization: Bearer <token>`;
сессии хранятся в Redis с TTL. Регистрация принимает email и пароль от 8 символов
до 72 байт UTF-8. Вход принимает пароль от 1 символа до 72 байт. После успешного входа
хеш обновляется, если его стоимость отличается от `BCRYPT_ROUNDS`.

## Эндпоинты магазина

| Метод и путь | Назначение и ответы |
| --- | --- |
| `GET /healthz` | 200 `{"status":"ok"}`, без проверки зависимостей |
| `GET /readyz` | `SELECT 1` и Redis PING: 200 ready либо 503 со списком недоступных сервисов |
| `GET /metrics` | Метрики Prometheus всех воркеров |
| `POST /api/register` | `{email,password}` → 201 `{id,email}`; 409 занят email, 422 неверные данные |
| `POST /api/login` | `{email,password}` → 200 `{token,expires_in}`; 401 неверные данные |
| `GET /api/categories` | Список `{id,name}` |
| `GET /api/products` | Фильтры `category_id`, `q`, `page=1`, `size=20` (1…100); `{items,page,size,total}` |
| `GET /api/products/{id}` | `{id,name,price,category_id,stock}`; 404 нет товара |
| `GET /api/cart` | Авторизация; `{items:[{product_id,name,price,qty}],total}` |
| `POST /api/cart/items` | Авторизация; `{product_id,qty}` с qty ≥ 1 → 201 корзина; количество прибавляется; 404/422 |
| `DELETE /api/cart/items/{product_id}` | Авторизация; 204, даже если позиции уже нет |
| `POST /api/orders` | Авторизация; 201 `{id,status,total,items}`; 400 пустая корзина, 409 мало товара, 502 отказ оплаты, 504 таймаут |
| `GET /api/orders` | Авторизация; последние 20 своих заказов с позициями |
| `GET /api/orders/{id}` | Авторизация; свой заказ с позициями либо 404, включая чужой заказ |

Заказ резервирует товары через `FOR UPDATE`, сохраняет позиции и уменьшает остаток
в одной транзакции. Ошибка оплаты откатывает все SQL-изменения и оставляет корзину.
Успех очищает корзину и инвалидирует кеш купленных карточек. Цены и количество
в исторических заказах не меняются вместе с каталогом.

Корзина общая для всех сессий одного пользователя. Параллельные действия одного
пользователя и повторная отправка заказа не имеют защиты от дублирования;
для независимых тестов регистрируйте разных пользователей.

## Оплата

`POST http://localhost:8001/pay` принимает `{order_id,amount}`, возвращает 200
`{status:"paid",order_id}` или 500. Задержка имеет случайный разброс ±20%.
`GET /healthz`, `GET /metrics`, `GET /admin/config` доступны без авторизации.

```bash
# Медленная и нестабильная зависимость, без перезапуска:
curl -fsS http://localhost:8001/admin/config -H 'Content-Type: application/json' \
  -d '{"delay_ms":2000,"fail_rate":0.3}'
# Вернуть нормальную оплату:
curl -fsS http://localhost:8001/admin/config -H 'Content-Type: application/json' \
  -d '{"delay_ms":50,"fail_rate":0}'
```

Можно передать только одно поле. Изменения действуют до пересоздания payment;
исходные значения задаются в `.env`.

## Переменные `.env`

| Переменная | По умолчанию | Назначение |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://shop:shop@postgres:5432/shop` | Подключение к PostgreSQL |
| `REDIS_URL` | `redis://redis:6379/0` | Корзины, сессии, кеш |
| `PAYMENT_URL` | `http://payment:8001` | Адрес оплаты внутри сети Compose |
| `WEB_CONCURRENCY` | `1` | Воркеры Uvicorn |
| `DB_POOL_MIN` / `DB_POOL_MAX` | `1` / `5` | Размер пула каждого воркера |
| `DB_POOL_TIMEOUT` | `5` | Ожидание соединения, секунды |
| `BCRYPT_ROUNDS` | `12` | Стоимость проверки и создания хеша |
| `CACHE_ENABLED` / `CACHE_TTL` | `0` / `60` | Кеш карточек и TTL, секунды |
| `BUG_N_PLUS_ONE` | `1` | Отдельный запрос позиций для каждого заказа |
| `LEAK_ENABLED` | `0` | Неограниченное накопление памяти |
| `PAYMENT_TIMEOUT` | `10` | Таймаут одной попытки оплаты, секунды |
| `PAYMENT_RETRIES` | `3` | Повторы после первой попытки, всего максимум 4 |
| `SESSION_TTL` | `3600` | Срок действия токена, секунды |
| `LOG_LEVEL` | `INFO` | Уровень логов |
| `PAYMENT_DELAY_MS` | `50` | Задержка оплаты, миллисекунды |
| `PAYMENT_FAIL_RATE` | `0.0` | Вероятность отказа оплаты, 0…1 |
| `PROMETHEUS_MULTIPROC_DIR` | `/tmp/shop-metrics` | Каталог внутри shop, не общий между контейнерами |
| `TRACING_ENABLED` | `1` | Трейсы OpenTelemetry в shop и payment; `0` выключает полностью |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://alloy:4318` | Куда shop и payment шлют спаны (OTLP/HTTP) |
| `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG` | `parentbased_always_on` / `1.0` | Сэмплирование: все трейсы или `parentbased_traceidratio` с долей в ARG |

`max_connections=100` ограничивает PostgreSQL целиком; оставьте место для экспортера,
ручных запросов и фоновых процессов. Multiprocess-метрики суммируют gauges всех живых
воркеров. Размер/доступность/очередь пула обновляются каждую секунду и при выдаче/возврате
соединения. Гистограмма ожидания включает неудачные попытки получить соединение.

## Метрики и логи

Grafana автоматически получает дашборд «Магазин: обзор (эталон)» и источники Prometheus,
Loki, Tempo, Alertmanager. Он показывает RPS по шаблонам маршрутов, долю 5xx, p50/p95/p99,
запросы в работе, пул и ожидание БД, CPU/память shop, соединения PostgreSQL и задержку оплаты.
В запросах дашборда окно `[$__rate_interval]`, а не фиксированное `[1m]`.

Метрики магазина: `http_requests_total{method,route,status}`,
`http_request_duration_seconds{method,route}`, `http_requests_in_progress`,
`shop_db_pool_size`, `shop_db_pool_available`, `shop_db_pool_waiting`,
`shop_db_connection_wait_seconds`, `shop_cache_requests_total{result="hit|miss"}`,
`shop_orders_created_total`, `shop_payment_requests_total{result="ok|error|timeout"}`,
`shop_payment_duration_seconds`. Длительности — гистограммы (серии `_bucket`, `_sum`, `_count`).
`/healthz`, `/readyz`, `/metrics` не входят в HTTP-метрики. Неизвестные пути имеют route `other`.
Некоторые серии с метками появляются только после первого соответствующего события.

Метрики payment: `payment_requests_total{status}`, `payment_duration_seconds`.
Prometheus принимает k6 remote write по `/api/v1/write`.

Каждый запрос shop оставляет JSON-строку в stdout: время ISO8601, уровень, сообщение,
метод, шаблон маршрута, путь, статус, длительность в миллисекундах, request_id и user_id
при авторизации. `X-Request-ID` принимается из запроса или генерируется и возвращается
в ответе. 5xx записываются как ERROR с ошибкой, запросы дольше секунды — WARNING.
В Grafana Explore выберите Loki и запрос `{service="shop"}` или
`{service="shop",level="ERROR"}`. Alloy добавляет service и container из метаданных Docker.

## Трейсы

shop и payment отправляют трейсы через OpenTelemetry SDK (пакеты закреплены в `requirements.txt`):
спан входящего HTTP-запроса, спаны SQL-запросов к PostgreSQL и команд Redis, спан ожидания
соединения из пула `db.pool.getconn` и спан каждой попытки исходящего вызова в payment.
Заголовок `traceparent` передаёт контекст от shop к payment, поэтому оплата попадает в тот же
трейс. `/healthz`, `/readyz` и `/metrics` не трассируются. В JSON-логе shop рядом с
`request_id` лежит `trace_id` (32 hex-символа).

Путь спанов: shop/payment, затем Alloy (`otelcol.receiver.otlp`, порт 4318), затем Tempo
(OTLP gRPC `tempo:4317`, хранение на диске в томе `tempo`, срок 24 часа). Спаны уходят
пакетами в отдельном потоке: если профиль `monitoring` не запущен, сервисы работают как
обычно, лишние спаны отбрасываются, ошибки экспорта в лог не пишутся (`OTEL_LOG_LEVEL=INFO`
вернёт их). Grafana получает источник Tempo; из строки лога Loki поле `trace_id` ведёт
в трейс, из спана есть переход в логи shop с тем же `trace_id`.

```bash
# Поиск трейсов через API Tempo (TraceQL): запросы к payment после нагрузки.
curl -sG http://localhost:3200/api/search --data-urlencode 'q={ resource.service.name = "payment" }' | jq '.traces[0]'
```

Prometheus не скрейпит Tempo, цели `up` остаются восемью. Трейсы стоят CPU: для тестов с
высоким RPS уменьшите долю (`OTEL_TRACES_SAMPLER=parentbased_traceidratio`,
`OTEL_TRACES_SAMPLER_ARG=0.1`) или выключите (`TRACING_ENABLED=0`) и пересоздайте сервисы.

Алерты видны в UI Alertmanager. `rules/alerts.yml`: недоступность shop, 5xx > 5%, p95 > 1 секунды,
очередь в пуле, CPU хоста > 90%, `ExporterDown` (молчит экспортёр) и `ShopNoTraffic` (трафик был
и пропал). В каждом алерте есть аннотация `runbook_url`. `rules/slo.yml`: recording rules
`sli:http_error_ratio:rate{5m,30m,1h,6h}` и `sli:catalog_slow_ratio:rate{...}` и четыре
multiwindow burn-rate алерта по SLO из урока 8.4 (14.4 на окнах 1h и 5m, 6 на окнах 6h и 30m).
Внешние уведомления не настроены. Контейнер, убитый по памяти, Docker поднимает сам за 10-20
секунд: `ShopDown` (`for: 1m`) может не успеть сработать, смотрите `RestartCount` и `docker events`.

## Эталонные проверки

Нужен Python 3.12+ на хосте (сервисы используют Python 3.14.8).

```bash
python -m venv .venv
. .venv/bin/activate
pip install -r examples/api-tests/requirements.txt locust==2.46.6
BASE_URL=http://localhost:8000 python -m pytest examples/api-tests -v
locust -f examples/locust/locustfile.py --host http://localhost:8000
# UI Locust: http://localhost:8089; или минутный запуск без UI:
locust -f examples/locust/locustfile.py --host http://localhost:8000 \
  --headless -u 20 -r 5 -t 60s --csv locust-result
```

Тесты чтения используют user0001; изменяющие тесты создают отдельных пользователей
и не зависят от порядка запуска. Locust выбирает случайного пользователя, распределяет
вес задач 6/3/2/1/1 и считает пустую корзину штатным отказом оформления.

```bash
# Linux; для Docker Desktop замените localhost на host.docker.internal
# в BASE_URL и K6_PROMETHEUS_RW_SERVER_URL, уберите --network host.
docker run --rm --network host -v "$PWD/examples/k6:/scripts:ro" \
  -e BASE_URL=http://localhost:8000 -e RATE=20 -e DURATION=2m \
  -e K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write \
  grafana/k6:2.3.0 run -o experimental-prometheus-rw /scripts/shop.js
```

k6 начинает 20 итераций в секунду, выделяет 20…100 VU и кеширует токен внутри каждого VU.
Пороги: ошибки < 1%, p95 < 500 мс и успешные checks > 99%. Пороги намеренно могут
не выполняться на базовом стенде при большой нагрузке: это отправная точка оптимизации.
CI использует 2 итерации/с в течение 60 секунд.

## Для авторов курса

Заложенные узкие места и способы эксперимента:

| Узкое место | Как проявить | Как исправить / проверить |
| --- | --- | --- |
| Нет индекса `orders.user_id` | Часто вызывать `/api/orders`, посмотреть EXPLAIN и pg_stat_statements | В уроке 11.3 добавить индекс, сравнить план и длительность |
| N+1 позиций заказов | `BUG_N_PLUS_ONE=1`, запросы `/api/orders` | `BUG_N_PLUS_ONE=0`, сравнить число SQL-вызовов |
| Дорогой bcrypt и один CPU | Много входов, `BCRYPT_ROUNDS=12`, `WEB_CONCURRENCY=1` | Сравнить rounds 4/12 в лаборатории и несколько воркеров; меньшая стоимость ослабляет защиту пароля |
| Нет кеша карточек | Повторять чтение одного товара, `CACHE_ENABLED=0` | `CACHE_ENABLED=1`; наблюдать hit/miss и нагрузку БД |
| Оплата держит соединение и блокировки | `/admin/config` с delay_ms 2000…5000, параллельные заказы | Перенести сетевую оплату за пределы транзакции; ввести pending/paid, идемпотентность и обработку отказов |
| Шторм повторов | fail_rate 1, `PAYMENT_RETRIES=3` | Уменьшить timeout/число повторов, добавить backoff с jitter и ограничение повторов |
| Малый пул БД | Медленная оплата, `DB_POOL_MAX=5` | Сначала убрать удержание соединений сетью, затем подобрать пул по измерениям |
| Утечка ~10 КБ на запрос | `LEAK_ENABLED=1`, длительный soak-тест | `LEAK_ENABLED=0` и пересоздать shop, сравнить память cAdvisor |
| Поиск `ILIKE '%q%'` | Частые запросы с q, EXPLAIN | Обсудить pg_trgm/GIN и цену поддержки индекса |

```bash
# Исходный план: Seq Scan по orders (возможен внутри Parallel-плана).
docker compose exec -T postgres psql -U shop -d shop -c \
  'EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM orders WHERE user_id = 1 ORDER BY created_at DESC, id DESC LIMIT 20;'
# Исправление для урока 11.3 (в базовый seed не включать):
docker compose exec -T postgres psql -U shop -d shop -c \
  'CREATE INDEX orders_user_id_idx ON orders(user_id); ANALYZE orders;'
# Счётчик и длительность SQL после нагрузки:
docker compose exec -T postgres psql -U shop -d shop -c \
  'SELECT calls, total_exec_time, mean_exec_time, query FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;'
```

Первый логин после смены bcrypt rounds включает перехеширование. Для чистого сравнения
сначала прогрейте входы выбранных пользователей. Исторические заказы нужны и для N+1,
и для полного сканирования таблицы; свежие заказы получают текущую дату.
Кеш карточек инвалидируется при заказе; ручные SQL-изменения могут быть видны только
после TTL. Базовая реализация кеша не защищает от гонки чтения и инвалидации.

CI `.github/workflows/stand.yml` поднимает весь стенд, запускает API/Locust/k6,
проверяет восемь scrape targets, HTTP RPS, метрики k6, логи в Loki, трейс с обоими
сервисами в Tempo, `trace_id` в логах, политику `restart`, Grafana,
Alertmanager и наличие Seq Scan. Он всегда удаляет тома после проверки.
После учебного исправления индекса такая проверка плана закономерно перестанет проходить:
измените ожидание CI в своей учебной ветке.
