"""Трейсы OpenTelemetry: спан запроса /pay; контекст приходит в заголовке traceparent от shop."""
import logging
import os

ENABLED = os.getenv("TRACING_ENABLED", "1") == "1"
# Ошибки экспорта (коллектор не запущен) не должны засорять журнал.
logging.getLogger("opentelemetry").setLevel(os.getenv("OTEL_LOG_LEVEL", "CRITICAL"))


def setup(app):
    if not ENABLED:
        return
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor

    provider = TracerProvider(resource=Resource.create())
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    FastAPIInstrumentor.instrument_app(app, excluded_urls="healthz,metrics", exclude_spans=["receive", "send"])
