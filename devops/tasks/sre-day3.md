---
layout: page
title: "ТЗ для SRE, день 3"
description: "Автоматизация, CI/CD и PostgreSQL. Часть технического задания для SRE."
---

> Это день 3 из 4 [технического задания для SRE](sre.md). Слова, схема стенда и подготовка описаны на странице плана.

## День 3. Автоматизация, CI/CD и PostgreSQL

> **Зачем это на работе:** повторяющуюся ручную работу (toil) убирают скриптами и пайплайнами, а база данных без проверенного бэкапа это риск, о котором узнают в худший день. Здесь ты соберёшь три скрипта, цикл «бэкап, восстановление, мониторинг» для PostgreSQL и пайплайн GitLab CI.

**Время:** около 6,5 часов (2 + 2 + 2,5).

---

### Задание 3.1. Скрипты против toil (2 ч)

**Что получится на экране:** три команды, после запуска каждая печатает короткий отчёт: состояние системы, результат очистки Docker и список сервисов со статусами `UP` и `DOWN`.

**Что делаешь:** пишешь три скрипта, которые заменяют команды, набираемые руками каждый день. Скрипты рассчитаны на Ubuntu 24.04 и bash 5; на macOS системный bash 3.2 не знает ассоциативных массивов, а `df` и `vmstat` отличаются. Положи их в `~/sre-bootstrap/scripts/` и сразу сделай исполняемыми:

```bash
chmod +x ~/sre-bootstrap/scripts/*.sh
```

**Скрипт 1. Отчёт о состоянии системы.** Пороги: от 80% статус `WARN`, от 90% `CRIT`. Диск смотрим без виртуальных файловых систем (`tmpfs`, `squashfs`, `overlay`), иначе в отчёт попадёт десяток записей, которые ничего не значат.

{% raw %}
```bash
#!/usr/bin/env bash
# ~/sre-bootstrap/scripts/health-report.sh
set -euo pipefail

WARN=80
CRIT=90
REPORT_FILE="${REPORT_FILE:-$HOME/sre-bootstrap/reports/health-$(date +%Y%m%d-%H%M%S).txt}"
mkdir -p "$(dirname "$REPORT_FILE")"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$REPORT_FILE"; }

# level <процент> печатает OK, WARN или CRIT
level() {
  local v=$1
  if   (( v >= CRIT )); then echo CRIT
  elif (( v >= WARN )); then echo WARN
  else echo OK
  fi
}

check_cpu() {
  # vmstat 1 2: вторая строка это среднее за последнюю секунду, колонка 15 (id) это простой процессора
  local used
  used=$(vmstat 1 2 | tail -1 | awk '{print 100 - $15}')
  log "$(level "$used") CPU: ${used}%"
}

check_memory() {
  # занято = всего минус available (то, что система может отдать приложениям)
  local used
  used=$(free | awk '/^Mem:/ {printf "%.0f", ($2 - $7) / $2 * 100}')
  log "$(level "$used") Память: ${used}%"
}

check_disk() {
  df -x tmpfs -x devtmpfs -x squashfs -x overlay --output=pcent,target | tail -n +2 |
  while read -r pct mount; do
    pct=${pct%\%}
    log "$(level "$pct") Диск ${mount}: ${pct}%"
  done
}

check_docker() {
  if ! docker info >/dev/null 2>&1; then
    log "WARN Docker недоступен (не запущен или нет прав)"
    return 0
  fi
  log "Контейнеры:"
  docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.RunningFor}}' | tee -a "$REPORT_FILE"
  docker ps --filter status=restarting --format '{{.Names}}' | while read -r name; do
    log "CRIT контейнер $name перезапускается"
  done
}

log "=== Отчёт о состоянии, $(hostname) ==="
check_cpu
check_memory
check_disk
check_docker
log "=== Конец. Файл: $REPORT_FILE ==="
```
{% endraw %}

Запусти скрипт и сравни с ожидаемым видом (числа у тебя другие):

```bash
~/sre-bootstrap/scripts/health-report.sh
```

Отчёт ещё сохраняется в `~/sre-bootstrap/reports/health-ДАТА.txt`. Если файл не нужен, укажи `REPORT_FILE=/dev/null ~/sre-bootstrap/scripts/health-report.sh`.

