# VERO SafeGuard — Visual Guide

Parametric income protection for India's food delivery workers.
This guide is for anyone who has just cloned the repo and wants to understand what they are looking at, how to run it, and how to demo it end-to-end.

---

## What VERO Does

Food delivery riders on Zomato and Swiggy lose income every time something outside their control hits — a hailstorm, a toxic AQI day, a platform outage, a city bandh. No existing system compensates for this.

VERO monitors four disruption types in real time using independent third-party data. When a disruption is confirmed, money goes directly to the rider's UPI wallet in 30-minute intervals. No claim form. No call. No waiting. The rider does nothing — VERO does everything automatically.

---

## Quick Start

### Prerequisites
- Docker Desktop installed and running
- Git

### Steps

```bash
git clone <repo-url>
cd VERO_SafeGuard
docker compose up --build
```

That is it. Docker handles everything — PostgreSQL, the FastAPI backend, the rider PWA, and the admin dashboard. No manual database setup, no pip install, no npm install.

**First run takes 2–3 minutes** while Docker builds the images. Subsequent runs are fast.

### What opens

| URL | What it is |
|---|---|
| http://localhost | Rider PWA (mobile-first) |
| http://localhost:8080 | Admin Command Center |
| http://localhost:8000/docs | Backend API docs (Swagger) |

### To stop

```bash
docker compose down
```

To wipe the database and start completely fresh:

```bash
docker compose down -v
docker compose up --build
```

---

## Credentials

### Rider App (http://localhost)

Five demo riders are pre-seeded with weeks of delivery history. Log in with any of them to see different premium amounts and coverage percentages — the difference is the ML engine reading each rider's history.

| Name | Phone | Password | City | Profile |
|---|---|---|---|---|
| Arjun Mehta | +919000000001 | vero1234 | Mumbai | High performer — lowest premium, 65% coverage |
| Priya Nair | +919000000002 | vero1234 | Bengaluru | Average performer |
| Ravi Kumar | +919000000003 | vero1234 | Delhi | Low performer — highest premium, 40% coverage |
| Deepa Krishnan | +919000000004 | vero1234 | Chennai | Mid-high performer |
| Suresh Babu | +919000000005 | vero1234 | Hyderabad | Recovering performer |

### Admin Dashboard (http://localhost:8080)

| Field | Value |
|---|---|
| Email | admin@vero |
| Password | admin1234 |

---

## Environment Variables

The `.env` file at the project root is loaded automatically by Docker Compose. It is already configured with working defaults — **you do not need to edit anything to run the demo**.

The `.env` file is git-ignored so it will not be committed. The `.env.example` file shows the structure. If you clone the repo and the `.env` file is missing, copy the example:

```bash
cp .env.example .env
```

The defaults in `.env.example` work out of the box for local Docker runs. Razorpay keys are optional — if not set, the app falls back to a direct purchase flow that works without payment processing.

---

## ML Models

Two pre-trained `.pkl` files are committed to the repo at `backend/app/models/`:

- `vero_nn_metrics.pkl` — MLPRegressor that predicts rider performance metrics (TU, DE, CR) from lifestyle features. Output feeds the R-score formula that drives premium and coverage.
- `vero_fraud_iforest.pkl` — IsolationForest trained on 75k synthetic rows with 6 features. Runs on every payout eligibility check to detect GPS spoofing, ghost riders, and coordinated fraud rings.

These are loaded at backend startup. No training step is needed. If you want to retrain from scratch:

```bash
cd backend
python scripts/train_models.py
```

This regenerates both `.pkl` files in `backend/app/models/`. The training script is fully documented with the synthetic data design rationale.

---

## Application Pages

### Rider App

| Page | What it shows |
|---|---|
| Landing | Product overview, what is covered, how it works, sign-up CTA |
| Register | 3-step: phone → OTP → details. OTP appears as a toast in demo mode |
| Login | Phone + password |
| Dashboard | Greeting, R-score, tenure, policy status, zone risk forecast, quick actions |
| Policy | Coverage status, premium, cap usage bar, what is covered, how payouts work |
| Payment | Quote confirmation, Razorpay UPI simulation, 20-second activation countdown |
| Claims | Payout history with filter, summary stats, zero-touch claims explainer |
| Profile | Tier badge, score breakdown, financial summary |
| Notifications | Payout alerts and disruption notifications |
| Simulator | Fire triggers from the rider app, watch payouts arrive in Claims |

### Admin Dashboard

