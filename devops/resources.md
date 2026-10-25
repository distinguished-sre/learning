---
layout: page
title: "Дополнительные материалы и ссылки"
redirect_from:
  - /devops/Старые-уроки-и-задания.html
---

Здесь внешние курсы, порядок изучения технологий и ссылки по темам. Вопросы с собеседований собраны на странице [«Подготовка к собеседованию»](interview.md), а разбор каждого вопроса лежит в конце теории своей темы: [Linux](01-linux/index.md) · [Сеть](02-network/index.md) · [Git и CI/CD](03-git-ci/index.md) · [Docker](04-docker/index.md) · [Kubernetes и Helm](05-kubernetes/index.md) · [Ansible и Terraform](07-iac/index.md) · [Мониторинг](08-observability/index.md) · [Vault и GitOps](09-secrets-gitops/index.md)

### Первый совет

Начни учить английские слова. Для начала достаточно уметь прочесть и понять текст: документация, сообщения об ошибках и ответы на форумах почти всегда на английском.

Первый шаг: заведи файл со словами из сообщений об ошибках и документации (`error`, `permission denied`, `timeout`, `deprecated`, `refused`, `not found`). Записывай по 5–10 слов в день, непонятное переводи в браузерном переводчике. Раздел `Troubleshooting` в документации инструментов хорошо подходит для тренировки: там короткие фразы и реальные ошибки.

### Книги