```text
[2026-10-26 10:15:01] OK CPU: 7%
[2026-10-26 10:15:01] OK Память: 41%
[2026-10-26 10:15:01] OK Диск /: 38%
[2026-10-26 10:15:01] OK Диск /boot/efi: 6%
[2026-10-26 10:15:01] Контейнеры:
NAMES            STATUS          RUNNING FOR
monitoring-...   Up 2 hours      2 hours ago
```

**Как читать вывод:** первое слово строки это статус. Если контейнер в статусе `restarting`, в отчёте будет отдельная строка `CRIT`.

Проверь, что скрипт умеет ругаться, а не только писать `OK`: загрузи все ядра командой `for i in $(seq "$(nproc)"); do yes > /dev/null & done`, подожди 10 секунд и запусти отчёт ещё раз. В строке CPU должно быть `WARN` или `CRIT`. Остановить нагрузку: `pkill yes`.

**Типичные ошибки:**
- `Cannot connect to the Docker daemon` или `permission denied ... docker.sock`: Docker не запущен или твой пользователь не в группе `docker`. Скрипт это переживёт (строка `WARN Docker недоступен`), но контейнеры не покажет. Лечение: `sudo systemctl start docker`, затем `sudo usermod -aG docker "$USER"` и новый вход в систему.
- `vmstat: command not found`: поставь `procps`.

**Скрипт 2. Очистка Docker.** Скрипт сначала спрашивает, показывает занятое место до и после и **не трогает тома** (volume): в томах лежат данные баз, и удаление «неиспользуемых» томов однажды уничтожит базу, которая просто была остановлена. Запускай только на учебной машине, не на проде: на чужом сервере остановленные контейнеры нужны для разбора, поэтому сначала посмотри `docker ps -a`. Сети скрипт тоже не трогает: `docker network prune` удалил бы общую сеть `notes-net`, пока все контейнеры остановлены, и после этого любой `compose up` падал бы с `network notes-net declared as external, but could not be found`.

```bash
#!/usr/bin/env bash
# ~/sre-bootstrap/scripts/docker-cleanup.sh
set -euo pipefail

echo "Будут удалены: остановленные контейнеры и образы без тегов старше 72 часов."
echo "Тома (volume) и сети не затрагиваются. Не запускай на проде."
echo "=== Остановленные контейнеры (они уйдут) ==="
docker ps -a --filter status=exited
read -r -p "Продолжить? [yes/N]: " answer
[[ "$answer" == "yes" ]] || { echo "Отмена."; exit 0; }

echo "=== До ==="
docker system df

docker container prune -f
docker image prune -f --filter "until=72h"

echo "=== После ==="
docker system df
```

**Скрипт 3. Проверка доступности сервисов.** Ассоциативные массивы требуют bash 4+ (`bash --version`). Если указать имена в аргументах, проверятся только они: так скрипт пригодится в задании 4.3 для измерения времени восстановления одного сервиса.

```bash
#!/usr/bin/env bash
# ~/sre-bootstrap/scripts/check-services.sh
# Примеры: check-services.sh | check-services.sh Grafana Prometheus
declare -A SERVICES=(
  ["Prometheus"]="http://localhost:9090/-/healthy"
  ["Grafana"]="http://localhost:3000/api/health"
  ["Alertmanager"]="http://localhost:9093/-/healthy"
  ["Kibana"]="http://localhost:5601/api/status"
  ["Elasticsearch"]="http://localhost:9200/_cluster/health"
  ["KrakenD"]="http://localhost:8090/__health"
)

failed=0

check_service() {
  local name=$1 url=$2 http_code
  # Если curl не достучался, он сам печатает 000 и завершается с ошибкой.
  # Поэтому после него стоит || true, а не || echo 000: иначе получится 000000.
  http_code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url") || true
  : "${http_code:=000}"
  if [[ "$http_code" == "200" ]]; then
    printf 'UP    %-14s HTTP %s\n' "$name" "$http_code"
  else
    printf 'DOWN  %-14s HTTP %s  %s\n' "$name" "$http_code" "$url"
    failed=$((failed + 1))
  fi
}

echo "=== Проверка сервисов, $(date '+%F %T') ==="
if (( $# > 0 )); then names=("$@"); else mapfile -t names < <(printf '%s\n' "${!SERVICES[@]}" | sort); fi
for name in "${names[@]}"; do
  check_service "$name" "${SERVICES[$name]:?неизвестный сервис: $name}"
done
exit $(( failed > 0 ))
```

