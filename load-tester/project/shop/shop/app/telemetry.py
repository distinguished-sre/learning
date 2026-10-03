"""Трейсы OpenTelemetry: спаны запросов, PostgreSQL, Redis и исходящих вызовов в payment."""
import logging
import os
from contextlib import nullcontext

from opentelemetry import trace

ENABLED = os.getenv("TRACING_ENABLED", "1") == "1"
# Ошибки экспорта (коллектор не запущен) не должны засорять журнал магазина.
logging.getLogger("opentelemetry").setLevel(os.getenv("OTEL_LOG_LEVEL", "CRITICAL"))
tracer = trace.get_tracer("shop")


def span(name):
    """Ручной спан; внутри suppress_instrumentation (например, /readyz) спан не создаётся."""
    from opentelemetry.instrumentation.utils import is_instrumentation_enabled
    if ENABLED and is_instrumentation_enabled():
        return tracer.start_as_current_span(name)
    return nullcontext()


def trace_id():
    """32 hex-символа trace_id текущего запроса или None, если спана нет."""
    context = trace.get_current_span().get_span_context()
    return format(context.trace_id, "032x") if context.is_valid else None


def setup(app):
    if not ENABLED:
        return
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
    from opentelemetry.instrumentation.psycopg import PsycopgInstrumentor
    from opentelemetry.instrumentation.redis import RedisInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    # Имя сервиса, адрес коллектора и сэмплирование приходят из переменных OTEL_*.
    provider = TracerProvider(resource=Resource.create())
    # Пакетный экспорт в отдельном потоке: запрос не ждёт коллектор, а при
    # полной очереди лишние спаны отбрасываются.
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    PsycopgInstrumentor().instrument()
    RedisInstrumentor().instrument()
    HTTPXClientInstrumentor().instrument()
    FastAPIInstrumentor.instrument_app(app, excluded_urls="healthz,readyz,metrics",
                                       exclude_spans=["receive", "send"])
