"""Каталог multiprocess создаёт entrypoint ДО импорта prometheus_client."""
import os

from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram, generate_latest, multiprocess

BUCKETS = (0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 1, 2.5, 5, 10)
REQUESTS = Counter("http_requests_total", "Запросы HTTP", ("method", "route", "status"))
DURATION = Histogram("http_request_duration_seconds", "Длительность HTTP", ("method", "route"), buckets=BUCKETS)
IN_PROGRESS = Gauge("http_requests_in_progress", "Запросы в работе", multiprocess_mode="livesum")
POOL_SIZE = Gauge("shop_db_pool_size", "Соединения пула", multiprocess_mode="livesum")
POOL_AVAILABLE = Gauge("shop_db_pool_available", "Свободные соединения", multiprocess_mode="livesum")
POOL_WAITING = Gauge("shop_db_pool_waiting", "Ожидающие соединение", multiprocess_mode="livesum")
DB_WAIT = Histogram("shop_db_connection_wait_seconds", "Ожидание соединения", buckets=BUCKETS)
CACHE = Counter("shop_cache_requests_total", "Обращения к кешу", ("result",))
ORDERS = Counter("shop_orders_created_total", "Созданные заказы")
PAYMENTS = Counter("shop_payment_requests_total", "Попытки оплаты", ("result",))
PAYMENT_DURATION = Histogram("shop_payment_duration_seconds", "Длительность попытки оплаты", buckets=BUCKETS)


def render():
    # Отдельный реестр читает файлы ВСЕХ воркеров, а не только текущего.
    registry = CollectorRegistry()
    multiprocess.MultiProcessCollector(registry)
    return generate_latest(registry)


def worker_stopped():
    # livesum исключит gauges завершённого воркера.
    multiprocess.mark_process_dead(os.getpid())
