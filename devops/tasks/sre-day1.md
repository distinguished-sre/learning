---
layout: page
title: "ТЗ для SRE, день 1"
description: "Мониторинг и цели по надёжности. Часть технического задания для SRE."
---

> Это день 1 из 4 [технического задания для SRE](sre.md). Слова, схема стенда и подготовка описаны на странице плана.

## День 1. Мониторинг и цели по надёжности

> **Зачем это на работе:** первое, что просят у SRE на новом месте, это ответ «как у нас дела» одним взглядом и сигнал, когда всё плохо. В этом дне ты строишь именно это.

**Время:** около 7 часов (2 + 2 + 1,5 + 1,5).

---

### Задание 1.1. Prometheus, Grafana и Alertmanager (2 ч)

**Что получится на экране:** на странице Prometheus Status → Targets пять целей в состоянии `UP`, в Grafana (`http://localhost:3000`) папка SRE с живыми графиками, в Alertmanager пока пусто.

**Что делаешь:** поднимаешь стек мониторинга для «Заметок» через Docker Compose. Источник метрик это сами «Заметки» с их `/metrics` (метрика `notes_http_requests_total` и гистограмма `notes_http_request_duration_seconds`, [урок 8.2](../08-observability/02-prometheus-basics.md)). Пока никто не ходит в приложение, графики пустые, поэтому в стек добавлен маленький генератор нагрузки.

Сначала подготовь секреты и каталоги:

```bash
cd ~/sre-bootstrap/monitoring
mkdir -p prometheus/rules alertmanager grafana/provisioning/datasources grafana/provisioning/dashboards grafana/dashboards

# Пароль администратора Grafana в .env (в git не попадает)
printf 'GRAFANA_ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 12)" > .env
printf 'GRAFANA_ADMIN_PASSWORD=\n' > .env.example
```

Файл `monitoring/compose.yml`:

```yaml
# ~/sre-bootstrap/monitoring/compose.yml
# Основной стек "Заметок" должен быть запущен раньше: сеть notes-net создаёт он.
services:
  prometheus:
    image: prom/prometheus:v3.15.0
    command:
      - --config.file=/etc/prometheus/prometheus.yml
      - --storage.tsdb.path=/prometheus
      - --storage.tsdb.retention.time=35d   # окно SLO 30 дней плюс запас
      - --web.enable-lifecycle              # разрешает перезагрузку конфига через HTTP
    volumes:
      - ./prometheus:/etc/prometheus:ro
      - prometheus_data:/prometheus
    ports: ["127.0.0.1:9090:9090"]
    restart: unless-stopped

  alertmanager:
    image: prom/alertmanager:v0.34.1
    volumes:
      - ./alertmanager:/etc/alertmanager:ro
    ports: ["127.0.0.1:9093:9093"]
    restart: unless-stopped

  # Приёмник уведомлений: отвечает на любой запрос и пишет его в лог.
  webhook:
    image: mccutchen/go-httpbin:2.18.3
    restart: unless-stopped

  grafana:
    image: grafana/grafana:13.2.2
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:?задай пароль в .env}
      GF_USERS_ALLOW_SIGN_UP: "false"
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
      - ./grafana/dashboards:/var/lib/grafana/dashboards:ro
      - grafana_data:/var/lib/grafana
    ports: ["127.0.0.1:3000:3000"]
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:v1.12.1
    command:
      - --path.rootfs=/host
    pid: host
    volumes:
      - /:/host:ro,rslave
    ports: ["127.0.0.1:9100:9100"]
    restart: unless-stopped

  cadvisor:
    image: ghcr.io/google/cadvisor:v0.60.6
    volumes:
      - /:/rootfs:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
      - /dev/disk/:/dev/disk:ro
    devices:
      - /dev/kmsg
    ports: ["127.0.0.1:8081:8080"]   # снаружи 8081: порт 8080 занят "Заметками"
    restart: unless-stopped

  # Генератор нагрузки: раз в 0,2 секунды запрос в "Заметки", каждый ERROR_EVERY-й идёт на /error (ответ 500).
  load:
    image: curlimages/curl:8.11.1
    environment:
      ERROR_EVERY: "20"        # 1 из 20 это 5% ошибок
    entrypoint: ["sh", "-c"]
    command:
      - |
        i=0
        while true; do
          i=$$((i + 1))
          if [ $$((i % ERROR_EVERY)) -eq 0 ]; then p=/error; else p=/notes; fi
          curl -s -o /dev/null "http://notes:8080$$p"
          sleep 0.2
        done
    restart: unless-stopped

networks:
  default:
    name: notes-net
    external: true

volumes:
  prometheus_data:
  grafana_data:
```

