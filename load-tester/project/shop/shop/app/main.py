import json
import logging
import secrets
import threading
from contextlib import asynccontextmanager
from decimal import Decimal
from time import perf_counter

import bcrypt
from opentelemetry.instrumentation.utils import suppress_instrumentation
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from pydantic import BaseModel, Field
from psycopg.errors import UniqueViolation
from psycopg_pool import PoolTimeout
from prometheus_client import CONTENT_TYPE_LATEST

from . import metrics, settings, telemetry
from .auth import Credentials, Registration, current_user, password_hash
from .cache import cached_product, redis, save_product
from .db import connection, pool, update_pool_metrics
from .logging_setup import logger
from .payment_client import client, pay

leaked_memory = []


@asynccontextmanager
async def lifespan(app):
    pool.open()
    pool.wait(timeout=60)
    stop = threading.Event()

    def sample_pool():
        # Обновляем gauges и тогда, когда все соединения заняты оплатой.
        while not stop.wait(1):
            update_pool_metrics()

    update_pool_metrics()
    sampler = threading.Thread(target=sample_pool, daemon=True)
    sampler.start()
    try:
        yield
    finally:
        stop.set()
        sampler.join()
        pool.close()
        client.close()
        redis.close()
        metrics.worker_stopped()


app = FastAPI(title="Учебный магазин", lifespan=lifespan)
telemetry.setup(app)


@app.middleware("http")
async def observe_request(request: Request, call_next):
    started = perf_counter()
    request_id = request.headers.get("X-Request-ID") or secrets.token_hex(16)
    measured = request.url.path not in ("/metrics", "/healthz", "/readyz")
    if settings.LEAK_ENABLED:
        # Новый объект на каждый запрос; список намеренно никогда не очищается.
        leaked_memory.append(bytearray(10 * 1024))
    if measured:
        metrics.IN_PROGRESS.inc()
    error = None
    try:
        response = await call_next(request)
    except Exception as exc:
        error = str(exc)
        response = Response(json.dumps({"detail": "internal server error"}),
                            status_code=500, media_type="application/json")
    finally:
        if measured:
            metrics.IN_PROGRESS.dec()
    duration = perf_counter() - started
    # После маршрутизации доступен шаблон; неизвестный URL не создаёт новую серию.
    matched = request.scope.get("route")
    route = getattr(matched, "path", "other")
    if measured:
        metrics.REQUESTS.labels(request.method, route, str(response.status_code)).inc()
        metrics.DURATION.labels(request.method, route).observe(duration)
    fields = {"method": request.method, "route": route, "path": request.url.path,
              "status": response.status_code, "duration_ms": round(duration * 1000, 2),
              "request_id": request_id}
    if trace_id := telemetry.trace_id():
        fields["trace_id"] = trace_id
    if hasattr(request.state, "user_id"):
        fields["user_id"] = request.state.user_id
    if response.status_code >= 500:
        # HTTPException уже превращён FastAPI в JSON; сохраняем detail в логе.
        fields["error"] = error or getattr(request.state, "error", "HTTP " + str(response.status_code))
    level = logging.ERROR if response.status_code >= 500 else logging.WARNING if duration > 1 else logging.INFO
    logger.log(level, "Запрос завершён", extra={"fields": fields})
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    from fastapi.responses import JSONResponse
    request.state.error = str(exc.detail)
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(PoolTimeout)
async def pool_timeout(request, exc):
    from fastapi.responses import JSONResponse
    request.state.error = str(exc)
    return JSONResponse({"detail": "database pool timeout"}, status_code=503)


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/readyz")
def readyz():
    unavailable = []
    # Проверки готовности каждые 5 секунд не должны превращаться в трейсы.
    with suppress_instrumentation():
        try:
            with connection() as conn:
                conn.execute("SELECT 1").fetchone()
        except Exception:
            unavailable.append("postgres")
        try:
            redis.ping()
        except Exception:
            unavailable.append("redis")
    if unavailable:
        raise HTTPException(503, {"unavailable": unavailable})
    return {"status": "ready"}