| Tab | What it shows |
|---|---|
| Overview | KPI cards, system integrity, active disruptions, live execution feed |
| Trigger Simulator | Fire any of the 7 trigger types against any zone |
| Analytics | Premium vs payout by city, 7-day payout trend, zone risk actuarial table |
| Fraud Intelligence | ML model explainability, live anomaly telemetry with per-feature breakdown |
| Command Map | Leaflet map with zone risk halos, rider density dots, live disruption overlays |

---

## The Four Triggers

VERO monitors four disruption types simultaneously. Each uses an independent data source the rider cannot influence.

### 1. Weather (Rain / Hailstorm / Extreme Heat)
Source: OpenWeatherMap + Tomorrow.io

- Heavy rain: rainfall > 35mm/hr sustained for 1 hour
- Hailstorm: confirmed alert — fires immediately, no duration requirement
- Extreme heat: temperature > 40°C sustained for 2 hours

### 2. Toxic Air (AQI)
Source: IQAir / CPCB government sensor network

AQI > 300 in the rider's active zone, sustained for 2+ hours during their shift.

### 3. Platform Outage (Zomato / Swiggy — monitored separately)
Source: DownDetector + custom uptime scraper

Platform down for 45+ continuous minutes AND within peak hours (12:00–14:30 or 19:00–22:30). Off-peak outages do not trigger.

### 4. Bandh / Civic Shutdown
Source: NewsAPI.org + Twitter/X trending signals

Proactive — the system reads signals the night before. Oracle confidence > 75% AND restaurant availability drop > 80% AND rider GPS in zone → payouts begin. Rider is notified before the disruption day, not after income is already lost.

**Multi-trigger rule:** If two triggers are active simultaneously for the same rider, only the one producing the highest payout fires. Payouts are never stacked.

---

## Payout Formula

```
Per-interval payout = 0.5 hours × Verified Hourly Income × Coverage %

Coverage % = 40% fixed (weeks 1–2)
           = 40% + (25% × R-score), max 65% (week 3+)

Weekly cap = Coverage % × Verified Weekly Income
```

Payouts fire every 30 minutes while the disruption is active. The weekly cap is enforced — once exhausted, payouts stop for that week.

---

## ML Engine

### Premium and Coverage (MLPRegressor)

Every time a returning rider's quote is requested, the backend:

1. Infers lifestyle features from the rider's profile (shift hours, experience, zone risk)
2. Passes them through the trained MLP to predict TU, DE, CR
3. Computes R = min(√(TU × DE × CR), 1.0)
4. Applies: `Premium = base_rate × zone_risk × (1.5 − R)`
5. Applies: `Coverage = 40% + 25% × R`, capped at 65%

A rider with R = 1.0 pays 0.5× base rate and gets 65% coverage.
A rider with R = 0.0 pays 1.5× base rate and gets 40% coverage.

### Fraud Detection (IsolationForest — 6 features)

Runs on every payout eligibility check in `payout_engine.py`:

| Feature | Normal range | Fraud range |
|---|---|---|
| zone_match_ratio | 0.6 – 1.0 | 0.0 – 0.3 |
| activity_recency_min | 1 – 60 min | 120 – 300 min |
| loss_ratio | 0.5 – 1.5× | 3 – 8× |
| policy_age_hours | 48 – 2000h | 1 – 12h |
| claims_anomaly_ratio | 0.8 – 1.5× | 3 – 6× |
| ping_burst_score | 0 – 3 pings | 10 – 30 pings |

New riders with zero prior payouts receive `claims_anomaly_ratio = 1.0` (neutral midpoint) so they are not false-positive blocked.

---

## Demo Walkthrough

### Step 1 — Show the ML premium difference

1. Log in as Arjun Mehta (+919000000001) → note premium and coverage %
2. Log out, log in as Ravi Kumar (+919000000003) → compare
3. Same city (different), same week, same platform — different price, different coverage
4. The difference is the ML model reading each rider's delivery history

### Step 2 — Generate 8,000 riders

1. Open Admin Dashboard → http://localhost:8080
2. Click "Generate 8k Riders" in the sidebar
3. Watch the progress modal — it shows each phase: clearing, building, inserting
4. When done: ~5,700 active policies, ~2,300 fraud/inactive seeds, ~25,000 activity logs
5. The Command Map updates automatically — zone circles fill with rider density dots

### Step 3 — Fire a trigger

