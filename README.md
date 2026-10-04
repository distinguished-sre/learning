# Обучение

Бесплатные курсы Евгения Быкова одним сайтом: https://distinguished-sre.github.io/learning/

- [DevOps](https://distinguished-sre.github.io/learning/devops/): от Linux до Kubernetes и GitOps со сквозным проектом (`devops/`).
- [Нагрузочное тестирование](https://distinguished-sre.github.io/learning/load-tester/): Linux, Python, автотесты API, Locust, k6 и поиск узких мест (`load-tester/`).
- [Мониторинг: основы](https://distinguished-sre.github.io/learning/monitoring/): метрики, логи, трейсы, SLO, Prometheus, Grafana и алерты на учебном «Магазине» (`monitoring/`).

## Собрать сайт локально

```bash
bundle exec jekyll build
```

Нужен Jekyll как на GitHub Pages (gem `github-pages`). Результат в `_site/`.

## Где правила

Структура курса, стиль уроков и проверки описаны в `CLAUDE.md` (общий стандарт) и `<курс>/CLAUDE.md`. Общие шаблоны, стили и скрипты лежат в корне (`_layouts/`, `_includes/`, `assets/`), данные курсов в `_data/courses/`.