@app.get("/metrics")
def prometheus_metrics():
    return Response(metrics.render(), headers={"Content-Type": CONTENT_TYPE_LATEST})


@app.post("/api/register", status_code=201)
def register(data: Registration):
    hashed = password_hash(data.password)
    try:
        with connection() as conn:
            return conn.execute("INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id, email",
                                (data.email, hashed)).fetchone()
    except UniqueViolation:
        raise HTTPException(409, "email already registered")


@app.post("/api/login")
def login(data: Credentials, request: Request):
    with connection() as conn:
        user = conn.execute("SELECT id, password_hash FROM users WHERE email = %s", (data.email,)).fetchone()
    if not user or not bcrypt.checkpw(data.password.encode(), user["password_hash"].encode()):
        raise HTTPException(401, "invalid credentials")
    if int(user["password_hash"].split("$")[2]) != settings.BCRYPT_ROUNDS:
        # Смена стоимости применяется постепенно, при успешном входе пользователя.
        hashed = password_hash(data.password)
        with connection() as conn:
            conn.execute("UPDATE users SET password_hash = %s WHERE id = %s", (hashed, user["id"]))
    token = secrets.token_hex(32)
    redis.setex(f"session:{token}", settings.SESSION_TTL, user["id"])
    request.state.user_id = user["id"]
    return {"token": token, "expires_in": settings.SESSION_TTL}


@app.get("/api/categories")
def categories():
    with connection() as conn:
        return conn.execute("SELECT id, name FROM categories ORDER BY id").fetchall()


