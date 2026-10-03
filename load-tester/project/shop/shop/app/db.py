from contextlib import contextmanager
from time import perf_counter

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from . import metrics, settings

# Каждый воркер имеет свой пул; суммарный лимит = workers * DB_POOL_MAX.
pool = ConnectionPool(settings.DATABASE_URL, min_size=settings.DB_POOL_MIN,
                      max_size=settings.DB_POOL_MAX, timeout=settings.DB_POOL_TIMEOUT,
                      kwargs={"row_factory": dict_row}, open=False)


def update_pool_metrics():
    stats = pool.get_stats()
    metrics.POOL_SIZE.set(stats.get("pool_size", 0))
    metrics.POOL_AVAILABLE.set(stats.get("pool_available", 0))
    metrics.POOL_WAITING.set(stats.get("requests_waiting", 0))


@contextmanager
def connection():
    started = perf_counter()
    try:
        conn = pool.getconn()
    finally:
        # Даже неудачное ожидание важно для поиска насыщения пула.
        metrics.DB_WAIT.observe(perf_counter() - started)
        update_pool_metrics()
    try:
        # Исключение откатывает транзакцию; успешный выход делает commit.
        with conn.transaction():
            yield conn
    finally:
        pool.putconn(conn)
        update_pool_metrics()
