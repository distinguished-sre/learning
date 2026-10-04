FROM python:3.14.8-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh
ENV PYTHONUNBUFFERED=1 PROMETHEUS_MULTIPROC_DIR=/tmp/shop-metrics
EXPOSE 8000
ENTRYPOINT ["./entrypoint.sh"]
