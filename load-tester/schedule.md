---
layout: default
title: "Расписание: 21 неделя по 5 занятий"
permalink: /schedule.html
---

# Расписание курса

Курс рассчитан на **21 неделю, 5 занятий в неделю по 1,5–2 часа**, всего 101 занятие. Урок на 2–2,5 часа занимает одно занятие, длинные уроки (3 часа и больше) разбиты на два дня, а в конце крупных тем стоит день повторения.

```mermaid
timeline
    title Путь за 21 неделю
    Недели 1–3 : Linux для нагрузочника : Как устроен веб-сервис
    Недели 4–7 : Git и GitHub : Python для тестировщика
    Недели 7–10 : Docker и стенд «Магазин» : Автотесты API и CI
    Недели 10–12 : Метрики, логи, трейсы и алерты
    Недели 12–15 : Теория производительности : Locust
    Недели 15–18 : k6 : Поиск узких мест
    Недели 18–21 : Отчёт, CI, ёмкость : Финал и собеседования
```

## Как заниматься

1. **Каждый день одно занятие, в одно и то же время.** Регулярность важнее длины: пять раз по 1,5 часа дают больше, чем один раз 8 часов. Базовые вещи запоминаются, когда ты возвращаешься к ним каждый день.
2. **Начинай занятие с пяти минут повторения.** Открой «Итог урока» вчерашнего урока и ответь вслух на два вопроса с собеседований из него, не подглядывая.
3. **Практику делай руками**, даже если кажется, что всё понятно из текста. Команды набирай, а не копируй, хотя бы первые недели.
4. **Не успел за занятие: это нормально.** Доделай на следующий день и сдвинь план. День повторения в конце темы как раз запас на такие сдвиги.
5. **Застрял больше чем на 20 минут:** перечитай раздел «Типичные ошибки», затем спроси нейросеть-преподавателя из [гайда](index.html#start) и покажи ей точный текст ошибки.

## День повторения

В конце крупных тем стоит отдельный день. Его порядок всегда одинаковый:

- 30 минут: вопросы с собеседований всех уроков темы **вслух и на время**, по 1–2 минуты на ответ. Вопросы, где запнулся, выпиши.
- 40 минут: повтори практику, которая далась тяжелее всего, с чистого листа, без подсказок.
- 20 минут: по выписанным вопросам перечитай теорию и ответь ещё раз.

Отвечать вслух важно: на собеседовании знание, которое ни разу не проговаривал, от волнения «пропадает». Проговорённое остаётся.

## План по дням

| Неделя | Пн | Вт | Ср | Чт | Пт |
|---|---|---|---|---|---|
| 1 | [1.1](01-linux/01-workstation-terminal.md) | [1.2](01-linux/02-text-logs.md), ч. 1 | [1.2](01-linux/02-text-logs.md), ч. 2 | [1.3](01-linux/03-processes-resources.md), ч. 1 | [1.3](01-linux/03-processes-resources.md), ч. 2 |
| 2 | [1.4](01-linux/04-network-cli.md), ч. 1 | [1.4](01-linux/04-network-cli.md), ч. 2 | [1.5](01-linux/05-bash-scripts.md), ч. 1 | [1.5](01-linux/05-bash-scripts.md), ч. 2 | [2.1](02-web/01-client-server-http.md), ч. 1 |
| 3 | [2.1](02-web/01-client-server-http.md), ч. 2 | [2.2](02-web/02-rest-json-auth.md) | [2.3](02-web/03-backend-anatomy.md) | [2.4](02-web/04-sql-basics.md), ч. 1 | [2.4](02-web/04-sql-basics.md), ч. 2 |
| 4 | [3.1](03-git/01-git-basics.md), ч. 1 | [3.1](03-git/01-git-basics.md), ч. 2 | [3.2](03-git/02-github.md), ч. 1 | [3.2](03-git/02-github.md), ч. 2 | [4.1](04-python/01-first-program.md) |
| 5 | [4.2](04-python/02-conditions-loops.md), ч. 1 | [4.2](04-python/02-conditions-loops.md), ч. 2 | [4.3](04-python/03-functions-errors.md) | [4.4](04-python/04-files-json-csv.md), ч. 1 | [4.4](04-python/04-files-json-csv.md), ч. 2 |
| 6 | [4.5](04-python/05-venv-requests.md), ч. 1 | [4.5](04-python/05-venv-requests.md), ч. 2 | [4.6](04-python/06-classes.md), ч. 1 | [4.6](04-python/06-classes.md), ч. 2 | [4.7](04-python/07-pytest.md), ч. 1 |
| 7 | [4.7](04-python/07-pytest.md), ч. 2 | Повторение тем 1–4 | [5.1](05-docker/01-containers.md), ч. 1 | [5.1](05-docker/01-containers.md), ч. 2 | [5.2](05-docker/02-dockerfile.md), ч. 1 |
| 8 | [5.2](05-docker/02-dockerfile.md), ч. 2 | [5.3](05-docker/03-compose-shop.md), ч. 1 | [5.3](05-docker/03-compose-shop.md), ч. 2 | [5.4](05-docker/04-limits-stats.md), ч. 1 | [5.4](05-docker/04-limits-stats.md), ч. 2 |
| 9 | [6.1](06-api-testing/01-testing-basics.md), ч. 1 | [6.1](06-api-testing/01-testing-basics.md), ч. 2 | [6.2](06-api-testing/02-api-autotests.md), ч. 1 | [6.2](06-api-testing/02-api-autotests.md), ч. 2 | [6.3](06-api-testing/03-ci-actions.md), ч. 1 |
| 10 | [6.3](06-api-testing/03-ci-actions.md), ч. 2 | [7.1](07-observability/01-metrics-prometheus.md), ч. 1 | [7.1](07-observability/01-metrics-prometheus.md), ч. 2 | [7.2](07-observability/02-promql.md), ч. 1 | [7.2](07-observability/02-promql.md), ч. 2 |
| 11 | [7.3](07-observability/03-grafana.md) | [7.4](07-observability/04-exporters.md), ч. 1 | [7.4](07-observability/04-exporters.md), ч. 2 | [7.5](07-observability/05-logs-loki.md) | [7.6](07-observability/06-alerts-incidents.md), ч. 1 |
| 12 | [7.6](07-observability/06-alerts-incidents.md), ч. 2 | [7.7](07-observability/07-traces.md), ч. 1 | [7.7](07-observability/07-traces.md), ч. 2 | Повторение тем 5–7 | [8.1](08-perf-theory/01-latency-throughput.md), ч. 1 |
| 13 | [8.1](08-perf-theory/01-latency-throughput.md), ч. 2 | [8.2](08-perf-theory/02-queues-littles-law.md), ч. 1 | [8.2](08-perf-theory/02-queues-littles-law.md), ч. 2 | [8.3](08-perf-theory/03-test-types.md), ч. 1 | [8.3](08-perf-theory/03-test-types.md), ч. 2 |
| 14 | [8.4](08-perf-theory/04-load-profile-slo.md), ч. 1 | [8.4](08-perf-theory/04-load-profile-slo.md), ч. 2 | [9.1](09-locust/01-first-locustfile.md) | [9.2](09-locust/02-user-journey.md) | [9.3](09-locust/03-data-checks.md) |
| 15 | [9.4](09-locust/04-headless-shape.md) | [9.5](09-locust/05-distributed-generator.md) | Повторение тем 8–9 | [10.1](10-k6/01-js-first-script.md), ч. 1 | [10.1](10-k6/01-js-first-script.md), ч. 2 |
| 16 | [10.2](10-k6/02-scenarios-thresholds.md), ч. 1 | [10.2](10-k6/02-scenarios-thresholds.md), ч. 2 | [10.3](10-k6/03-k6-prometheus.md), ч. 1 | [10.3](10-k6/03-k6-prometheus.md), ч. 2 | [11.1](11-bottlenecks/01-method.md), ч. 1 |
| 17 | [11.1](11-bottlenecks/01-method.md), ч. 2 | [11.2](11-bottlenecks/02-cpu.md) | [11.3](11-bottlenecks/03-database.md), ч. 1 | [11.3](11-bottlenecks/03-database.md), ч. 2 | [11.4](11-bottlenecks/04-memory-soak.md) |
| 18 | [11.5](11-bottlenecks/05-cache-dependencies.md) | Повторение тем 10–11 | [12.1](12-process/01-report.md), ч. 1 | [12.1](12-process/01-report.md), ч. 2 | [12.2](12-process/02-perf-ci.md), ч. 1 |
| 19 | [12.2](12-process/02-perf-ci.md), ч. 2 | [12.3](12-process/03-capacity.md), ч. 1 | [12.3](12-process/03-capacity.md), ч. 2 | [13.1](13-final/01-incident-under-load.md), ч. 1 | [13.1](13-final/01-incident-under-load.md), ч. 2 |
| 20 | [13.2](13-final/02-take-home.md), ч. 1 | [13.2](13-final/02-take-home.md), ч. 2 | [13.3](13-final/03-portfolio-resume.md) | [13.4](13-final/04-mock-perf.md) | [13.5](13-final/05-mock-monitoring.md) |
| 21 | Итоговое повторение всего курса |  |  |  |  |

Урок на 2,5 часа иногда занимает полтора занятия. Тогда доделай его на следующий день, а запас возьми из ближайшего дня повторения.

## Контрольные точки

После каждой точки проверь себя: если хоть один пункт не получается без подсказки, вернись к уроку, прежде чем идти дальше.

| Конец недели | Что ты должен уметь сам |
|---|---|
| 3 | Найти, чем занят процессор и память машины, проверить DNS через `dig`, сделать запрос `curl -i` и прочитать каждую строку ответа |
| 7 | Написать на Python скрипт, который логинится в API и сохраняет ответ в файл, и тест на pytest для него |
| 10 | Поднять «Магазин» одной командой и прогнать свои автотесты API в GitHub Actions |
| 12 | Построить в Grafana график RPS, доли ошибок и p95 по запросам «Магазина» и объяснить, откуда берутся числа |
| 15 | Написать сценарий покупателя в Locust, запустить по профилю нагрузки и объяснить результат по метрикам |
| 18 | Найти узкое место «Магазина» по метрикам, доказать причину и показать эффект исправления графиком «до и после» |
| 21 | Сделать тестовое задание за один день и пройти пробное собеседование, отвечая вслух |
