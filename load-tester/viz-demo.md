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
