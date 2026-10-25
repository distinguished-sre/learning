---
layout: page
title: "ТЗ для SRE, день 2"
description: "Логи, Kubernetes и API-шлюз. Часть технического задания для SRE."
---

> Это день 2 из 4 [технического задания для SRE](sre.md). Слова, схема стенда и подготовка описаны на странице плана.

## День 2. Логи, Kubernetes и API-шлюз

> **Зачем это на работе:** когда что-то сломалось, первым делом открывают логи и состояние подов. В этом дне ты собираешь оба инструмента и учишься защищать вход в сервис.

**Время:** около 6,5 часов (2,5 + 2,5 + 1,5).

### Сколько это весит и в каком порядке запускать

Стеки вместе тяжёлые. Ориентировочная память (точные числа сними у себя командой `docker stats --no-stream`):

| Стек | Примерно | Когда нужен |
|------|----------|-------------|
| Мониторинг (день 1) | 1 ГБ | всегда |
| ELK (задание 2.1) | 3,5 ГБ | только в задании 2.1 |
| Кластер kind | 2 ГБ | задание 2.2 |
| KrakenD и httpbin | меньше 0,2 ГБ | задание 2.3 |

Если у тебя 16 ГБ, мониторинг можно держать включённым, а ELK останавливать после задания: `cd ~/sre-bootstrap/logging && docker compose down` (данные останутся в томе). На 8 ГБ запускай по одному стеку.

Если у тебя ещё запущен стек мониторинга из темы 8, останови его: порты 9090, 9093 и 3000 совпадают со стеком из дня 1.

---

### Задание 2.1. Стек ELK (2,5 ч)

**Что получится на экране:** в Kibana (`http://localhost:5601`) список разобранных записей лога nginx с отдельными полями (адрес клиента, код ответа, путь) и дашборд из четырёх диаграмм.

**Что делаешь:** разворачиваешь Elasticsearch (хранилище и поиск по логам), Logstash (разбор и обогащение строк), Kibana (интерфейс) и Filebeat (агент, который читает логи контейнеров). В курсе то же самое делают Loki и Alloy ([урок 8.7](../08-observability/07-logs-loki-alloy.md)); здесь ты увидишь второй классический вариант.

```yaml
# ~/sre-bootstrap/logging/compose.yml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.17.4
    environment:
      - discovery.type=single-node
      # Защита выключена только для учебного стенда. В проде включают xpack.security и TLS.
      - xpack.security.enabled=false
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - es_data:/usr/share/elasticsearch/data
    ports: ["127.0.0.1:9200:9200"]   # только с этой машины
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:9200/_cluster/health | grep -qE '\"status\":\"(green|yellow)\"'"]
      interval: 10s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  logstash:
    image: docker.elastic.co/logstash/logstash:8.17.4
    environment:
      - "LS_JAVA_OPTS=-Xms256m -Xmx256m"
    depends_on:
      elasticsearch:
        condition: service_healthy   # стартуем, когда ES готов
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline:ro
    ports: ["127.0.0.1:9600:9600"]
    restart: unless-stopped

  kibana:
    image: docker.elastic.co/kibana/kibana:8.17.4
    depends_on:
      elasticsearch:
        condition: service_healthy
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    ports: ["127.0.0.1:5601:5601"]
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:5601/api/status | grep -q '\"level\":\"available\"'"]
      interval: 15s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  filebeat:
    image: docker.elastic.co/beats/filebeat:8.17.4
    depends_on:
      - logstash
    user: root
    volumes:
      - ./filebeat/filebeat.yml:/usr/share/filebeat/filebeat.yml:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    command: filebeat -e -strict.perms=false
    restart: unless-stopped

  # Источник логов: nginx с меткой collect_logs. Filebeat собирает только контейнеры с этой меткой.
  nginx:
    image: nginx:1.30-alpine
    labels:
      collect_logs: "true"
    ports: ["127.0.0.1:8082:80"]
    restart: unless-stopped

  # Образец логов с публичными адресами: с адресов 127.0.0.1 и 172.x GeoIP ничего не определит,
  # поэтому раз в 5 секунд пишем строку формата nginx combined с настоящими адресами.
  weblog-sample:
    image: busybox:1.37.0
    labels:
      collect_logs: "true"
    command:
      - sh
      - -c
      - |
        while true; do
          for ip in 8.8.8.8 77.88.8.8 1.1.1.1; do
            echo "$$ip - - [$$(date -u '+%d/%b/%Y:%H:%M:%S +0000')] \"GET /index.html HTTP/1.1\" 200 612 \"-\" \"curl/8.5.0\""
          done
          echo "8.8.8.8 - - [$$(date -u '+%d/%b/%Y:%H:%M:%S +0000')] \"GET /missing HTTP/1.1\" 404 153 \"-\" \"curl/8.5.0\""
          sleep 5
        done
    restart: unless-stopped

volumes:
  es_data:
```

