import os
import random
import threading
import time
from decimal import Decimal

from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel, Field
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

import telemetry

app = FastAPI(title="Учебная оплата")
telemetry.setup(app)
lock = threading.Lock()
config = {"delay_ms": float(os.getenv("PAYMENT_DELAY_MS", "50")),
          "fail_rate": float(os.getenv("PAYMENT_FAIL_RATE", "0.0"))}
if config["delay_ms"] < 0 or not 0 <= config["fail_rate"] <= 1:
    raise ValueError("Неверные настройки оплаты")
requests = Counter("payment_requests_total", "Оплаты", ("status",))
duration = Histogram("payment_duration_seconds", "Длительность оплаты",
                     buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.3, 0.5, 1, 2.5, 5, 10))


class Payment(BaseModel):
    order_id: int = Field(ge=1)
    amount: Decimal = Field(gt=0)


class Config(BaseModel):
    delay_ms: float | None = Field(None, ge=0, allow_inf_nan=False)
    fail_rate: float | None = Field(None, ge=0, le=1, allow_inf_nan=False)


@app.post("/pay")
def pay(data: Payment):
    started = time.perf_counter()
    with lock:
        current = config.copy()
    # Разброс имитирует непостоянную задержку внешней сети.
    time.sleep(current["delay_ms"] / 1000 * random.uniform(0.8, 1.2))
    failed = random.random() < current["fail_rate"]
    requests.labels(status="500" if failed else "200").inc()
    duration.observe(time.perf_counter() - started)
    if failed:
        raise HTTPException(500, "payment rejected")
    return {"status": "paid", "order_id": data.order_id}


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), headers={"Content-Type": CONTENT_TYPE_LATEST})


@app.get("/admin/config")
def get_config():
    with lock:
        return config.copy()


@app.post("/admin/config")
def set_config(data: Config):
    with lock:
        # None означает «оставить прежнее значение», включая явный JSON null.
        config.update(data.model_dump(exclude_none=True))
        return config.copy()
