from time import perf_counter

import httpx
from fastapi import HTTPException

from . import metrics, settings

client = httpx.Client(base_url=settings.PAYMENT_URL, timeout=settings.PAYMENT_TIMEOUT)


def pay(order_id, amount):
    # Повторы БЕЗ паузы намеренно создают шторм при сбое зависимости.
    last_result = "error"
    for _ in range(settings.PAYMENT_RETRIES + 1):
        started = perf_counter()
        result = "error"
        try:
            response = client.post("/pay", json={"order_id": order_id, "amount": float(amount)})
            if response.is_success:
                result = "ok"
        except httpx.TimeoutException:
            result = "timeout"
        except httpx.RequestError:
            result = "error"
        finally:
            metrics.PAYMENTS.labels(result=result).inc()
            metrics.PAYMENT_DURATION.observe(perf_counter() - started)
        if result == "ok":
            return
        last_result = result
    if last_result == "timeout":
        raise HTTPException(504, "payment timeout")
    raise HTTPException(502, "payment failed")
