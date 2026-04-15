# ─────────────────────────────────────────────────────────────────────────────
# VERO SafeGuard — Admin Dashboard (React + Vite → nginx)
#
# Multi-stage build identical in structure to the rider app Dockerfile.
# Served on port 8080 (mapped from nginx:80 inside the container).
#
# Features bundled into this image:
#   - ML Explainability panel: IsolationForest + MLP feature importance
#   - Live Execution Feed: real-time payout stream grouped by trigger event
#   - Fraud Intelligence: per-rider anomaly scores with 6-feature breakdown
#   - Command Map: zone-level risk heat map + active disruption overlays
#   - Trigger Simulator: Weather / AQI / Platform Blackout / Social Disruption
#   - 8k Rider Generator: background job with live progress tracking
#   - IRDAI-compliant threshold enforcement visible in threshold_check logs
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Dependency install — cached separately so source changes don't
# invalidate the npm install layer on every rebuild.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# Stage 2: Production bundle — VITE_* build args baked into the compiled JS.
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG VITE_API_URL
ARG VITE_ADMIN_USER
ARG VITE_ADMIN_PASS
ARG VITE_ADMIN_API_KEY

ENV VITE_API_URL=$VITE_API_URL \
    VITE_ADMIN_USER=$VITE_ADMIN_USER \
    VITE_ADMIN_PASS=$VITE_ADMIN_PASS \
    VITE_ADMIN_API_KEY=$VITE_ADMIN_API_KEY \
    NODE_OPTIONS="--max-old-space-size=4096"

RUN npm run build

# Stage 3: Production runtime — static assets only, served by nginx.
# nginx.conf routes all paths to index.html (SPA) and proxies /api/* to backend.
FROM nginx:alpine AS prod

LABEL org.opencontainers.image.title="VERO SafeGuard — Admin Dashboard" \
      org.opencontainers.image.description="IRDAI-compliant admin control plane. ML explainability, fraud intelligence, live payout feed, and parametric trigger simulator." \
      org.opencontainers.image.vendor="VERO SafeGuard — Guidewire DEVTrails 2026" \
      org.opencontainers.image.version="2.0" \
      compliance.irdai="Threshold-gated trigger simulator + Oracle verification pipeline" \
      ml.fraud="IsolationForest 6-feature anomaly explainer" \
      ml.metrics="MLPRegressor (64→32) rider performance predictor" \
      demo.riders="8k mock rider generator with shift-based payout distribution"

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
