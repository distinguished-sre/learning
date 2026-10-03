---
layout: default
title: Проверка визуальных объяснений
sitemap: false
---

# Проверка визуальных объяснений

Это демонстрация для авторов уроков. Переключи тему оформления, проверь узкое окно и настройку «уменьшить движение». Данные и задержки здесь синтетические. Каждый виджет сам начинает с заданных значений, под ним есть блок «Что сейчас происходит» и строка «Попробуй».

Атрибуты со списками (`data-x`, `data-only`) пишутся через запятую. `data-series` и `data-steps` содержат JSON в одинарных кавычках, апострофов внутри быть не должно. Время задаётся в миллисекундах, если не сказано иное.

## Путь запроса

Атрибуты: `data-net` (мс сети в одну сторону), `data-app` (мс работы магазина), `data-db` (мс базы).

<div class="viz" data-viz="request-path" data-net="5" data-app="4" data-db="10"></div>

## Очередь у кассы

Атрибуты: `data-servers` (число касс, 1–6), `data-rate` (покупателей в минуту), `data-service` (секунд на одного покупателя).

<div class="viz" data-viz="queue" data-servers="2" data-rate="30" data-service="3"></div>

## Перцентили

Атрибуты: `data-slow` (сколько из 100 запросов тормозят, 0–30), `data-slow-ms` (сколько длится тормозящий запрос, 200–3000). Старое имя `latency-hist` работает как псевдоним.

<div class="viz" data-viz="percentiles" data-slow="5" data-slow-ms="1500"></div>

## Запас до предела

Атрибуты: `data-capacity` (предел, запросов в секунду), `data-base` (мс работы без очереди), `data-load` (стартовая нагрузка), `data-unit` (единица нагрузки).

<div class="viz" data-viz="hockey-stick" data-capacity="100" data-base="20" data-load="50" data-unit="RPS"></div>

## Профили нагрузки

Без атрибутов показаны все профили:

<div class="viz" data-viz="load-profiles"></div>

`data-only` оставляет только нужные:

<div class="viz" data-viz="load-profiles" data-only="stress,spike"></div>

## Пул соединений

Атрибуты: `data-size` (размер пула), `data-duration` (мс на один запрос), `data-rate` (запросов в секунду), `data-timeout` (мс ожидания свободного слота).

<div class="viz" data-viz="pool" data-size="4" data-duration="400" data-rate="10" data-timeout="1500"></div>

## Линейный график

Атрибуты: `data-type`, `data-x`, `data-series` (JSON, у серии можно задать свой `"unit"`), `data-x-label`, `data-y-label`, `data-unit`, `data-title`, `data-explain` (текст под графиком). Наведение на точку показывает значение, клик по легенде скрывает серию.

<div class="viz" data-viz="chart" data-type="line" data-x="10,25,50,75,95" data-series='[{"name":"p95","values":[40,55,90,180,800]},{"name":"p50","values":[20,25,35,60,200]}]' data-x-label="Нагрузка, RPS" data-y-label="Задержка" data-unit="мс" data-explain="Чем ближе к пределу, тем быстрее растёт p95 и тем медленнее p50."></div>

## Столбчатый график

<div class="viz" data-viz="chart" data-type="bar" data-x="До,После" data-series='[{"name":"p95","values":[900,120]},{"name":"p99","values":[1500,200]}]' data-x-label="Индекс в PostgreSQL" data-y-label="Задержка" data-unit="мс"></div>

## Алгоритм диагностики

`data-steps`: массив строк или объектов `{"title": "коротко", "text": "подробности"}`. Обратные кавычки в тексте становятся кодом.

<div class="viz" data-viz="flow" data-steps='[{"title":"Заметь рост p95","text":"На графике по `route` видно, какой маршрут ушёл вверх."},{"title":"Проверь CPU и базу","text":"Сервис занят сам или ждёт?"},{"title":"Выдвини гипотезу","text":"Одну, которую можно проверить."},{"title":"Повтори тест","text":"С теми же параметрами."},{"title":"Сравни результаты","text":"До и после, по одним графикам."}]'></div>

## Mermaid: путь запроса

Блок с языком `mermaid` лениво загружает библиотеку. Без таких блоков библиотека не запрашивается.

```mermaid
flowchart LR
    A[Покупатель] --> B[Магазин]
    B --> C[(PostgreSQL)]
    B --> D[(Redis)]
    B --> E[Заглушка оплаты]
    C --> F[Метрики и логи]
    F --> G[Вывод об узком месте]
```

## Mermaid: последовательность

```mermaid
sequenceDiagram
    participant B as Браузер
    participant S as Магазин
    participant P as PostgreSQL
    B->>S: POST /api/orders
    S->>P: Сохранить заказ
    P-->>S: Заказ создан
    S-->>B: 201 Created
```

## Виджеты тем

