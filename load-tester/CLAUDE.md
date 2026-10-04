# CLAUDE.md

Общий стандарт курсов в ../CLAUDE.md, здесь только специфика load-tester.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Что это

Курс нагрузочного тестирования и мониторинга для новичка на GitHub Pages (https://distinguished-sre.github.io/learning/load-tester/, Jekyll 3.10, `baseurl: /learning`, сайт собирается из корня репозитория `learning`, курс лежит в `load-tester/`): Markdown-уроки, которые Jekyll собирает в сайт (`_layouts/`, `_includes/`, `assets/`). Главная курса в корне сайта, старый адрес `/course/` редиректит на неё. Дизайн и механика взяты из соседнего курса DevOps (папка `devops/` этого же репозитория) и адаптированы. `README.md` репозитория: сокращённая главная, цифры (уроки, часы, месяцы) правятся вместе с `_data/courses/load-tester.yml`.

Курс общий, для любого новичка. Никаких имён конкретных учеников, работодателей и историй «для кого написан» в текстах, коммитах и примерах.

## Команды

Проверки с `--course load-tester` и node-тесты (`COURSE=load-tester`, по умолчанию он) описаны в `../CLAUDE.md`, раздел «Команды».

```bash
# стенд «Магазин» (нужен Docker; на Mac автора Docker нет, стенд проверяет CI .github/workflows/stand.yml)
cd load-tester/project/shop && cp .env.example .env && docker compose --profile monitoring up -d --build --wait
```

`stand.yml` поднимает стенд на ubuntu-latest и гоняет эталонные тесты из `project/shop/examples/` при изменениях в `load-tester/project/shop/`. `quiz.yml` проверяет базу вопросов и логику тестов, собирает сайт, как Pages, и сверяет собранные страницы (`check_questions.py --course load-tester --site _site`); собранный сайт лежит артефактом `site`. `snippets.yml` проверяет синтаксис блоков кода в уроках (`python3 tools/check_snippets.py`).

## Структура курса

- `_data/courses/load-tester.yml`: **единственный источник порядка курса** (13 тем, 57 уроков): `topics[].{n, dir, title, subtitle, time, layer, project, lessons[].{id, slug, title, time}}`. Время темы равно сумме уроков. Новый урок без записи здесь недостижим.
- `<NN-тема>/index.md`: страница темы (`layout: topic`). `<NN-тема>/<NN-slug>.md`: урок, front matter `layout: lesson`, `title`, `topic` (число), `lesson` ("5.3"), `time`.
- `index.md`: главная курса (`layout: home`, `permalink: /`, `redirect_from: /course/`, тексты в `_layouts/home.html`). `schedule.md`: расписание по неделям. `ai.md`: страница «ИИ-помощник» (выбор нейросети, правила, промпт преподавателя).
- Ссылки только относительные на `.md`: в своей теме `03-dns.md`, в чужой `../05-docker/03-compose-shop.md`.
- Пользовательский прогресс в `localStorage` с префиксом `lt:`: на том же origin живёт курс DevOps. Тесты хранят попытки отдельно, в `lt-quiz:v1:<урок>` и `lt-quiz:v1:prep` (страница подготовки), и отметки прохождения не трогают.
- `interview.md` (`/learning/load-tester/interview.html`, ссылка в меню): «Подготовка к собеседованию». Устные вопросы, тесты в режиме изучения и проверка случайным блоком по теме или уроку. Данные берёт из `assets/questions/load-tester/topic-NN.json` (собирает `_includes/prep-data.json`), логика в `assets/js/prep.js`.

### Вопросы: специфика load-tester

Формат и правила банков в `../CLAUDE.md`, раздел «Единая база вопросов»; здесь свои банки `_data/questions/load-tester/`. В `open/` группы (`groups`) только в 13.4 и 13.5. Уроки 13.4 и 13.5 (пробные собеседования) держат банки по 30–40 вопросов для тренировки.

## Сюжет курса

Сквозной сюжет для `tools/theory-style.md`: ты на первой работе в команде интернет-магазина. Впереди большая распродажа, в прошлом году сайт на ней упал. Урок открывается ситуацией из этой истории (таблица ниже) и возвращается к ней в конце теории. Одна ситуация на урок, не сериал: урок понятен без предыдущей серии. Рассказ наставника про «Магазин» держится этого сюжета.

### Ситуации по темам

| Тема | Ситуация |
|---|---|
| 1 Linux | Первый день: выдали доступ к серверу и просят «посмотри логи» |
| 2 Веб | Жалоба «сайт долго открывается»: что происходит между кликом и страницей |
| 3 Git | «Тесты храним не на рабочем столе, а в репозитории»: заводишь perf-lab |
| 4 Python | Проверять сотни товаров руками долго и скучно: первый скрипт |
| 5 Docker | Нужна своя копия магазина, на которой можно ломать; «а у меня работало» |
| 6 API | Прежде чем нагружать, убедиться, что корзина и заказ вообще работают |
| 7 Наблюдаемость | В прошлом году упали и не знали почему: ставим приборы |
| 8 Теория | Менеджер спрашивает: «Выдержим распродажу?» Учимся отвечать цифрами |
| 9 Locust | Первый настоящий нагрузочный тест |
| 10 k6 | Проверка производительности перед каждым релизом |
| 11 Узкие места | Тест показал, что при тройной нагрузке всё встаёт: ищем где |
| 12 Процесс | План, цели по качеству, отчёт руководству |
| 13 Финал | Генеральная репетиция перед распродажей и собеседование |

Внутри темы каждый урок берёт свой кусок ситуации. Цифры сюжета не противоречат стенду `project/shop` (1000 пользователей, 10 000 товаров и т. д.).

## Сквозной проект «Магазин» (`project/shop/`)

Ученик не пишет сервис, он его тестирует, как тестировщик на работе. Свои тесты, сценарии, дашборды и отчёты ученик складывает в собственный репозиторий `~/perf-lab` (заводится в теме 3), стенд берёт из клона этого репозитория: `~/learning/load-tester/project/shop`.

- `shop`: FastAPI, порт 8000, `/healthz`, `/readyz`, `/metrics`, `/api/register`, `/api/login` (Bearer-токен в Redis), `/api/categories`, `/api/products[?category_id,q,page,size]`, `/api/products/{id}`, `/api/cart`, `/api/cart/items`, `/api/orders`. Пользователи `user0001@shop.lab`…`user1000@shop.lab`, пароль `password`; 10 000 товаров, 200 000 исторических заказов.
- Порты стенда на хосте привязаны к `127.0.0.1` (`BIND_ADDR` в `.env`; `0.0.0.0` только для доступа с другой машины, SSH-туннель безопаснее), PostgreSQL и Redis на хост не публикуются (`docker compose exec`). `POST /api/orders` забирает корзину атомарно (Redis MULTI). Гистограммы имеют корзину 0.3 (SLO каталога 300 мс). `python3 tools/check_snippets.py` проверяет синтаксис блоков кода в уроках (CI `snippets.yml`).
- `payment`: заглушка оплаты, порт 8001, `/pay`, `/admin/config` (задержка и доля ошибок на лету).
- PostgreSQL 5432 (`shop/shop/shop`, pg_stat_statements), Redis 6379. Профиль `monitoring`: Prometheus 9090, Alertmanager 9093, Grafana 3000, Loki 3100, Tempo 3200, Alloy 12345 (OTLP/HTTP 4318 внутри сети), node-exporter, cAdvisor, postgres-exporter.
- Метрики: `http_requests_total{method,route,status}`, `http_request_duration_seconds`, `http_requests_in_progress`, `shop_db_pool_{size,available,waiting}`, `shop_db_connection_wait_seconds`, `shop_cache_requests_total{result}`, `shop_orders_created_total`, `shop_payment_requests_total{result}`, `shop_payment_duration_seconds`. Логи JSON со `request_id` и `trace_id` (рядом, в таком порядке). Трейсы OpenTelemetry (SDK + автоинструментация FastAPI, httpx, psycopg, Redis; `traceparent` shop → payment, спан `db.pool.getconn`) идут OTLP/HTTP → Alloy → Tempo; в Grafana источник Tempo, из лога Loki переход по `trace_id` в трейс и обратно; `TRACING_ENABLED`, `OTEL_*`. Всем долгоживущим сервисам `restart: unless-stopped`.
- Заложенные узкие места (переменные в `.env`, список с починкой в `project/shop/README.md`): bcrypt-логин и один воркер (`BCRYPT_ROUNDS`, `WEB_CONCURRENCY`, урок 11.2), нет индекса `orders.user_id` и N+1 (`BUG_N_PLUS_ONE`, 11.3), маленький пул (`DB_POOL_MAX`, 11.3), утечка (`LEAK_ENABLED`, 11.4), кэш (`CACHE_ENABLED`) и оплата внутри транзакции с ретраями без паузы (`PAYMENT_TIMEOUT`, `PAYMENT_RETRIES`, 11.5).
- Нагрузку даём только на свой локальный стенд. В уроках прямо сказано, что нагружать чужие сайты нельзя.

При правке урока проверяй, что цепочка не рвётся: порты, пути, имена метрик и файлов совпадают с `project/shop` и предыдущими уроками. Меняешь проект: обнови README проекта, этот раздел и затронутые уроки.

## Версии

Закреплены явно, текст ссылается на 2026 год. Сейчас: Ubuntu 24.04/26.04, Python 3.12+ у ученика (образ сервиса `python:3.14.8-slim`), Locust 2.46, k6 2.3, pytest 9.1, PostgreSQL 18.6, Redis 8.10, Prometheus 3.15, Grafana 13.2, Loki 3.7, Alloy 1.20, Tempo 2.10, OpenTelemetry Python 1.45. Точные теги в `project/shop/compose.yaml` и `requirements.txt`; при обновлении сверяй уроки (`git grep`).