Запусти `~/sre-bootstrap/scripts/check-services.sh`. Ожидаемый вид, когда работает только стек мониторинга:

```text
=== Проверка сервисов, 2026-10-26 10:20:11 ===
UP    Alertmanager   HTTP 200
DOWN  Elasticsearch  HTTP 000  http://localhost:9200/_cluster/health
UP    Grafana        HTTP 200
DOWN  Kibana         HTTP 000  http://localhost:5601/api/status
DOWN  KrakenD        HTTP 000  http://localhost:8090/__health
UP    Prometheus     HTTP 200
```

Код `000` значит «соединение не удалось», это не код ответа сервера. Скрипт возвращает ненулевой код, если что-то недоступно: его можно вызвать из cron или CI.

---

### Задание 3.2. PostgreSQL: бэкап, восстановление, мониторинг (2 ч)

**Что получится на экране:** PostgreSQL в контейнере, файл бэкапа в `~/sre-bootstrap/backups/`, после восстановления в соседней базе те же строки, что и в исходной, а в Prometheus метрики базы.

**Что делаешь:** собираешь полный цикл для базы: запуск, бэкап с ротацией, восстановление в чистую базу и метрики с алертами.

**Шаг 1. Пароль и стек.** Пароль создаётся в `.env` (он в `.gitignore`), в терминал не печатается. Файл `init/01-schema.sql` выполняется один раз при первом создании тома и даёт нам данные, которые есть что проверять после восстановления.

```bash
cd ~/sre-bootstrap/database
mkdir -p init
printf 'PG_PASSWORD=%s\n' "$(openssl rand -hex 12)" > .env
printf 'PG_PASSWORD=\n' > .env.example
printf 'backups/\nreports/\n' >> ~/sre-bootstrap/.gitignore
```

```sql
-- ~/sre-bootstrap/database/init/01-schema.sql
CREATE TABLE items (
  id         serial PRIMARY KEY,
  title      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO items (title) VALUES ('alpha'), ('beta'), ('gamma'), ('delta'), ('epsilon');
```

```yaml
# ~/sre-bootstrap/database/compose.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: sre_demo
      POSTGRES_USER: sre_user
      POSTGRES_PASSWORD: ${PG_PASSWORD:?задай пароль в .env}
    volumes:
      - pg_data:/var/lib/postgresql/data
      - ./init:/docker-entrypoint-initdb.d:ro
    ports: ["127.0.0.1:5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sre_user -d sre_demo"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  postgres-exporter:
    image: prometheuscommunity/postgres-exporter:v0.17.1   # актуальную версию сверь на странице релизов
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATA_SOURCE_NAME: "postgresql://sre_user:${PG_PASSWORD}@postgres:5432/sre_demo?sslmode=disable"
    restart: unless-stopped

volumes:
  pg_data:

networks:
  default:
    name: notes-net
    external: true
```

Порт экспортёра наружу не публикуется: Prometheus ходит к нему по имени `postgres-exporter` внутри сети `notes-net`.

```bash
docker compose up -d --wait
docker compose exec postgres psql -U sre_user -d sre_demo -c 'SELECT count(*) FROM items;'
```

Ожидается `count` равный `5`.

**Шаг 2. Пароль для скриптов через `~/.pgpass`.** Скриптам не нужно держать пароль в переменных: клиент `psql` сам читает его из файла `~/.pgpass` (формат `хост:порт:база:пользователь:пароль`, права строго 600, иначе клиент игнорирует файл).

```bash
set -a; source ~/sre-bootstrap/database/.env; set +a
printf 'localhost:5432:*:sre_user:%s\n' "$PG_PASSWORD" >> ~/.pgpass
chmod 600 ~/.pgpass
psql --version; pg_dump --version
psql -h localhost -U sre_user -d sre_demo -c 'SELECT 1;'
```

Хост в скриптах должен быть написан так же, как в файле (`localhost`), иначе клиент не найдёт строку и спросит пароль.

**Шаг 3. Бэкап с ротацией.** Каталог по умолчанию лежит в твоём домашнем каталоге, а не в `/tmp`: `/tmp` очищается при перезагрузке, и бэкап пропадёт вместе с сервером.

