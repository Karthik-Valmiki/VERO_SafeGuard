# ─────────────────────────────────────────────────────────────────────────────
# VERO SafeGuard — Rider App (React + Vite → nginx)
#
# Multi-stage build:
#   deps    — installs node_modules, cached independently of source
#   builder — compiles production bundle with VITE_* env vars baked in
#   prod    — minimal nginx:alpine image, serves the static bundle
#
# VITE_* vars are build-time only (baked into the JS bundle).
# They do NOT need to be present at container runtime.
#
# Features bundled into this image:
#   - DPDP 2023-compliant 5-phase onboarding (Phone → OTP → Details → Consent → UPI)
#   - UPI segmented input: mobile number + bank handle picker, or raw VPA alias
#   - Simulated NPCI penny-drop KYC flow (DPDP §7)
#   - Explicit per-item consent with revocation notice (DPDP §5)
#   - Parametric policy purchase via Razorpay (IRDAI Sandbox)
#   - Live payout notifications during active disruption events
# ─────────────────────────────────────────────────────────────────────────────

# Stage 1: Dependency install — cached separately so source changes don't
# invalidate the npm install layer on every rebuild.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

# Stage 2: Production bundle — VITE_* build args are injected here and baked
# into the compiled JS. NODE_OPTIONS bump avoids OOM on large dependency trees.
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

# Stage 3: Production runtime — only the compiled static assets are copied.
# nginx.conf handles SPA routing (all paths → index.html) and proxies
# /api/* to the backend service so CORS never surfaces in production.
FROM nginx:alpine AS prod

LABEL org.opencontainers.image.title="VERO SafeGuard — Rider App" \
      org.opencontainers.image.description="DPDP 2023-compliant rider onboarding and income-protection dashboard. NPCI UPI KYC + IRDAI parametric policy." \
      org.opencontainers.image.vendor="VERO SafeGuard — Guidewire DEVTrails 2026" \
      org.opencontainers.image.version="2.0" \
      compliance.dpdp="5-phase onboarding: Phone/OTP/Details/Consent/UPI — DPDP §5 + §7" \
      compliance.npci="UPI penny-drop KYC with bank handle resolution" \
      compliance.irdai="Parametric policy purchase + live payout display"

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