- [Site Reliability Engineering](https://sre.google/sre-book/table-of-contents/) (SRE Book): как Google строит надёжность сервисов. Бесплатна на сайте. Читай главы про SLO, мониторинг и разбор сбоев.
- [The Site Reliability Workbook](https://sre.google/workbook/table-of-contents/) (SRE Workbook): практическое продолжение. Нужна, когда дойдёшь до burn-rate алертов в теме 8: там таблица порогов, на которую ссылаются технические задания.

### Порядок изучения технологий

Общепринятая дорожная карта: [roadmap.sh/devops](https://roadmap.sh/devops). Комментарии к ней применительно к этому курсу. С чего начать: иди по порядку с пункта 1, пункт 12 и абзац «Позже» оставь на потом.

1. Основы bash: [тема 1](01-linux/index.md). Дополнительно стоит освоить Python или Go: без языка программирования потолок роста ниже.
2. Из операционных систем ставь [Ubuntu](https://ubuntu.com/desktop), а если у тебя Windows, то [Ubuntu из магазина Microsoft](https://apps.microsoft.com/detail/9nz3klhxdjp5).
3. Из редакторов научись открывать и править файлы в `nano`, а затем в `vim`.
4. Терминал, права, процессы, systemd: [тема 1](01-linux/index.md).
5. Сети: [тема 2](02-network/index.md).
6. Git и CI/CD: [тема 3](03-git-ci/index.md). Проще начинать с GitHub Actions, потом переходить на GitLab CI.
7. Контейнеризация: [тема 4](04-docker/index.md), затем Kubernetes в [теме 5](05-kubernetes/index.md).
8. Облачные провайдеры: [тема 6](06-cloud/index.md). В России это Yandex Cloud, Cloud.ru или VK Cloud.
9. Terraform и Ansible как инфраструктура как код: [тема 7](07-iac/index.md).
10. Мониторинг, логи и трейсинг: [тема 8](08-observability/index.md).
11. Управление секретами через Vault и GitOps: [тема 9](09-secrets-gitops/index.md).
12. Сервис-меш (управление сетевым трафиком между сервисами в Kubernetes): Istio: [урок 8.10](08-observability/10-service-mesh-istio.md). Linkerd: альтернатива, в курсе не разбирается (stable-сборки с 2024 года у разработчика Buoyant платные).

Позже, когда освоишь основное: Harbor, Nexus, Artifactory: реестры, где хранят образы и чарты (склад образов, как Docker Hub, но свой). В курсе не разбираются.

### Полезные YouTube-каналы

- [ADV-IT](https://www.youtube.com/@ADV-IT/playlists): плейлисты, по которым училось много DevOps-инженеров
- [Merion Academy](https://www.youtube.com/watch?v=NtGN7Nz6I0c): про технологии из дорожной карты простыми словами
- [Pavlenko AT](https://www.youtube.com/@pavlenkoat/playlists): хороший канал по DevOps, смотреть на скорости 1.25

Весь видеоматериал ниже на русском языке, если не сказано иное. Годы выхода проверяй на странице видео: часть курсов старше актуальных версий инструментов, поэтому команды сверяй с документацией.

### Дополнительные материалы по темам

<details markdown="1">
  <summary>Linux, сети и bash-скрипты</summary>

- **Linux** (ядро операционной системы). [Курс по Linux (видео)](https://youtu.be/wdaHKwvNRuU), [статья на Хабре про Linux](https://habr.com/ru/articles/788970/), [задания distinguished-sre/devops-linux](https://github.com/distinguished-sre/devops-linux). Готов, когда: умеешь устанавливать программы, знаешь основные команды, понимаешь, что такое ядро и какие каталоги есть в `/`. Вопросы: [devops-exercises, Linux](https://github.com/bregman-arie/devops-exercises/tree/master/topics/linux).
- **Bash-скрипты** (автоматизация рутины). Задание: написать скрипты ко всем заданиям [devops-linux](https://github.com/distinguished-sre/devops-linux) и к задачам 2, 5, 9 из [devops-exercises, shell](https://github.com/bregman-arie/devops-exercises/tree/master/topics/shell). Готов, когда: умеешь работать с переменными, условиями, циклами и `case`.
- **Сети.** [Статья на Хабре про сети](https://habr.com/ru/post/326574/), [статья на Хабре про сетевые протоколы](https://habr.com/ru/post/711578/), [Википедия: маска подсети](https://ru.wikipedia.org/wiki/Маска_подсети), [видео про websocket](https://youtu.be/19d4AXt3dSI) (websocket это постоянное двустороннее соединение между браузером и сервером). Готов, когда: понимаешь SSH, пакеты, уровни TCP/IP, DNS, HTTP и REST API, IP и маску подсети, умеешь смотреть интерфейсы и перехватывать трафик, знаешь конфиг nginx и балансировку. Вопросы: [devops-exercises, сети](https://github.com/bregman-arie/devops-exercises#network).

</details>

<details markdown="1">
  <summary>Git и GitLab CI/CD</summary>

- **Git.** [Обзор (видео)](https://youtu.be/EeARyFrZsnU), [курс по Git (плейлист)](https://www.youtube.com/watch?list=PLg5SS_4L6LYstwxTEOU05E0URTHnbtA0l) до 15 урока. Создай свой репозиторий с несколькими ветками и тегами. Готов, когда: умеешь делать коммиты, ветки и теги и объясняешь разницу, разрешаешь конфликты, откатываешься на старую версию, различаешь `fetch` и `pull`. Вопросы: [devops-exercises, Git](https://github.com/bregman-arie/devops-exercises/tree/master/topics/git).
- **CI/CD.** Уроки 15 и 16 того же курса, [видео про CI/CD](https://youtu.be/tE3u1LquFcg?t=212), [сборка образов в GitLab CI через BuildKit](https://docs.gitlab.com/ci/docker/using_docker_build/). Kaniko, который раньше советовали для сборки без Docker-демона, устарел: его проект больше не развивается. Готов, когда: настроил автоматическую сборку образа и отправку его в реестр, знаешь из каких шагов состоит хороший пайплайн. Вопросы: [devops-exercises, CI/CD](https://github.com/bregman-arie/devops-exercises/tree/master/topics/cicd).

</details>

<details markdown="1">
  <summary>Docker и Kubernetes</summary>

- **Docker.** [Видео про Docker](https://youtu.be/aZTL2zRmOnA), [статья Флант на Хабре про Docker](https://habr.com/ru/companies/flant/articles/787494/). Готов, когда: понимаешь, зачем нужен Docker, умеешь собрать свой образ и отправить его в реестр, запускаешь несколько контейнеров вместе через Compose.
- **Kubernetes.** [Курс Microsoft Learn: введение в Kubernetes](https://learn.microsoft.com/ru-ru/training/modules/intro-to-kubernetes/), [материалы distinguished-sre/devops-kubernetes](https://github.com/distinguished-sre/devops-kubernetes), [статья на Хабре про Kubernetes](https://habr.com/ru/articles/777728/). Готов, когда: понимаешь, зачем нужен Kubernetes, ставишь приложения через Helm. Вопросы: [devops-exercises, Kubernetes](https://github.com/bregman-arie/devops-exercises/tree/master/topics/kubernetes).

Дорожные карты: [Docker](https://roadmap.sh/docker) · [Kubernetes](https://roadmap.sh/kubernetes)

[Лучшие практики по Kubernetes](https://github.com/distinguished-sre/devops-kubernetes/blob/main/ЛУЧШИЕ_ПРАКТИКИ.md), в том числе про распределение подов по нодам и зонам.

</details>

<details markdown="1">
  <summary>Мониторинг и логирование</summary>

- **Мониторинг.** [Видео про мониторинг](https://youtu.be/wDan20_WyNg), [пример стека docker-monitoring-stack-gpnc](https://github.com/ruanbekker/docker-monitoring-stack-gpnc), [видео про ELK](https://youtu.be/ZcC3BTChCY0), [пример ELK в Compose (awesome-compose)](https://github.com/docker/awesome-compose/tree/master/elasticsearch-logstash-kibana), [видео про трейсинг](https://youtu.be/7Dyf4AiUAcQ). Готов, когда: умеешь создавать алерты, настраивать мониторинг Docker и хоста, устанавливать в кластер [kube-prometheus-stack](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack). Вопросы: [devops-exercises, Prometheus](https://github.com/bregman-arie/devops-exercises#prometheus).
- [Логирование в Kubernetes (документация)](https://kubernetes.io/docs/concepts/cluster-administration/logging/)
- [Золотые сигналы (статья Southbridge на Хабре)](https://habr.com/ru/companies/southbridge/articles/688082/)
- [Готовые правила алертов на все случаи (awesome-prometheus-alerts)](https://github.com/samber/awesome-prometheus-alerts)
- [Телеметрия в Istio (документация)](https://istio.io/latest/docs/concepts/observability/): золотые метрики собираются автоматически

</details>

<details markdown="1">
  <summary>Ansible и Terraform</summary>

- **Ansible** (управление конфигурацией по SSH). [Видео про Ansible](https://youtu.be/23Zec3ORJOY), [курс по Ansible (плейлист)](https://www.youtube.com/watch?list=PLg5SS_4L6LYufspdPupdynbMQTBnZd31N), уроки 1, 6, 10, 12, 14, 15, 19. Готов, когда: понимаешь, зачем нужен Ansible, что такое идемпотентность (повторный запуск не меняет уже правильное состояние) и playbook (файл со сценарием настройки), умеешь писать свои роли. Вопросы: [devops-exercises, Ansible](https://github.com/bregman-arie/devops-exercises/tree/master/topics/ansible).
- **Terraform.** [Видео про Terraform](https://youtu.be/ph4iNA0Uuko), [курс по Terraform (плейлист)](https://www.youtube.com/watch?list=PLg5SS_4L6LYujWDTYb-Zbofdl44Jxb2l8), уроки 1, 3, 6, 7, 12, 14, 16, 18. Готов, когда: понимаешь, зачем нужен Terraform, умеешь создавать ресурсы и знаешь, где хранится состояние.

</details>

### Где ещё искать вопросы к собеседованию

- [Подборка вопросов с разбором на Хабре](https://habr.com/ru/articles/775560/)
- [Большой открытый сборник упражнений и вопросов devops-exercises](https://github.com/bregman-arie/devops-exercises) (на английском)
