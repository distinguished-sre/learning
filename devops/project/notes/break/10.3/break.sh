#!/usr/bin/env bash
# Поломки для урока 10.3 «Бэкапы, восстановление и ёмкость». Запуск: bash break.sh 1|2|fix
# 1: «ночной» дамп обрезан на 60% (файл ~/notes-backups/notes-nightly.dump, исходник прячется в скрытый файл .break-10.3-1.orig).
# 2: в томе notes-db создан файл-пустышка segment.bin (около 90% свободного места тома, 1 ГБ, если размер тома не ограничен) в каталоге old-wal-archive; на маленьком PVC он может заполнить том и остановить базу.
# Без sudo. Нужен дамп из задания 1 урока и работающий кластер notes-db.
set -euo pipefail

NS=notes
POD=notes-db-1
DIR=$HOME/notes-backups
NIGHTLY=$DIR/notes-nightly.dump
MARK=$DIR/.break-10.3-1
ORIG=$MARK.orig
JUNK=/var/lib/postgresql/data/old-wal-archive

die() { echo "$*" >&2; exit 1; }

need_kubectl() {
  command -v kubectl >/dev/null || die "Нет kubectl. Сначала пройди урок 5.1."
  kubectl -n "$NS" get pod "$POD" >/dev/null 2>&1 \
    || die "Не найден под $POD в namespace $NS. Проверь контекст и урок 9.5."
}

break_1() {
  [[ -s $NIGHTLY ]] || die "Нет $NIGHTLY. Сначала сделай дамп в задании 1 урока."
  if [[ -e $MARK ]]; then echo "Сценарий 1 уже применён."; return 0; fi
  # Исходник копируем один раз: после прерывания $NIGHTLY уже может быть обрезан.
  if [[ ! -e $ORIG ]]; then
    cp -p "$NIGHTLY" "$ORIG.tmp" && mv "$ORIG.tmp" "$ORIG"
  fi
  local size; size=$(wc -c < "$ORIG")
  # Оставляем 60% файла: похоже на дамп, оборванный переполненным диском.
  head -c $(( size * 6 / 10 )) "$ORIG" > "$NIGHTLY"
  # В метке размер обрезанного файла: fix не затрёт дамп, пересозданный руками.
  wc -c < "$NIGHTLY" > "$MARK"
  echo "Ночной бэкап готов: $NIGHTLY (зелёный, размер ненулевой)."
}

break_2() {
  need_kubectl
  if kubectl -n "$NS" exec "$POD" -c postgres -- test -d "$JUNK" 2>/dev/null; then
    echo "Сценарий 2 уже применён."; return 0
  fi
  local avail
  avail=$(kubectl -n "$NS" exec "$POD" -c postgres -- df -Pm /var/lib/postgresql/data | awk 'NR==2{print $4}')
  [[ -n $avail ]] || die "Не удалось узнать свободное место, сценарий не применён."
  # Занимаем 90% свободного места, чтобы PostgreSQL не упал сразу, а том стал почти полным.
  local mb=$(( avail * 9 / 10 ))
  if [[ $avail -gt 6000 ]]; then
    # local-path в kind не ограничивает размер тома: df покажет диск узла, заполнять его целиком нельзя.
    mb=1024
    echo "Том большой (local-path не ограничивает размер): занимаю 1 ГБ, ориентируйся на du."
  fi
  kubectl -n "$NS" exec "$POD" -c postgres -- sh -c \
    "mkdir -p $JUNK && dd if=/dev/zero of=$JUNK/segment.bin bs=1M count=$mb 2>/dev/null"
  echo "Готово: утром пришёл алерт про том с данными."
}

do_fix() {
  if [[ -e $ORIG ]]; then
    # Размер обрезанного дампа: из метки, а если её нет (прервали запуск), считаем от исходника.
    local expected
    if [[ -e $MARK ]]; then expected=$(cat "$MARK"); else expected=$(( $(wc -c < "$ORIG") * 6 / 10 )); fi
    # Возвращаем целый дамп, если его нет или он всё ещё обрезанный; пересозданный руками не трогаем.
    if [[ ! -e $NIGHTLY || $(wc -c < "$NIGHTLY") -eq $expected ]]; then
      mv -f "$ORIG" "$NIGHTLY"
    fi
  fi
  rm -f "$MARK" "$ORIG" "$ORIG.tmp"
  if command -v kubectl >/dev/null && kubectl -n "$NS" get pod "$POD" >/dev/null 2>&1; then
    kubectl -n "$NS" exec "$POD" -c postgres -- rm -rf "$JUNK"
  fi
  echo "Исправлено."
}

case ${1:-} in
  1) break_1 ;;
  2) break_2 ;;
  fix) do_fix ;;
  *) die "Использование: bash $0 1|2|fix" ;;
esac