```bash
#!/usr/bin/env bash
# ~/sre-bootstrap/scripts/pg-backup.sh
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-sre_demo}"
DB_USER="${DB_USER:-sre_user}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/sre-bootstrap/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"

log() { echo "[$(date '+%F %T')] $*"; }

mkdir -p "$BACKUP_DIR"
log "Бэкап $DB_NAME -> $BACKUP_FILE"
# Пароль берётся из ~/.pgpass. pipefail останавливает скрипт, если упал pg_dump, а не только gzip.
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --format=plain "$DB_NAME" | gzip > "$BACKUP_FILE"

log "Готово, размер: $(du -h "$BACKUP_FILE" | cut -f1)"

# gzip -t проверяет только целостность архива, а не то, что из него можно восстановить базу.
if ! gzip -t "$BACKUP_FILE"; then
  log "ERROR архив повреждён, удаляю"
  rm -f "$BACKUP_FILE"
  exit 1
fi

DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
log "Удалено старых копий (старше $RETENTION_DAYS дн.): $DELETED"
log "Сейчас копий: $(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" | wc -l)"
```

**Шаг 4. Восстановление в чистую базу.** Настоящая проверка бэкапа это восстановление в пустую базу и сравнение данных. Для `DROP DATABASE` и `CREATE DATABASE` нужно подключиться к служебной базе `postgres`: к самой удаляемой базе подключиться нельзя. Без `-d postgres` клиент попытается открыть базу с именем пользователя и выдаст `database "sre_user" does not exist`. Слова `WITH (FORCE)` отключают чужие сессии, иначе удаление упадёт на «база используется».

```bash
#!/usr/bin/env bash
# ~/sre-bootstrap/scripts/pg-restore.sh
set -euo pipefail

BACKUP_FILE="${1:?Использование: $0 <backup.sql.gz> [целевая_база]}"
TARGET_DB="${2:-sre_demo_restored}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-sre_user}"
PSQL=(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -v ON_ERROR_STOP=1)

log() { echo "[$(date '+%F %T')] $*"; }

[[ -f "$BACKUP_FILE" ]] || { log "ERROR нет файла: $BACKUP_FILE"; exit 1; }
gzip -t "$BACKUP_FILE" || { log "ERROR архив повреждён"; exit 1; }

log "ВНИМАНИЕ: база $TARGET_DB на $DB_HOST:$DB_PORT будет удалена и создана заново"
read -r -p "Подтверди удаление [yes/N]: " confirm
[[ "$confirm" == "yes" ]] || { log "Отмена."; exit 0; }

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$TARGET_DB\" WITH (FORCE);"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$TARGET_DB\";"

log "Восстанавливаю данные..."
gunzip -c "$BACKUP_FILE" | "${PSQL[@]}" -q -d "$TARGET_DB"

TABLES=$("${PSQL[@]}" -d "$TARGET_DB" -tA -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';")
ROWS=$("${PSQL[@]}" -d "$TARGET_DB" -tA -c "SELECT count(*) FROM items;")
log "Готово. Таблиц в public: $TABLES, строк в items: $ROWS"
```

Проверь цикл целиком:

```bash
~/sre-bootstrap/scripts/pg-backup.sh
ls -1t ~/sre-bootstrap/backups | head -1
~/sre-bootstrap/scripts/pg-restore.sh ~/sre-bootstrap/backups/$(ls -1t ~/sre-bootstrap/backups | head -1)
```

Ожидаемый конец вывода восстановления: `Таблиц в public: 1, строк в items: 5`. Совпадение числа строк с исходной базой и есть проверка бэкапа. Скрипт восстановления не стирает исходную базу `sre_demo`: целевая по умолчанию другая.

**Типичные ошибки:**
- `database "sre_user" does not exist`: в команде нет `-d`. Всегда указывай базу, а для служебных операций это `-d postgres`.
- `password authentication failed` или запрос пароля: нет строки в `~/.pgpass`, права не 600 (`WARNING: password file ... has group or world access`) или хост в команде не `localhost`.
- `psql: command not found`: поставь `sudo apt install -y postgresql-client`.

**Что бэкап `pg_dump` не закрывает.** Эта копия «снимок на момент запуска». **RPO** (recovery point objective, сколько данных ты готов потерять) равен интервалу между бэкапами: раз в сутки значит до суток данных. **RTO** (recovery time objective, за сколько надо восстановить работу) складывается из времени скачивания копии и восстановления, измерь его сам на этом стенде. Чтобы потерять меньше, нужен архив журнала транзакций (WAL, write-ahead log) и восстановление на момент времени; чтобы пережить потерю сервера, нужна копия в другом месте (отдельный диск, другое хранилище). На работе для этого используют pgBackRest или оператор CloudNativePG в Kubernetes ([тема 9](../09-secrets-gitops/index.md)). Здесь мы их не настраиваем.

