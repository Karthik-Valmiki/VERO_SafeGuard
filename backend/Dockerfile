FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Force fresh copy of app code
ARG CACHE_BUSTER=unknown
RUN echo "Cache buster: $CACHE_BUSTER"

COPY app/ ./app/

EXPOSE 8000

# Production command for Docker
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
