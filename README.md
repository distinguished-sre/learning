# Обучение

Бесплатные курсы Евгения Быкова одним сайтом: https://distinguished-sre.github.io/learning/

- [DevOps](https://distinguished-sre.github.io/learning/devops/): от Linux до Kubernetes и GitOps со сквозным проектом (`devops/`).
- [Нагрузочное тестирование](https://distinguished-sre.github.io/learning/load-tester/): Linux, Python, автотесты API, Locust, k6 и поиск узких мест (`load-tester/`).
- [Мониторинг и SRE](https://distinguished-sre.github.io/learning/monitoring/): метрики, логи, трейсы, SLO, Prometheus, Grafana, алерты, инциденты, постмортемы и паттерны надёжности на учебном «Магазине» (`monitoring/`).

## Собрать сайт локально

```bash
bundle exec jekyll build
```

Нужен Jekyll как на GitHub Pages (gem `github-pages`). Результат в `_site/`.

## Где правила

Структура курса, стиль уроков и проверки описаны в `CLAUDE.md` (общий стандарт) и `<курс>/CLAUDE.md`. Общие шаблоны, стили и скрипты лежат в корне (`_layouts/`, `_includes/`, `assets/`), данные курсов в `_data/courses/`.

## Обратная связь

Кнопка «Обратная связь» есть на каждой странице; у разделов и вопросов теста есть свои кнопки. Форма задаёт два коротких вопроса, принимает описание и готовит сообщение со ссылкой, курсом, темой, уроком, разделом и выделенной цитатой. Для вопроса теста добавляет его ID, текст, код и ссылку на раздел исходного урока. Цитату можно убрать перед отправкой.

Контакты автора хранятся в `_data/feedback.yml`. Telegram и email открываются с готовым текстом; для Instagram и VK сообщение можно скопировать. Отправка происходит в выбранном приложении. Форма не сохраняет ответы и не меняет прогресс обучения.

Общий компонент: `_includes/feedback.html`, `assets/js/feedback.js`, `assets/css/feedback.css`. Вызов из нового виджета: `window.LearningFeedback.open({ element: DOMElement })`; передайте элемент, к которому относится замечание. Контекст снимается при открытии формы.

Проверка после сборки: `SITE_DIR=_site node --test tools/feedback.test.mjs` (нужны Playwright и Chromium). Она также включена в `quiz.yml`.