**Шаг 5. Метрики и алерты.** Добавь задачу в `~/sre-bootstrap/monitoring/prometheus/prometheus.yml`:

```yaml
  - job_name: postgres
    static_configs:
      - targets: ["postgres-exporter:9187"]
```

Алерты. Ниже есть метрика `pg_settings_max_connections`: её наличие зависит от версии экспортёра и включённых сборщиков, поэтому после запуска проверь имена: `docker compose -f ~/sre-bootstrap/monitoring/compose.yml exec prometheus wget -qO- http://postgres-exporter:9187/metrics | grep -E 'max_connections|pg_stat_activity_count' | head`. Если метрики нет, замени алерт на сравнение с числом (`pg_stat_activity_count > 80`) и запиши это в отчёт.

{% raw %}
```yaml
# ~/sre-bootstrap/monitoring/prometheus/rules/postgresql_alerts.yml
groups:
  - name: postgresql
    rules:
      - alert: PostgreSQLDown
        expr: pg_up == 0
        for: 1m
        labels: { severity: critical }
        annotations:
          summary: "PostgreSQL на {{ $labels.instance }} недоступен"

      - alert: PostgreSQLHighConnections
        expr: >
          sum by (instance) (pg_stat_activity_count)
          / max by (instance) (pg_settings_max_connections) > 0.8
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "Занято больше 80% соединений на {{ $labels.instance }} ({{ $value | humanizePercentage }})"

      - alert: PostgreSQLLongTransaction
        expr: max by (instance) (pg_stat_activity_max_tx_duration) > 300
        for: 2m
        labels: { severity: warning }
        annotations:
          summary: "Транзакция идёт дольше 5 минут на {{ $labels.instance }}"

      - alert: PostgreSQLDeadlocks
        expr: rate(pg_stat_database_deadlocks[5m]) > 0
        for: 5m
        labels: { severity: warning }
        annotations:
          summary: "Взаимные блокировки (deadlocks) в {{ $labels.datname }}"
```
{% endraw %}

Проверь и перезагрузи:

```bash
cd ~/sre-bootstrap/monitoring
docker compose exec prometheus promtool check config /etc/prometheus/prometheus.yml
docker compose exec prometheus promtool check rules /etc/prometheus/rules/postgresql_alerts.yml
curl -s -X POST localhost:9090/-/reload
curl -s localhost:9090/api/v1/targets | jq -r '.data.activeTargets[] | select(.labels.job=="postgres") | .health'
```

Ожидается `up`. Если `down`, цель не в той сети: оба compose-файла должны использовать `notes-net`.

Затем проверь реакцию алерта: `docker compose -f ~/sre-bootstrap/database/compose.yml stop postgres` и через 1–2 минуты открой `localhost:9090/alerts` (ожидается `PostgreSQLDown` в состоянии `firing`). Верни базу командой `start`.

<details markdown="1">
<summary>По желанию: тест правила без запуска стека (promtool test rules)</summary>

Тест подаёт искусственный ряд и проверяет, что алерт срабатывает. Так правила проверяют до выкладки на сервер.

{% raw %}
```yaml
# ~/sre-bootstrap/monitoring/prometheus/tests/postgresql_test.yml
rule_files:
  - ../rules/postgresql_alerts.yml
evaluation_interval: 1m
tests:
  - interval: 1m
    input_series:
      - series: 'pg_up{instance="postgres-exporter:9187"}'
        values: '1 1 0 0 0 0'
    alert_rule_test:
      - eval_time: 5m
        alertname: PostgreSQLDown
        exp_alerts:
          - exp_labels:
              severity: critical
              instance: postgres-exporter:9187
            exp_annotations:
              summary: "PostgreSQL на postgres-exporter:9187 недоступен"
```
{% endraw %}

```bash
docker compose exec prometheus promtool test rules /etc/prometheus/tests/postgresql_test.yml
```

Ожидается `SUCCESS`.

</details>

---

### Задание 3.3. Пайплайн GitLab CI (2,5 ч)

**Что получится на экране:** в GitLab страница Pipelines с шестью стадиями. Первые идут зелёными сами, выкладка на production ждёт твоей кнопки, а после неё `kubectl get pods -n production` показывает поды с твоим образом.

