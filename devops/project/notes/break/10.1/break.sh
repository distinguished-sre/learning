#!/usr/bin/env bash
# Поломки для урока 10.1 «On-call». Запуск: bash break.sh random|1|3|4|5|fix
# Ломает «Заметки» (Deployment или Rollout) в учебном kind-кластере, четыре поломки: 1 OOM, 3 плохой релиз,
# 4 сертификат, 5 БД недоступна. Без sudo. Что именно сломано, скрипт не печатает.
# Состояние хранится в ConfigMap break-10-1 (namespace notes), fix читает его.
set -euo pipefail

NS=notes
STATE=break-10-1
CHART=${NOTES_CHART:-$HOME/notes/helm/notes}

die() { echo "$*" >&2; exit 1; }

# Имя рабочей нагрузки: после урока 9.6 это может быть Rollout, иначе Deployment.
wl() {
  if kubectl -n "$NS" get rollout.argoproj.io notes >/dev/null 2>&1; then echo rollout/notes; else echo deploy/notes; fi
}

need() {
  command -v kubectl >/dev/null || die "Нет kubectl. Сначала пройди урок 5.1."
  command -v helm >/dev/null || die "Нет helm. Сначала пройди урок 5.9."
  kubectl -n "$NS" get deploy notes >/dev/null 2>&1 || kubectl -n "$NS" get rollout.argoproj.io notes >/dev/null 2>&1 \
    || die "Не найден ни Deployment, ни Rollout notes в namespace $NS. Проверь контекст (kubectl config use-context kind-notes) и уроки 5.x, 9.6."
}

# Читает поле из ConfigMap состояния; пусто, если ConfigMap или поля нет.
st() { kubectl -n "$NS" get cm "$STATE" -o "jsonpath={.data.$1}" 2>/dev/null || true; }

save() { kubectl -n "$NS" create cm "$STATE" "$@" >/dev/null; }

deployed_rev() {
  helm history notes -n "$NS" -o json | python3 -c \
    'import json,sys; print([r["revision"] for r in json.load(sys.stdin) if r["status"]=="deployed"][-1])'
}

wait_rollout() {
  if [[ $(wl) == rollout/notes ]]; then
    kubectl -n "$NS" wait --for=jsonpath='{.status.phase}'=Healthy rollout/notes --timeout=120s >/dev/null || true
  else
    kubectl -n "$NS" rollout status deploy/notes --timeout=120s >/dev/null || true
  fi
}

# Одна JSON-операция для памяти ($1 requests|limits, $2 значение, пусто = убрать поле).
mem_op() {
  local base=/spec/template/spec/containers/0/resources has
  has=$(kubectl -n "$NS" get "$(wl)" -o "jsonpath={.spec.template.spec.containers[0].resources.$1}")
  if [[ -z $2 ]]; then
    [[ -n $has ]] && printf '{"op":"remove","path":"%s/%s/memory"}' "$base" "$1"
  elif [[ -z $has ]]; then
    printf '{"op":"add","path":"%s/%s","value":{"memory":"%s"}}' "$base" "$1" "$2"
  else
    printf '{"op":"add","path":"%s/%s/memory","value":"%s"}' "$base" "$1" "$2"
  fi
  return 0
}

# Ставит память requests и limits одним патчем: limit меньше request Kubernetes не принимает.
set_mem() {
  local r l ops=""
  r=$(mem_op requests "$1"); l=$(mem_op limits "$2")
  [[ -n $r ]] && ops=$r
  [[ -n $l ]] && ops=${ops:+$ops,}$l
  [[ -n $ops ]] || return 0
  kubectl -n "$NS" patch "$(wl)" --type=json -p "[$ops]" >/dev/null
}



break_1() {
  local base='{.spec.template.spec.containers[0].resources'
  local lim req
  lim=$(kubectl -n "$NS" get "$(wl)" -o "jsonpath=$base.limits.memory}")
  req=$(kubectl -n "$NS" get "$(wl)" -o "jsonpath=$base.requests.memory}")
  save --from-literal=scenario=1 --from-literal=orig="$lim" --from-literal=origreq="$req"
  # Request и limit ставим вместе: limit меньше request Kubernetes отвергнет.
  set_mem 8Mi 8Mi
}

break_3() {
  [[ -d $CHART ]] || die "Не найден чарт $CHART (репозиторий ~/notes из урока 5.9). Можно задать NOTES_CHART=путь."
  local rev; rev=$(deployed_rev)
  save --from-literal=scenario=3 --from-literal=rev="$rev"
  helm upgrade notes "$CHART" -n "$NS" --reuse-values --set-string config.FAIL_RATE=0.5 >/dev/null
  wait_rollout
}

break_4() {
  kubectl -n cert-manager get deploy cert-manager >/dev/null 2>&1 || die "Нет cert-manager. Сначала пройди урок 9.4."
  local rep; rep=$(kubectl -n cert-manager get deploy cert-manager -o jsonpath='{.spec.replicas}')
  save --from-literal=scenario=4 --from-literal=replicas="$rep"
  kubectl -n cert-manager scale deploy/cert-manager --replicas=0 >/dev/null
  kubectl -n "$NS" patch secret notes-tls -p '{"data":{"tls.crt":"Zm9v"}}' >/dev/null
}

break_5() {
  kubectl -n "$NS" get cluster.postgresql.cnpg.io notes-db >/dev/null 2>&1 || die "Нет Cluster notes-db. Сначала пройди урок 9.5."
  save --from-literal=scenario=5
  kubectl -n "$NS" annotate cluster.postgresql.cnpg.io notes-db cnpg.io/hibernation=on --overwrite >/dev/null
}

do_fix() {
  local sc; sc=$(st scenario)
  if [[ -z $sc ]]; then echo "Ничего не сломано (нет состояния $STATE), чинить нечего."; return 0; fi
  case $sc in
    1)
      set_mem "$(st origreq)" "$(st orig)"
      wait_rollout ;;
    3) helm rollback notes "$(st rev)" -n "$NS" >/dev/null; wait_rollout ;;
    4)
      kubectl -n cert-manager scale deploy/cert-manager --replicas="$(st replicas)" >/dev/null
      kubectl -n cert-manager rollout status deploy/cert-manager --timeout=120s >/dev/null || true
      kubectl -n "$NS" delete secret notes-tls --ignore-not-found >/dev/null ;;
    5) kubectl -n "$NS" annotate cluster.postgresql.cnpg.io notes-db cnpg.io/hibernation=off --overwrite >/dev/null ;;
    *) die "Неизвестное состояние $sc" ;;
  esac
  kubectl -n "$NS" delete cm "$STATE" --ignore-not-found >/dev/null
  echo "Исправлено. Подожди минуту и проверь: kubectl get pods -n $NS"
}

do_break() {
  local n=$1
  if [[ -n $(st scenario) ]]; then
    echo "Сценарий уже применён. Сначала выполни: bash $0 fix"
    return 0
  fi
  if [[ $n == random ]]; then
    local all=(1 3 4 5)
    n=${all[RANDOM % 4]}
    "break_$n" || { kubectl -n "$NS" delete cm "$STATE" --ignore-not-found >/dev/null; exit 1; }
  else
    "break_$n" || { kubectl -n "$NS" delete cm "$STATE" --ignore-not-found >/dev/null; exit 1; }
  fi
  echo "Готово: что-то сломано. Ты дежурный. Включай секундомер."
}

need
case ${1:-} in
  1|3|4|5|random) do_break "$1" ;;
  fix) do_fix ;;
  *) die "Использование: bash $0 random|1|3|4|5|fix" ;;
esac
