---
layout: default
title: Проверка визуальных объяснений
sitemap: false
---

# Проверка визуальных объяснений

Это демонстрация для авторов уроков. Переключи тему оформления, проверь узкое окно и настройку «уменьшить движение». Данные и задержки здесь синтетические. Анимация начинается кнопкой «Пуск».

Разметку примеров можно взять из исходника этой страницы. Атрибуты `data-nodes`, `data-ms`, `data-x`, `data-only` содержат значения через запятую. `data-series` и `data-steps` содержат JSON. Время в `data-ms` и `data-timeout` задаётся в миллисекундах.

## Путь запроса

<div class="viz" data-viz="request-path" data-nodes="Браузер,Сеть,Магазин,PostgreSQL" data-ms="5,20,3"></div>

## Очередь

При λ близкой к μ ожидание растёт. При λ ≥ μ устойчивая очередь невозможна. Закон Литтла связывает среднее число заявок, скорость поступления и время в системе: L = λW. Для очереди отдельно: Lq = λWq. Здесь μ задаёт ёмкость всех каналов вместе, а счётчик показывает ожидание до начала обслуживания.

<div class="viz" data-viz="queue" data-servers="3"></div>

## Длинный хвост задержек

Двигай ползунок на одной и той же выборке, чтобы сравнить среднее и перцентили. «Новая выборка» заново создаёт 1200 запросов.

<div class="viz" data-viz="latency-hist"></div>

## Запас до предела

<div class="viz" data-viz="hockey-stick" data-capacity="100"></div>

## Профили нагрузки

<div class="viz" data-viz="load-profiles"></div>

Можно оставить только нужные профили:

<div class="viz" data-viz="load-profiles" data-only="stress,spike"></div>

## Пул соединений

`data-rate` задаёт интенсивность поступления, `data-timeout` задаёт таймаут ожидания свободного слота.

<div class="viz" data-viz="pool" data-size="4" data-rate="10" data-timeout="1500"></div>

## Линейный график

Наведение, касание и клавиши стрелок показывают точные значения. Под графиком есть доступная таблица данных.

<div class="viz" data-viz="chart" data-type="line" data-x="10,25,50,75,95" data-series='[{"name":"p95","values":[40,55,90,180,800]},{"name":"p50","values":[20,25,35,60,200]}]' data-x-label="Нагрузка, RPS" data-y-label="Задержка" data-unit="мс"></div>

## Столбчатый график

<div class="viz" data-viz="chart" data-type="bar" data-x="До,После" data-series='[{"name":"p95","values":[900,120]},{"name":"p99","values":[1500,200]}]' data-x-label="Индекс в PostgreSQL" data-y-label="Задержка" data-unit="мс"></div>

## Алгоритм диагностики

<div class="viz" data-viz="flow" data-steps='["Заметь рост p95","Проверь CPU и базу","Выдвини гипотезу","Повтори тест","Сравни результаты"]'></div>

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