**Что делаешь:** собираешь пайплайн из шести стадий: проверка файлов, сборка образа, сканирование безопасности, выкладка на staging, быстрая проверка (smoke-test) и выкладка на production вручную.

> **Что нужно заранее.** Репозиторий в GitLab (gitlab.com или свой) и GitLab Runner с включённым режимом `privileged` (без него Docker внутри Docker, dind, не стартует). Для выкладки раннер должен достучаться до кластера, поэтому нужны два раннера на твоей машине. Первый с executor `docker` и `privileged = true`: он гоняет стадии `validate`, `build` и `security`. Второй с executor `shell` и тегом `kind` (при регистрации `--tag-list kind --run-untagged=false`): он выкладывает в кластер, и на хосте для него должен стоять `kubectl`. Так сделано потому, что kubeconfig kind указывает на `127.0.0.1:порт`, а в контейнере docker executor `127.0.0.1` это сам контейнер, и до кластера он не достучится. Бесплатный общий раннер gitlab.com до твоего локального kind не дотянется, тогда пройди стадии до `security` и опиши остальные.

**Подготовка файлов в репозитории.** Минимальный образ и манифест, которые будет собирать и выкладывать пайплайн:

```text
Dockerfile
index.html
k8s/app-deployment.yml
.gitlab-ci.yml
```

```dockerfile
# Dockerfile
FROM nginx:1.30-alpine
COPY index.html /usr/share/nginx/html/index.html
```

```bash
echo '<h1>demo-app</h1>' > index.html
```

```yaml
# k8s/app-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-app
spec:
  replicas: 2
  selector:
    matchLabels: { app: demo-app }
  template:
    metadata:
      labels: { app: demo-app }
    spec:
      containers:
        - name: demo-app
          image: ${DOCKER_IMAGE}      # подставит пайплайн
          ports: [{ containerPort: 80 }]
          readinessProbe:
            httpGet: { path: /, port: 80 }
---
apiVersion: v1
kind: Service
metadata:
  name: demo-app
spec:
  selector: { app: demo-app }
  ports: [{ port: 80, targetPort: 80 }]
```

Namespace в манифесте не указан: его задаёт ключ `-n` в команде выкладки, поэтому один файл подходит и для staging, и для production.

Namespace пайплайн не создаёт: для этого нужны права на весь кластер. Создай их один раз руками и разреши кластеру скачивать образ из приватного реестра GitLab, иначе будет `ImagePullBackOff`. Токен создай в GitLab: Settings, Repository, Deploy tokens, права `read_registry`.

```bash
kubectl create namespace staging          # production уже есть из дня 2
read -rsp "Deploy token: " TOKEN; echo
for ns in staging production; do
  kubectl -n "$ns" create secret docker-registry gitlab-registry \
    --docker-server=registry.gitlab.com --docker-username=<имя-токена> --docker-password="$TOKEN"
  kubectl -n "$ns" patch serviceaccount default -p '{"imagePullSecrets":[{"name":"gitlab-registry"}]}'
done
unset TOKEN
```

Можно вместо этого сделать проект публичным: тогда секрет не нужен. Учти: пайплайн выкладывает в `production` тот же `demo-app`, что и в дне 2, и заменяет его контейнер (пробы и лимиты из дня 2 пропадут, HPA останется). Это нормальная выкладка новой версии, но если хочешь сохранить результат дня 2, сделай копию манифеста.

**Доступ к кластеру.** Самый простой способ для учебного стенда: создай в GitLab (Settings, CI/CD, Variables) переменные типа **File** `KUBECONFIG_STAGING` и `KUBECONFIG_PROD` и отметь их как **Protected** (доступны только защищённым веткам). Переменную типа File GitLab замаскировать не может, поэтому доступ ограничивают на стороне кластера: kubeconfig должен принадлежать ServiceAccount, у которого есть права только на свой namespace, а не `cluster-admin`. На работе вместо долгоживущего kubeconfig используют GitLab Agent for Kubernetes или OIDC, а часто и другой подход: пайплайн лишь меняет версию в git, а выкладывает сам кластер (GitOps, Flux, [урок 9.3](../09-secrets-gitops/index.md)). Push-выкладка из пайплайна, как здесь, это упрощение для обучения.

<details markdown="1">
<summary>.gitlab-ci.yml</summary>