Что здесь нового по сравнению с [уроком 8.2](../08-observability/02-prometheus-basics.md). Порты привязаны к `127.0.0.1`: у Prometheus, Alertmanager и Grafana в учебном стенде слабая защита, и наружу в сеть их открывать не нужно. Для node-exporter корень хоста подключён как `/:/host:ro,rslave`, а `--path.rootfs=/host` говорит ему, где искать настоящие диски. Сетевые метрики `node_network_*` при этом относятся к сети самого контейнера, а не хоста. У cAdvisor снаружи порт 8081, потому что 8080 уже занят «Заметками». В `load` двойной `$$` нужен, чтобы Compose не подставлял переменные сам и отдал `$` оболочке внутри контейнера. Порядок запуска: основной стек «Заметок», затем этот.

Файл `prometheus/prometheus.yml`:

```yaml
# ~/sre-bootstrap/monitoring/prometheus/prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - /etc/prometheus/rules/*.yml

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ["localhost:9090"]

  - job_name: node-exporter
    static_configs:
      - targets: ["node-exporter:9100"]

  - job_name: cadvisor
    static_configs:
      - targets: ["cadvisor:8080"]   # внутри сети порт 8080

  - job_name: notes
    static_configs:
      - targets: ["notes:8080"]      # путь /metrics по умолчанию

  - job_name: grafana
    static_configs:
      - targets: ["grafana:3000"]    # Grafana сама отдаёт /metrics
```

Ещё один файл, `prometheus/rules/basic_alerts.yml`: главный алерт здоровья, который сработает, когда любая цель перестала отвечать:

```yaml
# ~/sre-bootstrap/monitoring/prometheus/rules/basic_alerts.yml
groups:
  - name: target_health
    rules:
      - alert: TargetDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Цель мониторинга не отвечает больше минуты (смотри метку job)"
```

Datasource Grafana как код, `grafana/provisioning/datasources/prometheus.yml`:

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    uid: prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
```

И провайдер дашбордов, `grafana/provisioning/dashboards/dashboards.yml`. Он говорит Grafana загружать все JSON-файлы из каталога при запуске:

```yaml
apiVersion: 1
providers:
  - name: file
    folder: SRE
    type: file
    options:
      path: /var/lib/grafana/dashboards
```

**Практические подзадачи:**

1. Подними стек и дай ему 20 секунд:

   ```bash
   cd ~/sre-bootstrap/monitoring
   docker compose config -q && docker compose up -d
   sleep 20
   docker compose ps
   curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | "\(.labels.job)\t\(.health)\t\(.lastError)"'
   ```

   `docker compose config -q` проверяет файл и молчит, если ошибок нет. Ожидаемый вывод (порядок строк может отличаться):

   ```text
   cadvisor	up	
   grafana	up	
   node-exporter	up	
   notes	up	
   prometheus	up	
   ```

   **Как читать вывод:** `up` значит, что Prometheus забрал и разобрал `/metrics` цели. Пустая последняя колонка это «ошибок нет». Открой `http://localhost:9090/targets` и найди те же пять целей. На удалённом сервере пробрось порт: `ssh -L 9090:localhost:9090 <сервер>`.

   **Типичные ошибки:**
   - `network notes-net declared as external, but could not be found`: основной стек «Заметок» не запущен. Выполни `docker compose up -d notes db` в `~/notes` (без прокси, см. раздел «Стенд Compose и kind вместе не живут» на [странице плана](sre.md)) и повтори. Сеть `notes-net` исчезает вместе с основным стеком, если сделать там `docker compose down`: тот же запуск пересоздаёт её, и только после этого поднимай остальные стеки.
   - Цель `notes` в состоянии `down` с ошибкой `server returned HTTP status 404 Not Found`: у «Заметок» версия до 0.5.0, пути `/metrics` ещё нет. Пройди задание 3 урока 8.2.
   - `Bind for 127.0.0.1:9090 failed: port is already allocated`: порт занят. Найди владельца: `ss -ltnp | grep 9090`.
   - `docker compose up` падает из-за `/dev/kmsg`: на хосте нет такого устройства. Убери блок `devices` у cAdvisor, он работает и без него (в логе будет предупреждение про OOM-события).