1. Admin Dashboard → Trigger Simulator tab
2. Select a city and zone (Mumbai / Bandra is highest risk at 1.30×)
3. Select "Heavy Rain", set threshold to 60mm/hr, set a 2-hour window
4. Click "Fire Disruption Trigger"
5. Result card shows: riders evaluated, payouts queued, fraud skipped, interval count, estimated payout

### Step 4 — Watch the Live Execution Feed

1. Stay on the Overview tab
2. The Live Execution Feed updates every 5 seconds
3. The newest trigger appears at the top, expanded — showing each rider who received a payout
4. Click any older trigger card to expand its payout history
5. Real riders show with a violet icon, simulated riders with blue

### Step 5 — See fraud detection fire

1. After generating 8k riders, fire a trigger on a zone with many riders
2. Go to Fraud Intelligence tab
3. The anomaly telemetry shows each fraud check with per-feature breakdown
4. Fraudster riders (wrong zone, stale activity, high loss ratio) show BLOCK in red
5. Legitimate riders show PASS in green with their anomaly score

### Step 6 — Show the rider experience

1. Log in as any demo rider on http://localhost
2. Go to Claims & Payouts — the payout from Step 3 appears in history
3. The payout shows trigger type, timestamp, amount, and SUCCESS status
4. No claim was filed — it arrived automatically

---

## Architecture

```
Browser (http://localhost)          Browser (http://localhost:8080)
        │                                       │
        ▼                                       ▼
┌───────────────────┐              ┌────────────────────────┐
│  Rider PWA        │              │  Admin Dashboard       │
│  React + Vite     │              │  React + Vite          │
│  Port 80          │              │  Port 8080             │
└────────┬──────────┘              └───────────┬────────────┘
         │                                     │
         └──────────────┬──────────────────────┘
                        │  /api/*
                        ▼
         ┌──────────────────────────────┐
         │  Backend (FastAPI)           │
         │  Port 8000                   │
         │                              │
         │  ┌────────────────────────┐  │
         │  │  ML Engine             │  │
         │  │  vero_nn_metrics.pkl   │  │
         │  │  vero_fraud_iforest.pkl│  │
         │  └────────────────────────┘  │
         └──────────────┬───────────────┘
                        │
                        ▼
         ┌──────────────────────────────┐
         │  PostgreSQL + Redis          │
         │  Port 5432 (internal)        │
         └──────────────────────────────┘
```

---

## File Structure

```
VERO_SafeGuard/
├── backend/
│   ├── app/
│   │   ├── core/          config, security (JWT, admin key)
│   │   ├── db/            SQLAlchemy models, init_db seeder
│   │   ├── models/        vero_nn_metrics.pkl, vero_fraud_iforest.pkl
│   │   ├── routers/       auth, policies, triggers, dashboards, tracking
│   │   ├── schemas/       Pydantic request/response models
│   │   ├── services/      insurance_logic, payout_engine, trigger_engine, mock_api
│   │   ├── ml_engine.py   inference layer — loads pkl, exposes predict functions
│   │   └── main.py        FastAPI app, startup seeding, CORS
│   ├── scripts/
│   │   └── train_models.py  offline training script (not run by Docker)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/              Rider PWA (React + Tailwind)
├── admin-dashboard/       Admin Command Center (React + Tailwind)
├── docker-compose.yml
├── .env                   git-ignored, loaded by Docker Compose
├── .env.example           committed, shows required variables
├── VISUAL_GUIDE.md        this file
└── README.md              full product specification
```

---

## Common Issues

**Port 80 already in use**
Something else is using port 80 (IIS, another web server). Stop it or change the frontend port in `docker-compose.yml`:
```yaml
frontend:
  ports:
    - "3000:80"
```
Then access the rider app at http://localhost:3000.

**Port 8080 already in use**
Change the admin dashboard port:
```yaml
admin-dashboard:
  ports:
    - "8081:80"
```

**Backend keeps restarting**
The backend waits for PostgreSQL to be healthy before starting. If it restarts more than 3 times, run:
```bash
docker compose logs backend
```
Usually a database connection issue. Run `docker compose down -v && docker compose up --build` for a clean start.

**"No geo zones found" error when generating riders**
The database seeder runs on startup. If you see this, the backend started before the seeder finished. Restart the backend:
```bash
docker compose restart backend
```

**Trigger fires but no payouts appear**
Check that riders exist in the target zone. Generate 8k riders first (Admin → sidebar → Generate 8k Riders), then fire the trigger.