```yaml
# .gitlab-ci.yml
stages: [validate, build, security, deploy-staging, smoke-test, deploy-production]

variables:
  DOCKER_IMAGE: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHORT_SHA   # тег по коммиту, без latest

# ---------- validate ----------
lint-dockerfile:
  stage: validate
  image:
    name: hadolint/hadolint:v2.15.1-alpine
    entrypoint: [""]
  script:
    - hadolint Dockerfile

validate-k8s:
  stage: validate
  image:
    name: ghcr.io/yannh/kubeconform:v0.6.7-alpine
    entrypoint: [""]
  script:
    # в манифесте есть ${DOCKER_IMAGE}, схему Deployment это не ломает
    - kubeconform -strict -summary k8s/

# ---------- build ----------
build-image:
  stage: build
  image: docker:27.5.1
  services:
    - docker:27.5.1-dind
  variables:
    DOCKER_HOST: tcp://docker:2376
    DOCKER_TLS_CERTDIR: "/certs"
    DOCKER_TLS_VERIFY: "1"
    DOCKER_CERT_PATH: "/certs/client"
  before_script:
    - echo "$CI_REGISTRY_PASSWORD" | docker login -u "$CI_REGISTRY_USER" --password-stdin "$CI_REGISTRY"
  script:
    - docker build -t "$DOCKER_IMAGE" .
    - docker push "$DOCKER_IMAGE"
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

# ---------- security ----------
trivy-scan:
  stage: security
  image:
    name: aquasec/trivy:0.74.0
    entrypoint: [""]
  variables:
    TRIVY_USERNAME: $CI_REGISTRY_USER
    TRIVY_PASSWORD: $CI_REGISTRY_PASSWORD
  script:
    - trivy image --severity LOW,MEDIUM --format table "$DOCKER_IMAGE"        # справочно
    - trivy image --exit-code 1 --severity HIGH,CRITICAL "$DOCKER_IMAGE"      # падаем на серьёзных
  needs: [build-image]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

secrets-scan:
  stage: security
  image:
    name: trufflesecurity/trufflehog:3.99.7
    entrypoint: [""]
  variables:
    GIT_DEPTH: "0"            # нужна вся история, иначе старые коммиты не проверятся
  script:
    - trufflehog git file://. --only-verified --fail
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"

# ---------- deploy staging ----------
deploy-staging:
  stage: deploy-staging
  tags: [kind]          # раннер shell: kubectl запускается на хосте
  environment:
    name: staging
  script:
    - export KUBECONFIG="$KUBECONFIG_STAGING"      # переменная типа File: в ней путь к файлу
    - sed "s|\${DOCKER_IMAGE}|${DOCKER_IMAGE}|g" k8s/app-deployment.yml | kubectl apply -n staging -f -
    - kubectl rollout status deployment/demo-app -n staging --timeout=120s
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# ---------- smoke-test ----------
smoke-test:
  stage: smoke-test
  tags: [kind]
  script:
    - export KUBECONFIG="$KUBECONFIG_STAGING"
    # временный под в кластере ходит к сервису по внутреннему имени
    - kubectl run smoke --rm -i --restart=Never -n staging --image=curlimages/curl:8.11.1 -- curl -sf --retry 5 --retry-delay 3 http://demo-app/
  needs: [deploy-staging]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

# ---------- deploy production ----------
deploy-production:
  stage: deploy-production
  tags: [kind]
  environment:
    name: production
  script:
    - export KUBECONFIG="$KUBECONFIG_PROD"
    - sed "s|\${DOCKER_IMAGE}|${DOCKER_IMAGE}|g" k8s/app-deployment.yml | kubectl apply -n production -f -
    - kubectl rollout status deployment/demo-app -n production --timeout=300s
  needs: [smoke-test]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual

rollback-production:
  stage: deploy-production
  tags: [kind]
  script:
    - export KUBECONFIG="$KUBECONFIG_PROD"
    - kubectl rollout undo deployment/demo-app -n production
    - kubectl rollout status deployment/demo-app -n production --timeout=120s
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
      when: manual
```

</details>

