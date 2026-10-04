"""Настройки читаются один раз при запуске каждого воркера."""
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://shop:shop@postgres:5432/shop")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
PAYMENT_URL = os.getenv("PAYMENT_URL", "http://payment:8001")
DB_POOL_MIN = int(os.getenv("DB_POOL_MIN", "1"))
DB_POOL_MAX = int(os.getenv("DB_POOL_MAX", "5"))
DB_POOL_TIMEOUT = float(os.getenv("DB_POOL_TIMEOUT", "5"))
BCRYPT_ROUNDS = int(os.getenv("BCRYPT_ROUNDS", "12"))
CACHE_ENABLED = os.getenv("CACHE_ENABLED", "0") == "1"
CACHE_TTL = int(os.getenv("CACHE_TTL", "60"))
BUG_N_PLUS_ONE = os.getenv("BUG_N_PLUS_ONE", "1") == "1"
LEAK_ENABLED = os.getenv("LEAK_ENABLED", "0") == "1"
PAYMENT_TIMEOUT = float(os.getenv("PAYMENT_TIMEOUT", "10"))
PAYMENT_RETRIES = int(os.getenv("PAYMENT_RETRIES", "3"))
SESSION_TTL = int(os.getenv("SESSION_TTL", "3600"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
if not 0 <= DB_POOL_MIN <= DB_POOL_MAX or DB_POOL_MAX < 1:
    raise ValueError("Неверные границы пула БД")
if not 4 <= BCRYPT_ROUNDS <= 31 or PAYMENT_RETRIES < 0:
    raise ValueError("Неверная стоимость bcrypt или число повторов")
if min(DB_POOL_TIMEOUT, CACHE_TTL, PAYMENT_TIMEOUT, SESSION_TTL) <= 0:
    raise ValueError("Таймауты и TTL должны быть положительными")