Эти виджеты лежат в `assets/js/viz/<папка-темы>.js` и подключаются на всех страницах автоматически.

### Тема 1: Linux

Конвейер команд:

<div class="viz" data-viz="linux-pipeline"></div>

Load average и ядра (`data-cores`, `data-load`):

<div class="viz" data-viz="linux-load-average" data-cores="4" data-load="6"></div>

Из чего складывается время запроса (`data-dns`, `data-rtt`, `data-server` в мс):

<div class="viz" data-viz="linux-net-timeline" data-dns="30" data-rtt="40" data-server="80"></div>

### Тема 2: как устроен веб-сервис

Обмен запросом и ответом (`data-set`: `http`, `auth` или `all`):

<div class="viz" data-viz="web-http-exchange" data-set="http"></div>

Поиск с индексом и без (`data-rows`: строк в таблице, `data-matches`: подходящих):

<div class="viz" data-viz="web-index-search" data-rows="200000" data-matches="200"></div>

### Тема 4: Python

Пошаговое выполнение кода (`data-code`: JSON-массив строк, `data-steps`: JSON `[{l,v,o,n,f}]`, рабочие примеры в уроках 4.2 и 4.4). Индексы и срезы:

<div class="viz" data-viz="py-index" data-mode="list" data-name="times" data-items='[120,95,310,88,140]' data-index="2" data-start="1" data-stop="4"></div>

Новое соединение на каждый запрос против Session (`data-requests`, `data-connect`, `data-work` в мс):

<div class="viz" data-viz="py-session-compare" data-requests="8" data-connect="15" data-work="25"></div>

Веса задач (`data-users`, `data-weights` в JSON):

<div class="viz" data-viz="py-task-weights" data-users="3" data-weights='{"catalog":6,"product":3,"cart":2,"order":1}'></div>

### Тема 5: Docker

Жизненный цикл контейнера (`data-image`, `data-name`, `data-volume`):

<div class="viz" data-viz="dk-lifecycle" data-image="nginx:stable-alpine" data-name="web" data-volume="1"></div>

Слои и кэш сборки (`data-change`: `none`, `app`, `requirements` или `base`; `data-order`: `good` или `bad`):

<div class="viz" data-viz="dk-layers" data-change="app" data-order="good"></div>

Порядок запуска и healthcheck (`data-seed`, `data-condition`):

<div class="viz" data-viz="dk-startup" data-seed="30" data-condition="1"></div>

Лимиты CPU и памяти (`data-rps`, `data-cpus`, `data-mem`, `data-leak`, `data-restart`):

<div class="viz" data-viz="dk-limits" data-rps="200" data-cpus="1" data-mem="512" data-leak="1" data-restart="0"></div>

### Тема 6: автотесты API

Граничные значения параметра (`data-param`: `size` или `page`, `data-value`):

<div class="viz" data-viz="api-test-boundary" data-param="size" data-value="40"></div>

Пирамида тестов (`data-unit`, `data-api`, `data-ui`):

<div class="viz" data-viz="api-test-pyramid" data-unit="200" data-api="60" data-ui="8"></div>

Отчёт pytest о падении (`data-fail`: `ok`, `limit`, `auth`, `schema` или `order`):

<div class="viz" data-viz="api-test-report" data-fail="auth"></div>

Тесты в CI (`data-fail`: `ok`, `stand`, `test` или `yaml`):

<div class="viz" data-viz="api-test-ci" data-fail="ok"></div>

### Тема 7: метрики и Prometheus

Сбор метрик (`data-interval`: секунд между опросами):

<div class="viz" data-viz="obs-scrape" data-interval="15"></div>

Счётчик и `rate` (`data-window`: окно в секундах):

<div class="viz" data-viz="obs-rate" data-window="30"></div>

Перцентиль по бакетам гистограммы (`data-slow`: медленных из 100, `data-q`: перцентиль):

<div class="viz" data-viz="obs-quantile" data-slow="5" data-q="95"></div>

Дашборд RED во время теста (`data-scenario`: `ok`, `pool` или `payment`):

<div class="viz" data-viz="obs-dashboard" data-scenario="ok"></div>

Метод USE на графиках стенда (`data-scenario`: `idle`, `bcrypt`, `leak`, `payment` или `index`):

<div class="viz" data-viz="obs-use-board" data-scenario="bcrypt"></div>

Запрос к логам (`data-preset`: `all` или `errors`):

<div class="viz" data-viz="obs-log-query" data-preset="errors"></div>

Жизнь алерта (`data-threshold` в %, `data-for` в секундах):

<div class="viz" data-viz="obs-alert-life" data-threshold="5" data-for="120"></div>

### Тема 8: теория производительности

Закон Литтла в кафе (`data-rate`: гостей в минуту, `data-time`: секунд на гостя, `data-place`):

