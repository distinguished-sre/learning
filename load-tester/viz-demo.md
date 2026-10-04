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

Водопад спанов одного запроса (`data-scenario`: `order`, `payment`, `retries`, `n1`; кнопки «Свернуть повторы», клик по строке открывает детали спана):

<div class="viz" data-viz="trace-waterfall" data-scenario="n1"></div>

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

## Мониторинг: как в настоящих интерфейсах

Эти виджеты рисуют данные в виде, привычном по рабочим инструментам: панель Grafana, Explore с Loki, водопад Tempo, страница Targets в Prometheus. Данные статичные, берутся из атрибутов (JSON в одинарных кавычках, без апострофов внутри). Широкое содержимое прокручивается внутри виджета. Двойные фигурные скобки в запросах и логах нужно оборачивать в raw (правило в CLAUDE.md).

Панель Time series: `mon-panel` (`data-query`, `data-x`, `data-series` с `name`, `values`, `color` green/yellow/orange/red/blue/purple, `null` в values рвёт линию, `data-unit`, `data-thresholds`, `data-annotations`, `data-stack`):

<div class="viz" data-viz="mon-panel" data-title="Задержка запросов магазина" data-query='histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{job="shop"}[5m]))) * 1000' data-unit="ms" data-x='["14:00","14:01","14:02","14:03","14:04","14:05","14:06","14:07","14:08","14:09","14:10","14:11","14:12","14:13","14:14","14:15","14:16","14:17","14:18","14:19","14:20","14:21","14:22","14:23","14:24","14:25","14:26","14:27","14:28","14:29","14:30"]' data-series='[{"name":"p95","values":[116.0,122.0,134.0,136.0,137.0,143.0,149.0,143.0,136.0,119.0,116.0,104.0,191.0,280.0,375.0,483.0,580.0,680.0,688.0,686.0,486.0,438.0,385.0,330.0,271.0,196.0,139.0,133.0,122.0,109.0,106.0],"color":"orange"},{"name":"p50","values":[52,55,60,61,62,64,67,64,61,54,52,47,86,126,169,217,261,306,310,309,219,197,173,148,122,88,63,60,55,49,48],"color":"green"}]' data-thresholds='[{"value":500,"color":"red","label":"SLO"}]' data-annotations='[{"at":"14:11","text":"выкатка v2"}]'></div>

Та же панель с накоплением серий (коды ответов) и разрывом линии, когда нет данных:

<div class="viz" data-viz="mon-panel" data-title="Запросы по кодам ответа" data-query='sum by (status) (rate(http_requests_total{job="shop"}[1m]))' data-unit="req/s" data-stack="true" data-x='["14:00","14:01","14:02","14:03","14:04","14:05","14:06","14:07","14:08","14:09","14:10","14:11","14:12","14:13","14:14","14:15","14:16","14:17","14:18","14:19","14:20","14:21","14:22","14:23","14:24","14:25","14:26","14:27","14:28","14:29","14:30"]' data-series='[{"name":"2xx","values":[78,85,86,86,86,90,88,90,89,86,84,84,81,77,76,77,71,70,73,71,73,73,73,79,76,79,80,84,84,86,89],"color":"green"},{"name":"4xx","values":[5,4,3,3,3,5,4,4,3,5,4,4,3,3,3,5,3,3,4,4,5,3,4,5,4,5,4,4,4,3,4],"color":"yellow"},{"name":"5xx","values":[0,1,1,0,0,0,1,1,0,0,0,1,2,5,8,10,12,15,15,18,13,11,9,7,5,3,0,0,1,0,1],"color":"red"}]'></div>

<div class="viz" data-viz="mon-panel" data-title="Память процесса (есть пропуск данных)" data-query='process_resident_memory_bytes{job="shop"}' data-unit="MB" data-x='["14:00","14:01","14:02","14:03","14:04","14:05","14:06","14:07","14:08","14:09","14:10","14:11","14:12","14:13","14:14","14:15","14:16","14:17","14:18","14:19","14:20","14:21","14:22","14:23","14:24","14:25","14:26","14:27","14:28","14:29","14:30"]' data-series='[{"name":"shop:8000","values":[298,310,316,319,322,331,337,343,350,361,362,368,381,385,395,397,407,412,null,null,430,433,441,452,459,466,468,477,484,490,498],"color":"blue"}]'></div>

Ряд Stat: `mon-stat` (`data-stats`: `title`, `value`, `unit`, `color` green/yellow/orange/red, `spark`, `sub`):