2. Убедись, что приложение отдаёт настоящие метрики, и запомни имена, они понадобятся в следующих заданиях:

   ```bash
   curl -s localhost:8080/metrics | grep -E '^notes_http_requests_total|^notes_http_request_duration_seconds_count' | head
   ```

   Должны быть строки вроде `notes_http_requests_total{path="/notes",status="200"} 1234`. Если порт 8080 у тебя не опубликован, смотри через Prometheus: в интерфейсе выполни `notes_http_requests_total`.

3. Дашборды Node Exporter Full и cAdvisor кладутся в provisioning как файлы JSON, а не импортируются по ID вручную: так стек поднимается из репозитория без кликов. Скачай JSON со страниц [Node Exporter Full (ID 1860)](https://grafana.com/grafana/dashboards/1860) и [cAdvisor (ID 14282)](https://grafana.com/grafana/dashboards/14282) кнопкой Download JSON и положи в `grafana/dashboards/`. Если в файле встречается `${DS_PROMETHEUS}`, замени это на uid источника:

   ```bash
   sed -i 's/${DS_PROMETHEUS}/prometheus/g' grafana/dashboards/*.json
   docker compose restart grafana
   ```

   Открой `http://localhost:3000` (логин `admin`, пароль из `.env`) и найди папку SRE.

4. Создай свой дашборд с шестью панелями: CPU%, Memory%, Disk I/O, Network In/Out, перезапуски контейнеров, доля ошибок HTTP. Запросы бери из метрик, которые видишь в Prometheus. Для перезапусков подойдёт `changes(container_start_time_seconds{name!=""}[1h])`: сколько раз за час менялось время старта контейнера.

---

### Задание 1.2. SLI, SLO и бюджет ошибок (2 ч)

**Что получится на экране:** в Prometheus появятся новые метрики `job:slo_burn_rate:rate1h` и другие, через 10 минут загорится алерт `SloBurnRateFast`, а на дашборде будет четыре панели бюджета ошибок.

**Что делаешь:** строишь рамку надёжности для «Заметок» на их реальных метриках. SLI (Service Level Indicator) это измеряемый показатель качества, SLO (Service Level Objective) это цель по нему, бюджет ошибок это сколько брака можно допустить ([урок 8.1](../08-observability/01-observability-slo.md)). Здесь взята учебная цель 99,9% за 30 дней: бюджет 0,1% запросов, то есть около 43,2 минуты полной недоступности в месяц (30 × 24 × 60 × 0,001).

**Шаг 1. Проверь, что метрики есть** (в Prometheus, Graph):

```promql
sum(rate(notes_http_requests_total{job="notes"}[5m]))
```

Должно вернуться число запросов в секунду (около 5, это работает генератор нагрузки).

**Шаг 2. Запиши SLO в файл.** Это документ для людей, Prometheus его не читает. Для задержки SLI берётся как доля быстрых запросов, а не квантиль: так цель честнее считается по окну.

```yaml
# ~/sre-bootstrap/monitoring/slo-definitions.yml
slos:
  - name: notes-availability
    description: "99.9% запросов к Заметкам без ответа 5xx за скользящие 30 дней"
    sli_query: >
      1 - (
        sum(rate(notes_http_requests_total{job="notes",status=~"5.."}[5m]))
        / sum(rate(notes_http_requests_total{job="notes"}[5m]))
      )
    target: 0.999
    window: 30d
    error_budget_minutes: 43.2   # 30 * 24 * 60 * (1 - 0.999)

  - name: notes-latency
    description: "99% запросов быстрее 0.5 секунды за 30 дней"
    sli_query: >
      sum(rate(notes_http_request_duration_seconds_bucket{job="notes",le="0.5"}[5m]))
      / sum(rate(notes_http_request_duration_seconds_count{job="notes"}[5m]))
    target: 0.99
    window: 30d
```

Корзина `le="0.5"` в гистограмме «Заметок» существует (список корзин задан в [уроке 8.2](../08-observability/02-prometheus-basics.md)). Для графика задержки на дашборде оставь квантиль, но обязательно с `sum by (le)`, иначе ряды разных путей не сложатся:

```promql
histogram_quantile(0.99, sum by (le) (rate(notes_http_request_duration_seconds_bucket{job="notes"}[5m])))
```

**Шаг 3. Recording rules.** Recording rule это правило, которое считает запрос заранее и сохраняет результат как новую метрику: алертам и панелям не нужно каждый раз пересчитывать тяжёлое выражение. Они нужны до алертов из шага 4.

В числителе стоит `or`: если за окно не было ни одной ошибки, ряда с 5xx просто нет, и деление дало бы «нет данных» вместо честного нуля. Выражение `A or B * 0` добавляет ряд со значением 0 из всех запросов, когда ряда ошибок нет. А когда трафика нет совсем, деление 0 на 0 даёт `NaN` (не число): сравнение с порогом при этом ложно, алерт не срабатывает, а на графике просто разрыв.

```yaml
# ~/sre-bootstrap/monitoring/prometheus/rules/slo_recording_rules.yml
groups:
  - name: slo_recording
    interval: 30s
    rules:
      # доля ошибок по окнам (1 = 100% ошибок)
      - record: job:http_error_ratio:rate5m
        expr: >
          (
            sum by (job) (rate(notes_http_requests_total{job="notes",status=~"5.."}[5m]))
            or sum by (job) (rate(notes_http_requests_total{job="notes"}[5m])) * 0
          )
          / sum by (job) (rate(notes_http_requests_total{job="notes"}[5m]))

      - record: job:http_error_ratio:rate1h
        expr: >
          (
            sum by (job) (rate(notes_http_requests_total{job="notes",status=~"5.."}[1h]))
            or sum by (job) (rate(notes_http_requests_total{job="notes"}[1h])) * 0
          )
          / sum by (job) (rate(notes_http_requests_total{job="notes"}[1h]))

      - record: job:http_error_ratio:rate6h
        expr: >
          (
            sum by (job) (rate(notes_http_requests_total{job="notes",status=~"5.."}[6h]))
            or sum by (job) (rate(notes_http_requests_total{job="notes"}[6h])) * 0
          )
          / sum by (job) (rate(notes_http_requests_total{job="notes"}[6h]))

      # burn rate = доля ошибок / (1 - SLO). Для SLO 99.9% знаменатель 0.001
      - record: job:slo_burn_rate:rate5m
        expr: job:http_error_ratio:rate5m / 0.001

      - record: job:slo_burn_rate:rate1h
        expr: job:http_error_ratio:rate1h / 0.001

      - record: job:slo_burn_rate:rate6h
        expr: job:http_error_ratio:rate6h / 0.001

  # Длинные окна считаем реже: 30 дней за каждые 30 секунд было бы расточительно
  - name: slo_recording_long
    interval: 5m
    rules:
      - record: job:http_error_ratio:rate24h
        expr: >
          (
            sum by (job) (rate(notes_http_requests_total{job="notes",status=~"5.."}[24h]))
            or sum by (job) (rate(notes_http_requests_total{job="notes"}[24h])) * 0
          )
          / sum by (job) (rate(notes_http_requests_total{job="notes"}[24h]))

      - record: job:http_error_ratio:rate30d
        expr: >
          (
            sum by (job) (rate(notes_http_requests_total{job="notes",status=~"5.."}[30d]))
            or sum by (job) (rate(notes_http_requests_total{job="notes"}[30d])) * 0
          )
          / sum by (job) (rate(notes_http_requests_total{job="notes"}[30d]))
```

Проверь файл до перезагрузки:

```bash
docker compose exec prometheus promtool check rules /etc/prometheus/rules/slo_recording_rules.yml
```

Должно вывести `SUCCESS: 8 rules found`.

**Шаг 4. Алерты multi-window multi-burn-rate.** Идея из SRE Workbook: алерт срабатывает, когда бюджет сгорает быстро и в длинном, и в коротком окне одновременно (зачем два окна, разобрано в [уроке 8.11](../08-observability/11-reliability-patterns-burn-rate.md)). Расчёт, который нужен для порогов: месяц это 720 часов, при burn rate 1 весь бюджет уходит ровно за 720 часов, при burn rate B уходит за `720 / B` часов.

- Burn rate 14,4: бюджет кончится за 720 / 14,4 = 50 часов, и за один час уходит 14,4 / 720 = 2% месячного бюджета.
- Burn rate 3: бюджет кончится за 30 / 3 = 10 суток.

Для справки, пороги из SRE Workbook:

| Burn rate | Окна (длинное и короткое) | Доля бюджета | Что делать |
|-----------|---------------------------|--------------|------------|
| 14,4 | 1 час и 5 минут | 2% за час | page (будим дежурного) |
| 6 | 6 часов и 30 минут | 5% за 6 часов | page |
| 1 | 3 суток и 6 часов | 10% за 3 суток | ticket (задача на работу в часы) |

Мы делаем два уровня, а третий упрощаем: «3 на окнах 1 час и 6 часов» это учебное упрощение, не рекомендация Workbook.

```yaml
# ~/sre-bootstrap/monitoring/prometheus/rules/slo_alerts.yml
groups:
  - name: slo_burnrate_alerts
    rules:
      # Page: burn rate выше 14.4 значит 2% месячного бюджета за час.
      # Весь бюджет при таком темпе кончится примерно за 50 часов (720 / 14.4).
      - alert: SloBurnRateFast
        expr: >
          job:slo_burn_rate:rate5m > 14.4
          and
          job:slo_burn_rate:rate1h > 14.4
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "Быстрое сжигание бюджета: при таком темпе весь месячный бюджет уйдёт примерно за 50 часов (2% в час)"
          runbook: "incident/runbook-high-error-rate.md"   # файл создаёшь в задании 4.1

      # Ticket: burn rate выше 3 значит весь бюджет за 10 суток (30 / 3).
      - alert: SloBurnRateSlow
        expr: >
          job:slo_burn_rate:rate1h > 3
          and
          job:slo_burn_rate:rate6h > 3
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Медленное сжигание бюджета: при таком темпе весь месячный бюджет уйдёт примерно за 10 суток"
```

Перезагрузи Prometheus и проверь, что правила видны:

```bash
docker compose exec prometheus sh -c 'promtool check rules /etc/prometheus/rules/*.yml'
curl -s -X POST localhost:9090/-/reload
curl -s localhost:9090/api/v1/rules | jq -r '.data.groups[].name'
```

Звёздочку должна раскрыть оболочка внутри контейнера, поэтому команда в `sh -c '...'`. Ожидаемый вывод последней команды: `slo_burnrate_alerts`, `slo_recording`, `slo_recording_long`, `target_health` (порядок любой).

**Чего ждать от алерта.** Генератор нагрузки даёт 5% ошибок, это burn rate 0,05 / 0,001 = 50, то есть выше порога 14,4. Поэтому `SloBurnRateFast` загорится в течение примерно 10 минут (сначала `pending` на время `for: 2m`, затем `firing`), и это нормально: ты специально сломал SLO. Смотри в двух местах: в Prometheus на странице Alerts (`http://localhost:9090/alerts`) и в Alertmanager (`http://localhost:9093`). Чтобы алерт успокоился, увеличь `ERROR_EVERY` в `compose.yml` до 2000 (0,05% ошибок, burn rate 0,5) и выполни `docker compose up -d load`.

**Шаг 5. Дашборд бюджета ошибок** (4 панели):

```promql
# Панель 1: оставшийся бюджет, %. Верно, когда окно 30 дней накопилось:
# в первые дни это оценка по короткой истории
(1 - job:http_error_ratio:rate30d / 0.001) * 100

# Панель 2: текущий burn rate (1 час)
job:slo_burn_rate:rate1h

# Панель 3: доступность за последние 24 часа, %
(1 - job:http_error_ratio:rate24h) * 100

# Панель 4: статус SLO, линия порога на 99.9
(1 - job:http_error_ratio:rate5m) * 100
```

В панели 1 бюджет 0,001 это допустимая доля ошибок (1 - 0,999): если ошибок за 30 дней вдвое меньше допустимого, ответ 50%. Отрицательное значение значит, что бюджет перерасходован. Хранение метрик (35 дней в `compose.yml`) должно быть не меньше окна SLO, иначе `rate30d` считать не из чего.

**Типичные ошибки:**
- Панель бюджета показывает `No data`: запись `job:http_error_ratio:rate30d` считается раз в 5 минут, подожди первый цикл. Пока истории меньше 30 дней, число это оценка по тому, что накопилось.
- `SloBurnRateFast` не загорается: открой в Prometheus Graph `job:slo_burn_rate:rate1h`. Пусто значит, что ещё не накопился час данных или не запущен `load`: `docker compose ps load`.
- `promtool` ругается `unknown field`: сбился отступ в YAML или поле стоит не на своём уровне, правь по номеру строки.

---

### Задание 1.3. Alertmanager: маршрутизация (1,5 ч)

**Что получится на экране:** в Alertmanager два тестовых алерта, из них `TestWarning` помечен подавленным, а в логе `webhook` видны запросы на `/anything/critical`.

**Что делаешь:** настраиваешь маршруты, группировку и подавление ([урок 8.5](../08-observability/05-alertmanager.md)). Приёмником служит контейнер `webhook` из стека: он показывает в логе, что и куда пришло. Если захочешь Slack или Telegram, URL или токен клади в файл вне git и подключай через `api_url_file` (в Slack) или `bot_token_file` (в Telegram), а в репозитории оставляй `*.example`.

```yaml
# alertmanager/alertmanager.yml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'job']
  group_wait: 30s        # ждём 30 секунд, вдруг прилетят соседние алерты, и шлём одним сообщением
  group_interval: 5m     # о новых алертах в уже отправленной группе сообщаем не чаще
  repeat_interval: 4h    # если алерт горит, напоминаем раз в 4 часа
  receiver: 'default'
  routes:
    - matchers:
        - severity = "critical"
      receiver: 'critical'
    - matchers:
        - severity = "warning"
      receiver: 'warnings'
      group_wait: 2m     # предупреждения не спешат

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://webhook:8080/anything/default'

  - name: 'critical'
    webhook_configs:
      - url: 'http://webhook:8080/anything/critical'

  - name: 'warnings'
    webhook_configs:
      - url: 'http://webhook:8080/anything/warning'

inhibit_rules:
  # Если для сервиса горит critical, warning про тот же сервис (тот же job) не шумит.
  # Это же закрывает пару SloBurnRateFast -> SloBurnRateSlow.
  - source_matchers:
      - severity = "critical"
    target_matchers:
      - severity = "warning"
    equal: ['job']
```

**Подзадачи:**

1. Проверь конфиг и перечитай его:

   ```bash
   docker compose exec alertmanager amtool check-config /etc/alertmanager/alertmanager.yml
   curl -s -X POST localhost:9093/-/reload
   ```

   `check-config` должен вывести `SUCCESS` и перечислить найденные маршруты и получателей.

2. Проверь подавление двумя тестовыми алертами с одним `job` и разными именами. `amtool` лежит в том же образе, что и Alertmanager:

   ```bash
   docker compose exec alertmanager amtool --alertmanager.url=http://localhost:9093 \
     alert add alertname=TestCritical severity=critical job=notes \
     --annotation=summary="тест critical"
   docker compose exec alertmanager amtool --alertmanager.url=http://localhost:9093 \
     alert add alertname=TestWarning severity=warning job=notes \
     --annotation=summary="тест warning"
   ```

   Подожди около минуты и посмотри:

   ```bash
   docker compose exec alertmanager amtool --alertmanager.url=http://localhost:9093 alert query
   docker compose exec alertmanager amtool --alertmanager.url=http://localhost:9093 alert query --inhibited
   ```

   **Как читать вывод:** первая команда показывает активные алерты, и `TestWarning` в ней нет. Вторая показывает подавленные: там именно `TestWarning`. В интерфейсе `http://localhost:9093` тот же алерт помечен как подавленный (suppressed/inhibited). Если warning остался активным, проверь, что у обоих алертов совпадает значение `job` (правило сравнивает его через `equal`).

3. Посмотри, что дошло до приёмника: `docker compose logs webhook | tail`. В логе должны быть запросы на `/anything/critical` и `/anything/default`.

4. Придумай ещё одно правило подавления для типичного сценария. Например: если упал весь сервер (алерт `up{job="node-exporter"} == 0`, по образцу `TargetDown` из задания 1.1), не присылать остальное с того же сервера. Для этого к целям в `prometheus.yml` нужна общая метка (например, `host: lab1`), и правило сравнивает именно её через `equal: ['host']`, а не `instance`: у каждого сервиса своя пара «адрес:порт», и по `instance` ничего не совпадёт.

**Типичные ошибки:**
- `unable to parse ... yaml: line N` в `check-config`: сбился отступ. Правь по номеру строки.
- Уведомлений нет: сначала `docker compose logs alertmanager`, потом Status → Config в интерфейсе Alertmanager (видно, какой конфиг реально загружен).
- После правки конфига ничего не изменилось: не выполнен `/-/reload` или правка в другом файле (смонтирован каталог `./alertmanager`).

---

### Задание 1.4. Grafana Alerting (1,5 ч)

**Что получится на экране:** в Grafana в разделе Alerting три правила, а когда правило срабатывает, в `docker compose logs webhook` появляется запрос на `/anything/grafana`.

**Что делаешь:** настраиваешь Unified Alerting Grafana (не устаревший legacy) с Contact Points и Notification Policies. Это второй механизм алертов рядом с Prometheus: он полезен, когда нужен алерт по данным из нескольких источников.

**Практика:**

1. Grafana → Alerting → Contact Points → Add: тип Webhook, адрес `http://webhook:8080/anything/grafana`.
2. Notification Policies: группировка по метке `severity`.
3. Создай три правила в интерфейсе Grafana:
   - `HighCPU`: `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 80`
   - `HighMemory`: `(1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes) * 100 > 85`
   - `HighErrorRate`: `job:http_error_ratio:rate5m > 0.05` (нужны recording rules из задания 1.2)
4. Сохрани дашборды в JSON для хранения в git. Пароль берётся из `.env`, в терминал не печатается:

   ```bash
   cd ~/sre-bootstrap/monitoring
   set -a; source .env; set +a
   mkdir -p grafana/dashboards-export

   curl -s -u "admin:${GRAFANA_ADMIN_PASSWORD}" "http://localhost:3000/api/search?type=dash-db" |
     jq -r '.[].uid' |
   while read -r uid; do
     curl -s -u "admin:${GRAFANA_ADMIN_PASSWORD}" "http://localhost:3000/api/dashboards/uid/${uid}" |
       jq '.dashboard' > "grafana/dashboards-export/${uid}.json"
     echo "Exported: ${uid}"
   done
   ```

   Должно появиться по файлу на каждый дашборд.
5. Проверь, что уведомление доходит. В Contact Points нажми Test у своей точки: затем смотри `docker compose logs webhook | grep grafana`. Должна быть строка с запросом `POST /anything/grafana`. Правило можно сработать и по-настоящему: временно поставь порог `HighErrorRate` на `> 0.01` (генератор даёт 5%), через пару минут правило перейдёт в Firing, и в логе появится новый запрос.

**Типичные ошибки:**
- Test даёт ошибку `connection refused`: в адресе стоит `localhost`. Из контейнера Grafana приёмник виден по имени `webhook`.
- В правиле `No data`: выбран не тот источник данных, должен быть `Prometheus` из provisioning.
- Правило сработало, но в логе `webhook` пусто: правило не попало в политику с твоей контактной точкой. Проверь Notification Policies: по умолчанию уведомление идёт в контактную точку по умолчанию, а не в твою.

---

Назад: [План и подготовка](sre.md). Дальше: [День 2](sre-day2.md).