Разбор непонятного. Образ `docker:27.5.1` это клиент, а `docker:27.5.1-dind` (Docker in Docker) сервис с демоном, к которому клиент подключается по `tcp://docker:2376` с TLS-сертификатами из общего тома `/certs`. Пароль реестра передаётся через stdin (`--password-stdin`), чтобы он не попал в историю команд и список процессов. `entrypoint: [""]` у образов trivy, trufflehog и других нужен потому, что в них точка входа это сама утилита, а GitLab запускает в образе оболочку для выполнения `script`. В стадиях выкладки нет ключа `image`: они идут на раннере `shell`, где команды выполняются прямо на хосте. Тег `latest` не используется нигде: образ определяется коротким хэшем коммита, поэтому по нему всегда видно, какой код работает, и откат возвращает конкретную версию. Теги образов инструментов (hadolint, kubeconform, trivy, trufflehog) сверены с реестрами на дату проверки страницы; если тег пропал, возьми свежий с Docker Hub или ghcr.io.

**Проверка и типичные ошибки.** Сделай коммит в отдельной ветке и открой Merge Request: в нём должны отработать `lint-dockerfile`, `validate-k8s`, `build-image`, `secrets-scan`. После слияния в основную ветку идут остальные стадии. Образ после успешной сборки виден в Deploy, Container Registry.

- `Cannot connect to the Docker daemon at tcp://docker:2376`: раннер без `privileged = true` или нет переменных `DOCKER_HOST` и `DOCKER_TLS_CERTDIR`.
- `exec: "trivy": executable file not found` или зависание на первой строке: забыт `entrypoint: [""]`.
- `unauthorized` при `trivy image`: образ в приватном реестре, проверь `TRIVY_USERNAME` и `TRIVY_PASSWORD`.
- `trivy-scan` красный и в логе таблица с `HIGH` или `CRITICAL`: это не поломка пайплайна. Ключ `--exit-code 1` и есть «ворота» безопасности: нашлась серьёзная уязвимость, выкладка дальше не идёт, и `deploy-staging` не запустится. Первый выход: обнови базовый тег в `Dockerfile` (`nginx:1.30-alpine` берёт свежий alpine при каждой сборке, но проверь, что образ пересобран). Второй: если исправления у уязвимости ещё нет, добавь к команде `--ignore-unfixed` (показывать только те, что можно исправить). Третий, на время: файл `.trivyignore` с идентификатором уязвимости и комментарием, почему ты её принимаешь и до какой даты. Не снимай `--exit-code 1` совсем.
- Стадия выкладки не может прочитать kubeconfig: переменная не Protected, а ветка защищённая (или наоборот), и она туда не попала.
- `ImagePullBackOff` на staging или production: кластер не может скачать образ из приватного реестра GitLab. Нужен `imagePullSecret` (команды выше в этом задании) или публичный проект. Разбор этой ошибки есть в задании 4.3.
- `Forbidden` на `kubectl apply`: у kubeconfig нет прав на namespace. Namespace создаётся заранее руками, пайплайн сам их не создаёт.
- Стадия выкладки висит в `pending` с сообщением «stuck, no runners»: нет раннера с тегом `kind` или он остановлен (`sudo gitlab-runner status`).
- `secrets-scan` упал на ложном срабатывании: подтверди, что это не настоящий секрет, и добавь исключение в конфиг trufflehog. Не ставь `allow_failure: true` насовсем: тогда сканер ничего не останавливает. Секреты лучше ловить ещё до коммита: поставь `pre-commit` с хуком gitleaks.

**Makefile для всего набора.** Команды в строках с отступом пишутся с символом табуляции, а не пробелами, иначе `make` выдаст `missing separator`.

```makefile
# ~/sre-bootstrap/Makefile
.PHONY: up-monitoring up-logging up-db up-all down-all logs health-check backup

up-monitoring:
	docker compose -f monitoring/compose.yml up -d

up-logging:
	docker compose -f logging/compose.yml up -d

up-db:
	docker compose -f database/compose.yml up -d --wait

# Все три сразу тяжелы для 16 ГБ. Запускай по одному: make up-monitoring up-db
up-all: up-monitoring up-db up-logging

down-all:
	docker compose -f logging/compose.yml down
	docker compose -f database/compose.yml down
	docker compose -f monitoring/compose.yml down

logs:
	docker compose -f monitoring/compose.yml logs -f --tail=100

health-check:
	bash scripts/check-services.sh

backup:
	bash scripts/pg-backup.sh
```

Запуск: `cd ~/sre-bootstrap && make health-check`. Файлы `.env` лежат рядом с каждым `compose.yml`, и `docker compose -f` читает именно их.

---

Назад: [День 2](sre-day2.md). Дальше: [День 4](sre-day4.md).