<div class="viz" data-viz="mon-stat" data-stats='[{"title":"Ошибки 5xx","value":2.4,"unit":"%","color":"yellow","spark":[0,0,0,1,2,5,8,10,12,15,15,18,13,11,9,7],"sub":"за 5 минут"},{"title":"p95 задержка","value":820,"unit":"ms","color":"red","spark":[136.0,119.0,116.0,104.0,191.0,280.0,375.0,483.0,580.0,680.0,688.0,686.0,486.0,438.0,385.0,330.0],"sub":"SLO 500 ms"},{"title":"Запросов в секунду","value":86,"unit":"req/s","color":"green","spark":[89,86,84,84,81,77,76,77,71,70,73,71,73,73,73,79]},{"title":"Память","value":512,"unit":"MB","color":"orange","spark":[298,310,316,319,322,331,337,343,350,361,362,368,381,385,395,397],"sub":"лимит 768 MB"}]'></div>

Explore с Loki: `mon-logs` (`data-query`, `data-lines` от новых к старым: `ts`, `level`, `labels`, `line`, `data-highlight`):

<div class="viz" data-viz="mon-logs" data-title="Explore" data-query='{service=~"shop|payment"} |= "4bf92f3577b34da6"' data-highlight="4bf92f3577b34da6" data-lines='[{"ts":"2026-10-04 14:05:31.920","level":"error","labels":{"service":"shop","env":"prod"},"line":"{\"ts\":\"2026-10-04T14:05:31.920Z\",\"level\":\"error\",\"msg\":\"payment failed\",\"trace_id\":\"4bf92f3577b34da6\",\"order_id\":1042,\"status\":500,\"duration_ms\":2003}"},{"ts":"2026-10-04 14:05:31.118","level":"warn","labels":{"service":"shop","env":"prod"},"line":"{\"ts\":\"2026-10-04T14:05:31.118Z\",\"level\":\"warn\",\"msg\":\"payment slow\",\"trace_id\":\"4bf92f3577b34da6\",\"duration_ms\":1850}"},{"ts":"2026-10-04 14:05:29.004","level":"info","labels":{"service":"shop","env":"prod"},"line":"POST /api/orders 201 94ms trace_id=9aa1c0de11"},{"ts":"2026-10-04 14:05:28.511","level":"info","labels":{"service":"shop","env":"prod"},"line":"GET /api/products 200 12ms trace_id=77be02c9d1"},{"ts":"2026-10-04 14:05:27.730","level":"error","labels":{"service":"payment","env":"prod"},"line":"connection refused: bank-gw:443 trace_id=4bf92f3577b34da6"},{"ts":"2026-10-04 14:05:26.402","level":"info","labels":{"service":"shop","env":"prod"},"line":"GET /api/products 200 11ms trace_id=0c4a8e71aa"},{"ts":"2026-10-04 14:05:25.019","level":"debug","labels":{"service":"shop","env":"prod"},"line":"pool: acquired connection in 0.4ms"},{"ts":"2026-10-04 14:05:24.660","level":"info","labels":{"service":"shop","env":"prod"},"line":"POST /api/orders 201 88ms trace_id=5d90b3f2c8"},{"ts":"2026-10-04 14:05:22.275","level":"error","labels":{"service":"shop","env":"prod"},"line":"POST /api/orders 500 2010ms trace_id=e41f7a0b23"},{"ts":"2026-10-04 14:05:21.840","level":"info","labels":{"service":"shop","env":"prod"},"line":"GET /healthz 200 1ms trace_id=-"}]'></div>

Водопад Tempo: `mon-trace` (`data-trace-id`, `data-spans`: `id`, `parent`, `service`, `name`, `start` и `dur` в мс, `status`, `attrs`, `data-focus`):

<div class="viz" data-viz="mon-trace" data-title="Trace: медленный заказ" data-trace-id="4bf92f3577b34da6a3ce929d0e0e4736" data-focus="a7" data-spans='[{"id":"a1","parent":null,"service":"shop","name":"POST /api/orders","start":0,"dur":2046,"status":"ok","attrs":{"http.method":"POST","http.status_code":201}},{"id":"a2","parent":"a1","service":"redis","name":"GET session","start":1,"dur":2,"status":"ok","attrs":{"db.system":"redis"}},{"id":"a3","parent":"a1","service":"postgres","name":"SELECT products","start":7,"dur":7,"status":"ok","attrs":{"db.system":"postgresql","db.statement":"SELECT ... FROM products WHERE id = ANY(...)"}},{"id":"a4","parent":"a1","service":"postgres","name":"INSERT orders","start":14,"dur":4,"status":"ok","attrs":{"db.system":"postgresql"}},{"id":"a5","parent":"a1","service":"shop","name":"POST payment","start":30,"dur":2010,"status":"ok","attrs":{"http.url":"http://payment:8001/pay","http.status_code":200}},{"id":"a6","parent":"a5","service":"payment","name":"POST /pay","start":33,"dur":2004,"status":"ok","attrs":{"PAYMENT_DELAY_MS":2000}},{"id":"a7","parent":"a6","service":"payment","name":"bank.charge","start":38,"dur":1990,"status":"error","attrs":{"error":"timeout waiting for bank-gw","peer.service":"bank-gw"}},{"id":"a8","parent":"a1","service":"redis","name":"DEL cart","start":2042,"dur":2,"status":"ok","attrs":{"db.system":"redis"}}]'></div>

