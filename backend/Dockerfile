# ─────────────────────────────────────────────────────────────────────────────
# VERO SafeGuard — Backend (FastAPI + PostgreSQL + ML Engine)
#
# What this image contains:
#   - FastAPI application serving the parametric insurance API
#   - Pre-trained ML models (IsolationForest + MLP) baked directly into the
#     image — no training step needed at runtime
#   - DPDP 2023-compliant OTP/KYC/UPI verification endpoints
#   - IRDAI parametric trigger engine (Weather, AQI, Platform Blackout,
#     Social Disruption)
#   - Idempotent DB migration + seed runs automatically on startup
#
# Compliance context baked into this image:
#   IRDAI Sandbox Reg. 2023 — parametric trigger thresholds enforced in code
#   DPDP Act 2023 §5/§7   — UPI KYC penny-drop + explicit consent gating
#   NPCI UPI ecosystem     — VPA validation + bank handle resolution
# ─────────────────────────────────────────────────────────────────────────────

FROM python:3.11-slim

LABEL org.opencontainers.image.title="VERO SafeGuard — Backend API" \
      org.opencontainers.image.description="Parametric income-protection engine for Indian gig workers. IRDAI Sandbox 2023 + DPDP Act 2023 compliant." \
      org.opencontainers.image.vendor="VERO SafeGuard — Guidewire DEVTrails 2026" \
      org.opencontainers.image.version="2.0" \
      compliance.irdai="Parametric Trigger Engine — Weather/AQI/Platform/Social" \
      compliance.dpdp="DPDP 2023 §5 consent gating + §7 UPI KYC penny-drop" \
      compliance.npci="NPCI UPI VPA validation + bank handle resolution" \
      ml.models="IsolationForest (fraud) + MLPRegressor (rider metrics) — pre-trained, baked into image"

WORKDIR /app

# Install system dependencies for psycopg2 and scikit-learn.
# --no-install-recommends keeps the image lean; cache is purged in the same
# RUN layer to avoid a dangling layer inflating image size.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# Copy requirements first so Docker can cache the pip install layer
# independently of source changes — significantly speeds up rebuilds.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source, including:
#   app/models/vero_nn_metrics.pkl     — MLP rider-metrics predictor
#   app/models/vero_fraud_iforest.pkl  — IsolationForest fraud detector
# Both .pkl files are committed to the repo so the ML engine starts in
# PRODUCTION mode immediately, without needing a train step.
COPY app/ ./app/

# Suppress .pyc generation and stdout buffering in containers.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# docker-compose.yml overrides this command, but it is kept here so the image
# can be run standalone with: docker run -p 8000:8000 vero-backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
