import json
import logging
import sys
from datetime import datetime, timezone

from . import settings


class JsonFormatter(logging.Formatter):
    def format(self, record):
        payload = {"ts": datetime.now(timezone.utc).isoformat(), "level": record.levelname,
                   "msg": record.getMessage()}
        payload.update(getattr(record, "fields", {}))
        if record.exc_info:
            payload["error"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(JsonFormatter())
logging.basicConfig(level=settings.LOG_LEVEL, handlers=[handler], force=True)
logger = logging.getLogger("shop")

# Детали HTTP-клиента не должны дублировать журнал запросов магазина.
logging.getLogger("httpx").setLevel(logging.WARNING)