<div class="viz" data-viz="perf-little" data-rate="6" data-time="60" data-place="кафе"></div>

Открытая и закрытая модели нагрузки (`data-rate`, `data-users`, `data-slow`):

<div class="viz" data-viz="perf-open-closed" data-rate="8" data-users="10" data-slow="3"></div>

Из сессий в запросы в секунду (числа `data-sessions`, `data-peak`, `data-growth`; `data-ops` и `data-limit` в JSON):

<div class="viz" data-viz="perf-mix" data-sessions="2400" data-peak="1.5" data-growth="2" data-limit='{"Вход (POST /api/login)":4}'></div>

### Тема 9: Locust

Закрытая модель: пользователи и пауза (`data-users`, `data-wait-min`, `data-wait-max` в секундах, `data-resp` в мс, `data-cap` RPS):

<div class="viz" data-viz="locust-closed" data-users="20" data-wait-min="1" data-wait-max="3" data-resp="80" data-cap="150"></div>

Предел генератора (`data-gen` RPS на процесс, `data-procs`, `data-server`):

<div class="viz" data-viz="locust-generator" data-gen="400" data-procs="1" data-server="500"></div>

Координированное упущение (`data-rate`, `data-stall` в секундах):

<div class="viz" data-viz="locust-omission" data-rate="10" data-stall="5"></div>

### Тема 10: k6

Виртуальные пользователи и итерации (`data-vus`, `data-latency` в мс, `data-sleep` в секундах):

<div class="viz" data-viz="k6-vu-lanes" data-vus="3" data-latency="300" data-sleep="1"></div>

Исполнители k6 (`data-rate`, `data-vus`, `data-maxvus`, `data-latency`, `data-slow`):

<div class="viz" data-viz="k6-executors" data-rate="50" data-vus="5" data-maxvus="20" data-latency="100" data-slow="5"></div>

Пороги (`data-limit` в мс, `data-errors` в %, `data-slowpct` в %):

<div class="viz" data-viz="k6-threshold" data-limit="500" data-errors="0.5" data-slowpct="6"></div>

Что выбрать, k6 или Locust:

<div class="viz" data-viz="k6-pick-tool"></div>

### Тема 11: узкие места

Дерево диагностики (`data-case` от 1 до 6):

<div class="viz" data-viz="bn-diagnose" data-case="2"></div>

Цена bcrypt (`data-rounds`, `data-cpus`):

<div class="viz" data-viz="bn-bcrypt-cost" data-rounds="12" data-cpus="1"></div>

Индекс, N+1 и пул (`data-index`, `data-fixed`, `data-pool`, `data-load`):

<div class="viz" data-viz="bn-limits" data-load="30"></div>

Утечка памяти (`data-rps`, `data-kb` на запрос, `data-limit` и `data-base` в МБ):

<div class="viz" data-viz="bn-leak" data-rps="40" data-kb="10" data-limit="512" data-base="118"></div>

Шторм ретраев (`data-rate`, `data-capacity`, `data-retries`, `data-timeout`, `data-blip`):

<div class="viz" data-viz="bn-retry-storm" data-rate="12" data-capacity="30" data-retries="3" data-timeout="1" data-blip="10"></div>

### Тема 12: процесс

История прогонов в CI и регресс (`data-base`, `data-noise`, `data-regress`, `data-at`, `data-threshold`, `data-retries`):

<div class="viz" data-viz="proc-ci-history" data-base="260" data-noise="12" data-regress="40" data-at="18" data-threshold="400" data-retries="0"></div>

Прогноз ёмкости (`data-peak`, `data-capacity`, `data-growth` в % в месяц, `data-target`, `data-season`, `data-season-month`, `data-boost`):

<div class="viz" data-viz="proc-capacity" data-peak="90" data-capacity="200" data-growth="6" data-target="70" data-season="1.8" data-season-month="1" data-boost="0"></div>

### Тема 13: финал

Хронология инцидента (`data-delay` в мс, `data-react` в минутах):

<div class="viz" data-viz="final-incident-timeline" data-delay="2000" data-react="9"></div>

План дня для тестового задания (`data-total` часов, `data-plan` в JSON):

<div class="viz" data-viz="final-day-plan" data-total="8" data-plan='[{"name":"Разбор","h":0.5,"min":0.25},{"name":"Сценарий","h":1.5,"min":1},{"name":"Отчёт","h":1.5,"min":1.25}]'></div>

Тренажёр вопросов на скорость (`data-seconds`, `data-questions` в JSON):

<div class="viz" data-viz="final-speed-quiz" data-seconds="30" data-questions='[{"q":"Что такое p95?","a":"Значение, ниже которого лежат 95% замеров."},{"q":"Чем rate отличается от increase?","a":"rate даёт прирост в секунду, increase прирост за всё окно."}]'></div>