@app.get("/api/products")
def products(category_id: int | None = None, q: str | None = None,
             page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    conditions, values = [], []
    if category_id is not None:
        conditions.append("category_id = %s")
        values.append(category_id)
    if q:
        conditions.append("name ILIKE %s")
        values.append(f"%{q}%")
    where = " WHERE " + " AND ".join(conditions) if conditions else ""
    with connection() as conn:
        total = conn.execute("SELECT count(*) AS total FROM products" + where, values).fetchone()["total"]
        items = conn.execute("SELECT id, name, price, category_id, stock FROM products" + where +
                             " ORDER BY id LIMIT %s OFFSET %s", values + [size, (page - 1) * size]).fetchall()
    return {"items": items, "page": page, "size": size, "total": total}


@app.get("/api/products/{id}")
def product(id: int):
    if settings.CACHE_ENABLED:
        cached = cached_product(id)
        if cached is not None:
            return cached
    with connection() as conn:
        item = conn.execute("SELECT id, name, price, category_id, stock FROM products WHERE id = %s", (id,)).fetchone()
    if item is None:
        raise HTTPException(404, "product not found")
    if settings.CACHE_ENABLED:
        save_product(item)
    return item


def cart_contents(user_id):
    quantities = redis.hgetall(f"cart:{user_id}")
    if not quantities:
        return {"items": [], "total": 0}
    with connection() as conn:
        rows = conn.execute("SELECT id, name, price FROM products WHERE id = ANY(%s) ORDER BY id",
                            ([int(key) for key in quantities],)).fetchall()
    items = [{"product_id": row["id"], "name": row["name"], "price": row["price"],
              "qty": int(quantities[str(row["id"])])} for row in rows]
    return {"items": items, "total": sum((item["price"] * item["qty"] for item in items), Decimal(0))}


class CartItem(BaseModel):
    product_id: int = Field(ge=1)
    qty: int = Field(ge=1)


@app.get("/api/cart")
def cart(user_id: int = Depends(current_user)):
    return cart_contents(user_id)


@app.post("/api/cart/items", status_code=201)
def add_to_cart(data: CartItem, user_id: int = Depends(current_user)):
    with connection() as conn:
        exists = conn.execute("SELECT id FROM products WHERE id = %s", (data.product_id,)).fetchone()
    if exists is None:
        raise HTTPException(404, "product not found")
    # Повторное добавление товара увеличивает количество атомарно в Redis.
    redis.hincrby(f"cart:{user_id}", str(data.product_id), data.qty)
    return cart_contents(user_id)


@app.delete("/api/cart/items/{product_id}", status_code=204)
def remove_from_cart(product_id: int, user_id: int = Depends(current_user)):
    redis.hdel(f"cart:{user_id}", str(product_id))
    return Response(status_code=204)


@app.post("/api/orders", status_code=201)
def create_order(user_id: int = Depends(current_user)):
    # Корзину забираем атомарно: HGETALL и DEL выполняются одной Redis-транзакцией (MULTI/EXEC).
    # Второй параллельный запрос увидит пустую корзину и получит 400, а товар,
    # добавленный во время оплаты, попадёт в новую корзину и не потеряется.
    cart_key = f"cart:{user_id}"
    pipe = redis.pipeline(transaction=True)
    pipe.hgetall(cart_key)
    pipe.delete(cart_key)
    quantities = pipe.execute()[0]
    if not quantities:
        raise HTTPException(400, "cart is empty")
    try:
        with connection() as conn:
            # Одинаковый порядок блокировок снижает риск взаимной блокировки двух заказов.
            rows = conn.execute("SELECT id, name, price, stock FROM products WHERE id = ANY(%s) ORDER BY id FOR UPDATE",
                                ([int(key) for key in quantities],)).fetchall()
            if len(rows) != len(quantities):
                raise HTTPException(409, "product unavailable")
            items = []
            for row in rows:
                qty = int(quantities[str(row["id"])])
                if qty > row["stock"]:
                    raise HTTPException(409, "not enough stock")
                items.append({"product_id": row["id"], "name": row["name"], "price": row["price"], "qty": qty})
            total = sum((item["price"] * item["qty"] for item in items), Decimal(0))
            order = conn.execute("INSERT INTO orders (user_id, status, total) VALUES (%s, 'paid', %s) RETURNING id, status",
                                 (user_id, total)).fetchone()
            for item in items:
                conn.execute("INSERT INTO order_items (order_id, product_id, qty, price) VALUES (%s, %s, %s, %s)",
                             (order["id"], item["product_id"], item["qty"], item["price"]))
                conn.execute("UPDATE products SET stock = stock - %s WHERE id = %s", (item["qty"], item["product_id"]))
            # НАМЕРЕННЫЙ антипаттерн: сеть держит транзакцию, блокировки и соединение пула.
            pay(order["id"], total)
    except BaseException:
        # Заказ не создан: возвращаем забранные позиции к тому, что покупатель успел добавить за это время.
        restore = redis.pipeline(transaction=True)
        for key, qty in quantities.items():
            restore.hincrby(cart_key, key, int(qty))
        restore.execute()
        raise
    if settings.CACHE_ENABLED:
        redis.delete(*(f"product:{item['product_id']}" for item in items))
    metrics.ORDERS.inc()
    return {**order, "total": total, "items": items}


def order_items(conn, order_ids):
    return conn.execute("SELECT oi.order_id, oi.product_id, p.name, oi.qty, oi.price FROM order_items oi "
                        "JOIN products p ON p.id = oi.product_id WHERE oi.order_id = ANY(%s) "
                        "ORDER BY oi.order_id, oi.product_id", (order_ids,)).fetchall()


@app.get("/api/orders")
def orders(user_id: int = Depends(current_user)):
    with connection() as conn:
        rows = conn.execute("SELECT id, status, total, created_at FROM orders WHERE user_id = %s "
                            "ORDER BY created_at DESC, id DESC LIMIT 20", (user_id,)).fetchall()
        if settings.BUG_N_PLUS_ONE:
            for row in rows:
                row["items"] = order_items(conn, [row["id"]])
        else:
            grouped = {row["id"]: [] for row in rows}
            for item in order_items(conn, list(grouped)):
                grouped[item["order_id"]].append(item)
            for row in rows:
                row["items"] = grouped[row["id"]]
    return rows


@app.get("/api/orders/{id}")
def get_order(id: int, user_id: int = Depends(current_user)):
    with connection() as conn:
        row = conn.execute("SELECT id, status, total, created_at FROM orders WHERE id = %s AND user_id = %s",
                           (id, user_id)).fetchone()
        if row is None:
            raise HTTPException(404, "order not found")
        row["items"] = order_items(conn, [id])
    return row