Компоненты по ролям: Filebeat читает файлы логов Docker и отправляет строки в Logstash; Logstash разбирает строку на поля; Elasticsearch хранит и индексирует; Kibana показывает. Контейнеры, у которых нет метки `collect_logs`, Filebeat пропускает. Версии в файле зафиксированы на момент написания, перед работой сверь актуальные в [списке релизов Elastic](https://www.elastic.co/downloads/past-releases).

**Практические подзадачи:**

1. Напиши **конвейер Logstash** для разбора access-логов nginx. **Grok** это язык шаблонов, которым строка лога разбирается на именованные поля (`%{ШАБЛОН:поле}`). Готовый шаблон `COMBINEDAPACHELOG` подходит и nginx, потому что формат `combined` у них общий. Параметр `ecs_compatibility => disabled` нужен, чтобы поля назывались по-старому (`clientip`, `response`, `bytes`): иначе Logstash 8 назовёт их по схеме ECS (`source.address`, `http.response.status_code`), и дальше по тексту имена не совпадут.

   <details markdown="1">
   <summary>logstash/pipeline/nginx.conf</summary>

   ```ruby
   # logstash/pipeline/nginx.conf
   input {
     beats { port => 5044 }
   }
   filter {
     if [fields][log_type] == "nginx" {
       grok {
         match => { "message" => "%{COMBINEDAPACHELOG}" }
         ecs_compatibility => disabled
       }
       date {
         match => ["timestamp", "dd/MMM/yyyy:HH:mm:ss Z"]
         target => "@timestamp"
       }
       geoip {
         source => "clientip"
         target => "geoip"
         ecs_compatibility => disabled
       }
       mutate {
         convert => {
           "response" => "integer"
           "bytes"    => "integer"
         }
         remove_field => ["message", "timestamp"]
       }
     }
   }
   output {
     # data stream: индекс сам делится на части и подчиняется политике жизненного цикла
     elasticsearch {
       hosts => ["elasticsearch:9200"]
       data_stream => true
       data_stream_type => "logs"
       data_stream_dataset => "nginx"
       data_stream_namespace => "lab"
     }
   }
   ```

   </details>

   Что делает каждый блок: `date` берёт время из строки лога и ставит его в `@timestamp`, чтобы события лежали по реальному времени, а не по времени приёма; `geoip` по адресу клиента определяет страну и координаты; `mutate` превращает код ответа и размер из строк в числа, чтобы по ним можно было считать и фильтровать.

2. **Шаблон индекса и политика жизненного цикла (ILM, Index Lifecycle Management).** Логи копятся постоянно, и хранить их вечно нельзя: ILM переводит старые данные в более дешёвое состояние и в конце удаляет. Фазы: `hot` (данные свежие, в них пишут, раз в 7 дней индекс обновляется на новый, это `rollover`), `warm` (данные только читают, их сжимают), `delete` (удаляем через 90 дней). Выполни в Kibana → Dev Tools. Первая команда создаёт политику, вторая шаблон для data stream `logs-nginx-lab` с политикой и типом `geo_point` для координат (без него Kibana не нарисует карту):

   <details markdown="1">
   <summary>Dev Tools: ILM-политика и шаблон</summary>

   ```json
   PUT _ilm/policy/nginx-logs-policy
   {
     "policy": {
       "phases": {
         "hot":    { "min_age": "0ms", "actions": { "rollover": { "max_age": "7d" }, "set_priority": { "priority": 100 } } },
         "warm":   { "min_age": "7d",  "actions": { "forcemerge": { "max_num_segments": 1 }, "set_priority": { "priority": 50 } } },
         "delete": { "min_age": "90d", "actions": { "delete": {} } }
       }
     }
   }

   PUT _index_template/logs-nginx
   {
     "index_patterns": ["logs-nginx-*"],
     "data_stream": {},
     "priority": 500,
     "template": {
       "settings": { "index.lifecycle.name": "nginx-logs-policy" },
       "mappings": {
         "properties": {
           "geoip": { "properties": { "location": { "type": "geo_point" } } }
         }
       }
     }
   }
   ```

   </details>

   Создай шаблон до того, как первые события придут в Elasticsearch: тип поля после появления данных не изменить. Если Logstash уже успел создать data stream без шаблона, удали его (`DELETE _data_stream/logs-nginx-lab`) и дай событиям прийти снова.

3. **Filebeat с автоопределением контейнеров** (autodiscover: агент сам находит новые контейнеры с нужной меткой):

   ```yaml
   # filebeat/filebeat.yml
   filebeat.autodiscover:
     providers:
       - type: docker
         templates:
           - condition:
               contains:
                 docker.container.labels.collect_logs: "true"
             config:
               - type: container
                 paths:
                   - /var/lib/docker/containers/${data.docker.container.id}/*.log
                 fields:
                   log_type: nginx
                 fields_under_root: false

   output.logstash:
     hosts: ["logstash:5044"]
   ```

4. Подними стек, создай трафик и проверь, что документы дошли:

   ```bash
   cd ~/sre-bootstrap/logging
   docker compose up -d
   docker compose ps
   for i in $(seq 20); do curl -s -o /dev/null localhost:8082/; done
   sleep 30
   curl -s 'localhost:9200/logs-nginx-lab/_search?size=1&pretty'
   ```

   Ожидаемый ответ, сокращённо (значения примерные):

   ```json
   {
     "hits" : {
       "total" : { "value" : 24, "relation" : "eq" },
       "hits" : [ {
         "_index" : ".ds-logs-nginx-lab-2026.10.26-000001",
         "_source" : {
           "@timestamp" : "2026-10-26T10:00:05.000Z",
           "clientip" : "8.8.8.8",
           "verb" : "GET",
           "request" : "/index.html",
           "response" : 200,
           "bytes" : 612,
           "geoip" : { "country_name" : "United States", "location" : { "lat" : 37.751, "lon" : -97.822 } },
           "fields" : { "log_type" : "nginx" }
         }
       } ]
     }
   }
   ```

   **Как читать вывод:** `hits.total.value` это сколько документов нашлось. В `_source` должны быть **разобранные** поля: `clientip`, `response` числом, `geoip.location`. Для запросов `curl` с твоей машины `geoip` пустой: адрес 172.x частный, GeoIP его не знает; карту будут рисовать строки из `weblog-sample` с публичными адресами. Проверь политику: `curl -s 'localhost:9200/_data_stream/logs-nginx-lab?pretty'` показывает привязанную политику, а в Dev Tools команда `GET .ds-logs-nginx-lab-*/_ilm/explain` показывает фазу, в которой сейчас индекс (ожидается `hot`).

   **Типичные ошибки:**
   - В документах нет полей, есть только `message` и тег `_grokparsefailure`: шаблон не подошёл к строке. Проверь формат лога и что в grok указан `ecs_compatibility => disabled`.
   - `response` строкой, а не числом, или нет `clientip`: фильтр `mutate` не сработал, потому что имена полей не те (ECS-режим вместо отключённого).
   - Документов нет вообще: `docker compose logs filebeat | tail` покажет, видит ли он контейнеры; `docker compose logs logstash | tail` покажет, дошла ли строка до конвейера.
   - Контейнер Kibana долго `starting`: это нормально до двух минут, подожди.

5. Создай **дашборд Kibana** с четырьмя визуализациями (сначала Stack Management → Data Views → создай data view `logs-nginx-lab`):
   - Распределение кодов ответа (круговая диаграмма по `response`).
   - Топ-10 запрашиваемых адресов (столбцы по `request.keyword`).
   - Доля ошибок во времени (линия с фильтром `response >= 400`).
   - Карта (Maps → слой Documents → поле `geoip.location`).

---

### Задание 2.2. Kubernetes: рабочие приёмы (2,5 ч)

**Что получится на экране:** `kubectl get pods -n production` показывает работающие поды, запрос на `/demo` проходит через шлюз, при частых запросах часть ответов `429`, а под нагрузкой `kubectl get hpa` добавляет реплики.

> Используется кластер kind `notes` из темы 5. Проверь его: `kind get clusters` (должен быть `notes`) и `kubectl get nodes` (узлы `Ready`). Если metrics-server не стоит (`kubectl top nodes` отвечает ошибкой), поставь его по [уроку 5.11](../05-kubernetes/11-scaling-hpa.md): без него HPA не получает цифры. Minikube и правка `/etc/hosts` не нужны: вход в кластер идёт через порт 80 компьютера, который проброшен в kind ([урок 5.4](../05-kubernetes/04-ingress-gateway.md)). Имя `notes.lab` в командах ниже подставляет `curl --resolve`.

**Практика 1. Namespace и тестовое приложение.** Namespace это логическая папка внутри кластера. Здесь создаём `production`, как называют боевое окружение (в учебном кластере он, конечно, тоже учебный).

```bash
kubectl create namespace production
```

Меток `prometheus.io/*` в манифесте нет: у nginx нет эндпоинта `/metrics`, а такие метки без отдельной настройки сбора Prometheus просто игнорирует.

```yaml
# kubernetes/app-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: demo-app
  template:
    metadata:
      labels:
        app: demo-app
    spec:
      containers:
        - name: demo-app
          image: nginx:1.30-alpine   # слушает порт 80
          ports:
            - containerPort: 80
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          livenessProbe:        # живой ли процесс: если нет, Kubernetes перезапустит контейнер
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3
          readinessProbe:       # готов ли принимать трафик: если нет, под выводится из раздачи
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: demo-app
  namespace: production
spec:
  selector:
    app: demo-app
  ports:
    - port: 80
      targetPort: 80
```

```bash
kubectl apply -f kubernetes/app-deployment.yml
kubectl get pods -n production --watch
```

Остановить наблюдение Ctrl+C. Ожидаемый результат через полминуты:

```text
NAME                       READY   STATUS    RESTARTS   AGE
demo-app-6d9f7c8b5-4kq2x   1/1     Running   0          35s
demo-app-6d9f7c8b5-7mzt9   1/1     Running   0          35s
demo-app-6d9f7c8b5-xv8wj   1/1     Running   0          35s
```

**Как читать вывод:** `READY 1/1` значит, что единственный контейнер пода прошёл readiness-пробу. `STATUS Running` и `RESTARTS 0`: контейнер не падал. Проверь приложение через временный туннель: `kubectl -n production port-forward svc/demo-app 8088:80` в одном терминале и `curl -sI localhost:8088 | head -1` в другом, ожидается `HTTP/1.1 200 OK`.

**Практика 2. Вход и ограничение частоты запросов через Gateway API.** Ingress-контроллер ingress-nginx закрыт и не получает исправлений, поэтому в курсе вход построен на Gateway API, подробности в [уроке 5.4](../05-kubernetes/04-ingress-gateway.md). Сделаем так: маршрут `HTTPRoute` в namespace `notes` направляет путь `/demo` на сервис в `production` (для такого перехода нужно разрешение, `ReferenceGrant`, см. тот же урок), а политика `BackendTrafficPolicy` Envoy Gateway ограничивает 10 запросов в секунду.

```yaml
# kubernetes/demo-route.yml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: ReferenceGrant
metadata:
  name: allow-notes-routes
  namespace: production          # разрешение выдаёт тот, чей сервис выставляют наружу
spec:
  from:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      namespace: notes
  to:
    - group: ""
      kind: Service
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: demo
  namespace: notes
spec:
  parentRefs:
    - name: notes-gw
  hostnames: ["notes.lab"]
  rules:
    - matches:
        - path: { type: PathPrefix, value: /demo }
      filters:
        - type: URLRewrite
          urlRewrite:
            path: { type: ReplacePrefixMatch, replacePrefixMatch: / }
      backendRefs:
        - name: demo-app
          namespace: production
          port: 80
---
apiVersion: gateway.envoyproxy.io/v1alpha1
kind: BackendTrafficPolicy
metadata:
  name: demo-ratelimit
  namespace: notes
spec:
  targetRefs:
    - group: gateway.networking.k8s.io
      kind: HTTPRoute
      name: demo
  rateLimit:
    type: Local
    local:
      rules:
        - limit:
            requests: 10
            unit: Second
```

```bash
kubectl apply -f kubernetes/demo-route.yml
kubectl -n notes get httproute demo -o jsonpath='{.status.parents[0].conditions[*].type}{"\n"}'
for i in $(seq 30); do
  curl -s -o /dev/null -w '%{http_code}\n' --resolve notes.lab:80:127.0.0.1 http://notes.lab/demo/
done | sort | uniq -c
```

Ожидается, что в условиях маршрута есть `Accepted` и `ResolvedRefs`, а в итоговой таблице коды `200` (около десяти) и `429 Too Many Requests` (остальные). Если все ответы `200`, лимит не применился: проверь `kubectl -n notes describe backendtrafficpolicy demo-ratelimit`. Если `500` или `404`, смотри `status.conditions` маршрута (причина записана в `reason`). Объект BackendTrafficPolicy (API `gateway.envoyproxy.io/v1alpha1`) в курсе не разбирается: сверь поле `rateLimit` с документацией Envoy Gateway 1.9.2 или той версии, которую ты поставил.

**Практика 3. Автомасштабирование (HPA).** Horizontal Pod Autoscaler добавляет и убирает поды по нагрузке.

```yaml
# kubernetes/hpa.yml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: demo-app-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: demo-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: AverageValue
          averageValue: 200Mi
```

**Практика 4. Нагрузка и наблюдение за масштабированием.**

```bash
kubectl apply -f kubernetes/hpa.yml

# Нагрузка из пода busybox внутри кластера
kubectl run load-generator --image=busybox:1.36 --restart=Never -n production \
  -- sh -c "while true; do wget -q -O- http://demo-app.production.svc.cluster.local; done"

# В другом терминале:
kubectl get hpa demo-app-hpa -n production --watch

# Остановить нагрузку:
kubectl delete pod load-generator -n production
```

В выводе `kubectl get hpa` смотри колонку `TARGETS`: сначала `<unknown>/70%` (первые секунды это норма), затем число, и когда CPU выше 70%, растёт `REPLICAS`. Если `<unknown>` держится дольше минуты, нет metrics-server или у пода не заданы `requests`.

**Типичные ошибки:**
- `HTTPRoute` без условия `Accepted` или с `ResolvedRefs: False`: Gateway `notes-gw` не принимает маршрут или нет `ReferenceGrant` в `production`. Смотри `kubectl -n notes describe httproute demo`.
- `curl` отвечает `404` на `/demo/`: маршрут принят, но Gateway слушает другой хост. Проверь `hostnames` и `--resolve notes.lab:80:127.0.0.1`.
- `curl` не соединяется с портом 80: прокси Compose остановлен не до конца или кластер создан без проброса 80. См. раздел «Стенд Compose и kind вместе не живут» на [странице плана](sre.md).
- Поды в `ImagePullBackOff` на `nginx:1.30-alpine`: у кластера нет доступа в интернет или Docker Hub ограничил запросы. Подожди или загрузи образ в кластер: `kind load docker-image nginx:1.30-alpine --name notes`.

---

### Задание 2.3. API-шлюз KrakenD (1,5 ч)

**Что получится на экране:** запросы к `localhost:8090/api/v1/get` проходят, а после пятого за секунду получают `429`; в Prometheus появляется цель `krakend` в состоянии `up`.

**Что делаешь:** ставишь KrakenD перед тестовым сервисом. **API-шлюз** это единая точка входа перед набором сервисов: на ней в одном месте ограничивают частоту запросов, задают таймауты, защищают от падающего бэкенда и собирают метрики, вместо того чтобы повторять всё это в каждом сервисе. Метрики KrakenD отправляет в Prometheus из дня 1.

KrakenD живёт в сети `notes-net`, поэтому Prometheus находит его по имени.

```yaml
# ~/sre-bootstrap/monitoring/krakend/compose.yml
services:
  krakend:
    image: krakend:2.10   # официальный образ; точную 2.x-версию сверь на Docker Hub
    volumes:
      - ./krakend.json:/etc/krakend/krakend.json:ro
    ports:
      - "127.0.0.1:8090:8090"   # шлюз
      - "127.0.0.1:9091:9091"   # метрики для Prometheus
    command: ["run", "-c", "/etc/krakend/krakend.json"]
    restart: unless-stopped

  # Простой бэкенд для проверки ограничения частоты и размыкателя цепи (внутренний порт 8080).
  httpbin:
    image: mccutchen/go-httpbin:2.18.3
    restart: unless-stopped

networks:
  default:
    name: notes-net
    external: true
```

<details markdown="1">
<summary>krakend.json</summary>

```json
{
  "$schema": "https://www.krakend.io/schema/v2.10/krakend.json",
  "version": 3,
  "name": "SRE Demo Gateway",
  "port": 8090,
  "timeout": "3000ms",
  "endpoints": [
    {
      "endpoint": "/api/v1/get",
      "method": "GET",
      "timeout": "2000ms",
      "backend": [
        {
          "url_pattern": "/get",
          "host": ["http://httpbin:8080"],
          "extra_config": {
            "qos/circuit-breaker": {
              "interval": 60,
              "timeout": 10,
              "max_errors": 5,
              "log_status_change": true
            }
          }
        }
      ],
      "extra_config": {
        "qos/ratelimit/router": {
          "max_rate": 20,
          "client_max_rate": 5,
          "strategy": "ip"
        }
      }
    },
    {
      "endpoint": "/api/v1/status/{code}",
      "method": "GET",
      "backend": [
        {
          "url_pattern": "/status/{code}",
          "host": ["http://httpbin:8080"]
        }
      ]
    }
  ],
  "extra_config": {
    "telemetry/opentelemetry": {
      "service_name": "krakend-gateway",
      "metric_reporting_period": 1,
      "exporters": {
        "prometheus": [
          { "name": "local_prometheus", "port": 9091, "process_metrics": true }
        ]
      }
    }
  }
}
```

</details>

Что здесь важно. `"port": 8090` обязателен: по умолчанию KrakenD слушает 8080, а мы пробросили 8090. Ограничение частоты (`qos/ratelimit/router`) стоит на уровне эндпоинта: не больше 5 запросов в секунду с одного IP. Размыкатель цепи (`qos/circuit-breaker`) относится к бэкенду и потому стоит в его `extra_config`: после 5 ошибок подряд KrakenD на 10 секунд перестаёт ходить в бэкенд и отвечает ошибкой сразу.

Сначала проверь конфиг, потом запускай:

```bash
cd ~/sre-bootstrap/monitoring/krakend
docker run --rm -v "$PWD/krakend.json:/etc/krakend/krakend.json:ro" krakend:2.10 check -c /etc/krakend/krakend.json
docker compose up -d
curl -s localhost:9091/metrics | grep -i krakend | head
```

`krakend check` должен закончиться строкой вроде `Syntax OK!`. Имена метрик в последней команде бери из своего вывода: они зависят от версии KrakenD, и в запросах Grafana используй именно их.

Проверь ограничение частоты:

```bash
for i in $(seq 10); do curl -s -o /dev/null -w "%{http_code}\n" localhost:8090/api/v1/get; done
```

Ожидается: первые 5–6 ответов `200`, затем `429 Too Many Requests`. Оговорка: если запросы идут реже лимита (медленный терминал, пауза), `429` не появится, лимит измеряется в секунду.

Добавь KrakenD и в `prometheus.yml` (рядом с остальными задачами), проверь и перезагрузи:

```yaml
  - job_name: krakend
    static_configs:
      - targets: ["krakend:9091"]
```

```bash
cd ~/sre-bootstrap/monitoring
docker compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
curl -s -X POST localhost:9090/-/reload
curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | select(.labels.job=="krakend") | .health'
```

Ожидается `up`.

**Типичные ошибки:**
- Цель `krakend` в состоянии `down`, ошибка `lookup krakend ... no such host`: Prometheus и KrakenD в разных сетях. Оба compose-файла должны содержать блок `networks` с `notes-net`. Проверка: `docker network inspect notes-net | jq '.[0].Containers[].Name'`.
- `connection refused` на порту 9091: в `krakend.json` нет блока `telemetry/opentelemetry` или он с ошибкой. Смотри `docker compose -f krakend/compose.yml logs krakend`.
- Адрес `host.docker.internal` в Linux без дополнительной настройки не работает. Если нужен именно он, добавь у Prometheus `extra_hosts: ["host.docker.internal:host-gateway"]`.

**Подзадачи:**
1. Создай дашборд Grafana для KrakenD (3 панели): запросы в секунду по эндпоинтам, доля ошибок, задержка p99. Метрики бери из реального `curl :9091/metrics`.
2. Проверь размыкатель цепи: `docker compose -f ~/sre-bootstrap/monitoring/krakend/compose.yml stop httpbin`, затем несколько запросов к `localhost:8090/api/v1/get`. Ответ сначала ошибочный из-за недоступного бэкенда, после нескольких ошибок шлюз отвечает ошибкой сразу, не пытаясь дойти до бэкенда (смотри `log_status_change` в логе KrakenD).
3. Верни бэкенд: `docker compose -f ~/sre-bootstrap/monitoring/krakend/compose.yml start httpbin` и убедись, что через 10 секунд запросы снова проходят.

---

Назад: [День 1](sre-day1.md). Дальше: [День 3](sre-day3.md).
