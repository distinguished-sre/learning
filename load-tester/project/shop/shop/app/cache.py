import json

from fastapi.encoders import jsonable_encoder
from redis import Redis

from . import metrics, settings

redis = Redis.from_url(settings.REDIS_URL, decode_responses=True,
                       socket_timeout=5, socket_connect_timeout=5)


def cached_product(product_id):
    value = redis.get(f"product:{product_id}")
    metrics.CACHE.labels(result="hit" if value else "miss").inc()
    return json.loads(value) if value else None


def save_product(product):
    redis.setex(f"product:{product['id']}", settings.CACHE_TTL,
                json.dumps(jsonable_encoder(product)))