Жизнь алерта: `mon-alert` (`data-x`, `data-values`, `data-unit`, `data-threshold`, `data-for` в точках, `data-name`, `data-group-wait` в точках; состояния считаются из данных). Короткий всплеск 15:06 до порога не доживает, второй держится дольше `for` и срабатывает:

<div class="viz" data-viz="mon-alert" data-title="HighLatency" data-name="p95 задержка" data-unit="ms" data-threshold="500" data-for="3" data-group-wait="2" data-x='["15:00","15:01","15:02","15:03","15:04","15:05","15:06","15:07","15:08","15:09","15:10","15:11","15:12","15:13","15:14","15:15","15:16","15:17","15:18","15:19","15:20","15:21","15:22","15:23","15:24"]' data-values='[211,218,219,198,231,233,548,532,233,218,187,697,694,705,666,705,624,681,640,222,231,196,185,231,186]'></div>

Prometheus Targets: `mon-targets` (`data-targets`: `job`, `endpoint`, `state` up/down/unknown, `labels`, `last`, `duration`, `error`):

<div class="viz" data-viz="mon-targets" data-title="Targets" data-targets='[{"job":"shop","endpoint":"http://shop:8000/metrics","state":"up","labels":{"instance":"shop:8000","job":"shop"},"last":"3.1s ago","duration":"12ms","error":""},{"job":"shop","endpoint":"http://shop-2:8000/metrics","state":"down","labels":{"instance":"shop-2:8000","job":"shop"},"last":"8.4s ago","duration":"10.000s","error":"Get http://shop-2:8000/metrics: context deadline exceeded"},{"job":"payment","endpoint":"http://payment:8001/metrics","state":"up","labels":{"instance":"payment:8001","job":"payment"},"last":"1.7s ago","duration":"9ms","error":""},{"job":"node","endpoint":"http://node-exporter:9100/metrics","state":"up","labels":{"instance":"node-exporter:9100","job":"node"},"last":"6.0s ago","duration":"41ms","error":""},{"job":"postgres","endpoint":"http://pg-exporter:9187/metrics","state":"unknown","labels":{"instance":"pg-exporter:9187","job":"postgres"},"last":"never","duration":"0s","error":""}]'></div>

Вкладка Table: `mon-table` (`data-query`, `data-columns`, `data-rows`, `data-highlight-col`, `data-highlight-row`):

<div class="viz" data-viz="mon-table" data-title="Table" data-query='sum by (instance) (rate(http_requests_total{status=~"5.."}[5m]))' data-columns='["Время","instance","Значение"]' data-rows='[["14:30:00","shop:8000",0.02],["14:30:00","shop-2:8000",3.41],["14:30:00","payment:8001",0.0]]' data-highlight-col="2" data-highlight-row="1"></div>

### Тема 5 мониторинга: надёжность и инциденты, урок 5.1

Хронология инцидента (`mon5-timeline`): двигай ползунки MTTD, MTTA, MTTI и MTTM, смотри MTTR, расход бюджета ошибок и темп расхода; наведи на отрезок, чтобы прочитать подсказку:

<div class="viz" data-viz="mon5-timeline"></div>

### Тема 5 мониторинга: надёжность и инциденты, урок 5.2

Проверка задач из постмортема (`mon52-actions`): выбери задачу кнопкой и посмотри, какие из пяти проверок она проходит; наведи на строку, чтобы прочитать правило:

<div class="viz" data-viz="mon52-actions"></div>

### Тема 5 мониторинга: надёжность и инциденты, урок 5.3

Оплата ломается на 40 секунд из двух минут (`mon5-resilience`, `data-orders` заказов в секунду, `data-retries` повторов, `data-timeout` таймаут попытки в секундах, `data-kind` hang или error, `data-breaker` 1 включает выключатель): сколько попыток уходит к оплате, как долго ждёт покупатель и хватает ли пула из пяти соединений:

<div class="viz" data-viz="mon5-resilience" data-orders="2" data-retries="3" data-timeout="1" data-kind="hang" data-breaker="0"></div>

### Тема 5 мониторинга: надёжность и инциденты, урок 5.4

Выкатка сразу всем и по ступеням canary (`rel-rollout`, `data-error` доля ошибок новой версии в процентах, `data-detect` через сколько минут заметили): сколько месячного бюджета ошибок съела плохая версия; наведи на график, чтобы увидеть минуту:

<div class="viz" data-viz="rel-rollout" data-error="20" data-detect="4"></div>

RPO и RTO на одной линии времени (`rel-dr`, `data-interval` минут между копиями, `data-restore` минут самого восстановления, `data-rpo` и `data-rto` цели в минутах):

<div class="viz" data-viz="rel-dr" data-interval="60" data-restore="8" data-rpo="15" data-rto="45"></div>
