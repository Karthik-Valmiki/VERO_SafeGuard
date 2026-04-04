# VERO — Visual Guide
### Parametric Income Protection for India's Food Delivery Workers
> Theme: **Protect the Worker**

---

## Pages at a Glance

| Page | What it shows |
|---|---|
| Landing | Product overview, what is covered, how it works, sign-up CTA |
| Register | 3-step flow: phone → OTP → details |
| Login | Phone + password, straight to dashboard |
| Dashboard | Greeting, R-score, tenure, policy status, risk forecast, quick actions |
| Policy | Coverage status, Dynamic premium, cap usage bar, what is covered, how payouts work |
| Payment | Quote confirmation, UPI payment simulation, activation countdown |
| Claims | Payout history, summary stats, zero-touch claims explainer |
| Simulator | Fire triggers, see mock API responses, watch payouts generate |
| Profile | Tier badge, score breakdown, financial summary, account details |
| Notifications | Payout alerts and disruption notifications |

---


## What This Product Does

India's food delivery riders lose income every time something outside their control hits — a hailstorm, a toxic AQI day, a platform outage, a city bandh. There is no existing system that compensates for this. VERO fixes that.

When a disruption is confirmed through independent third-party data, money goes directly to the rider's UPI wallet in 30-minute intervals. No claim form. No call. No waiting. The rider does nothing — VERO does everything.

---

## How to Run

Make sure Docker Desktop is running, then from the project root:

```
start-and-open.bat
```

This builds and starts all three services (PostgreSQL, backend, frontend) and opens the app at `http://localhost`. The backend API docs are at `http://localhost:8000/docs`.

To stop everything:

```
stop.bat
```

On first run, the backend automatically seeds the database with cities, zones, and five demo riders before starting the server. No manual setup needed.

---

## Demo Login Credentials

For the demo, use any of these pre-seeded returning riders. These accounts already have weeks of delivery history in the database, which is what drives the ML-based premium and coverage differences you will see between them.

| Name | Phone | Password | City | Platform | Profile |
|---|---|---|---|---|---|
| Arjun Mehta | +919000000001 | vero1234 | Mumbai | Zomato | High performer |
| Priya Nair | +919000000002 | vero1234 | Bengaluru | Swiggy | Average performer |
| Ravi Kumar | +919000000003 | vero1234 | Delhi | Zomato | Low performer |
| Deepa Krishnan | +919000000004 | vero1234 | Chennai | Swiggy | Mid-high performer |
| Suresh Babu | +919000000005 | vero1234 | Hyderabad | Zomato | Recovering performer |

Log in with any of these and you will immediately see different premium amounts and coverage percentages — that difference is the ML engine at work.

---

## Full Workflow

### New User Path

A brand new rider has no delivery history. The system handles this by:

- Using city-level baseline income as the earnings reference
- Applying a city-level default risk multiplier (Delhi is highest at 1.30×, other cities lower)
- Fixing coverage at 40% — enough to be meaningful, not enough to make joining right before a bad week profitable
- Enforcing a 24-hour activation window — a rider who reads tonight's bandh announcement and buys immediately cannot claim against it tomorrow

The new user flow in the app is three steps:

**Step 1 — Phone**
Enter a 10-digit number. The system sends a 6-digit OTP. In demo mode, the OTP appears as a floating toast notification on screen so you do not need a real SMS.

**Step 2 — Verify**
Enter the OTP. Once verified, the phone number is confirmed.

**Step 3 — Details**
Fill in name, password, UPI ID, platform (Zomato or Swiggy), city, and shift hours. Submit — account is created and the rider lands on the dashboard.

---

### Returning User Path (Demo Focus)

From week 3 onward, the system has enough delivery data to personalise everything. This is where the ML engine takes over.

The backend tracks three dimensions of each rider's delivery behaviour across weeks:

- **Availability** — how many hours they were active relative to their zone peers
- **Efficiency** — how many orders they completed relative to their zone peers
- **Completion rate** — what fraction of accepted orders they actually delivered

These three signals are fed into the ML model, which produces a single score between 0 and 1. That score directly controls two things: how much the rider pays, and how much they are covered for.

**The outcome:**
- A high-scoring rider (consistent, efficient, high completion) pays a lower premium and gets higher coverage — up to 65%
- A low-scoring rider pays more and gets less — floor is 40% coverage
- The difference between the best and worst rider in the demo is visible the moment you log in

This is not a flat discount. The ML model recalculates every week based on fresh data. A rider who improves their behaviour moves up. A rider who becomes inconsistent moves down.

**Profile page** shows the score breakdown visually — three mini progress bars for Availability, Efficiency, and Completion, plus a circular gauge for the overall score. Riders are also assigned a tier (Bronze → Silver → Gold → Elite) based on their score, with the benefits of each tier shown clearly.

---

## The Four Triggers

VERO monitors four types of disruption simultaneously. Each one uses a specific independent data source — the rider cannot influence any of them.

### 1. Heavy Rain / Hailstorm / Extreme Heat
Source: OpenWeatherMap + Tomorrow.io

- Heavy rain fires when rainfall exceeds 35mm/hr sustained for at least 1 hour
- Hailstorm fires immediately on confirmation — no duration requirement, riding in hail is immediately dangerous
- Extreme heat fires when temperature exceeds 40°C sustained for 2 hours

### 2. Toxic Air (AQI)
Source: IQAir / CPCB government sensor network

Fires when AQI exceeds 300 in the rider's active zone, sustained for more than 2 hours during their shift. This is the Delhi winter scenario — hazardous air that cuts trip completion rates significantly.

### 3. Platform Outage (Zomato / Swiggy — monitored separately)
Source: DownDetector + custom uptime scraper

Fires when a platform is down for more than 45 continuous minutes AND the outage falls within peak hours (12:00–14:30 or 19:00–22:30). Off-peak outages do not trigger — a 3am outage does not affect earnings. Zomato and Swiggy are monitored independently.

### 4. Bandh / Civic Shutdown
Source: NewsAPI.org + Twitter/X trending signals

This one is proactive. The system reads signals the night before — government notices, news articles, trending hashtags — and scores them into a confidence percentage. When confidence crosses 75% AND restaurant availability in the zone drops above 80% AND the rider's GPS confirms they are in the affected zone, payouts begin. The rider is notified the night before, not after they have already lost the income.

**Multi-trigger rule:** If two triggers are active at the same time for the same rider, only the one producing the highest payout fires. Payouts are never stacked.

---

## Payout Logic

Every 30 minutes while a disruption is active:

```
Payout per interval = 0.5 hours × Verified Hourly Income × Coverage %
```

- Verified hourly income comes from city baseline for new users, or from the rider's own verified earnings from week 3 onward
- Coverage % is 40% fixed for new users, or 40–65% based on the ML score for returning users
- A weekly cap applies — Coverage % × Verified Weekly Income. Once the cap is exhausted, payouts stop for that week
- An SMS is sent at the first interval with a trigger event ID. Subsequent intervals within the same event are processed silently

---

## Registration Process (What the Evaluator Sees)

1. Open `http://localhost`
2. Tap "Get covered — ₹50/week" or "Create free account"
3. Enter a phone number → OTP appears as a toast → enter it → verify
4. Fill in name, password, UPI ID, platform, city, shift hours → submit
5. Land on dashboard — quote is shown immediately with premium and coverage for the coming week

---

## Insurance Policy Management (What the Evaluator Sees)

1. Log in with any demo account
2. Dashboard shows current policy status — coverage %, premium paid, weekly cap, cap used so far
3. Navigate to "My Policy" for full details — what is covered, how payouts work, policy metadata
4. If no policy is active, the quote is shown with a single "Activate Protection" button
5. Payment screen shows the premium, coverage %, and weekly cap — tap to activate
6. In demo mode, the policy activates in 20 seconds (production enforces a 24-hour window)

---

## Dynamic Premium Calculation (What the Evaluator Sees)

Log in with different demo accounts and compare the numbers on the dashboard and payment screen:

- Arjun Mehta (Mumbai, high performer) — lowest premium, highest coverage
- Ravi Kumar (Delhi, low performer) — highest premium, lowest coverage
- Priya Nair (Bengaluru, average) — mid-range on both

The difference is entirely driven by the ML model reading each rider's delivery history. Same city, same platform, same week — different price, different coverage. That is the personalisation working.

The dashboard also shows a "Next Week Risk Forecast" card — a risk bar that reflects the zone's environmental, AQI, and social disruption forecast for the coming week. High-risk weeks push the base rate up for everyone in that zone.

---

## Claims Management (What the Evaluator Sees)

1. Log in with a demo account that has an active policy
2. Navigate to "Claims & Payouts"
3. Summary cards show total received, number of payouts, and remaining cap
4. Payout history lists each transaction with trigger type, timestamp, amount, and status
5. To generate a payout, go to the Trigger Simulator

---

## Trigger Simulator

The simulator is the demo tool for showing the automated trigger and payout system live. Access it from the dashboard via the "Simulate" button (yellow, top right).

**How to use it:**

1. Confirm the Zone ID (pre-filled from your registered zone)
2. Select a trigger type from the dropdown — Heavy Rain, Hailstorm, Extreme Heat, Toxic Air, Zomato Outage, Swiggy Outage, or Bandh
3. Enter a threshold value above the minimum (the UI shows green/red feedback in real time)
4. Set a start and end time for the disruption window
5. Optionally add up to 3 triggers to fire simultaneously — the multi-trigger resolution rule will show which one wins
6. Tap "Fire Trigger"

**What happens:**

- The backend calls the mock API for that trigger type (simulating OpenWeatherMap, IQAir, DownDetector, or NewsAPI)
- The threshold is validated against the trigger rules
- If passed, a trigger event is created, eligible riders in the zone are identified, and payouts are queued as a background task
- The result card shows: overlap hours, interval count, estimated payout, and the raw mock API response (source, readings, threshold check)
- Navigate to Claims & Payouts — the new payout appears in the history

**For platform outage triggers:** the start time must fall within peak hours (12:00–14:30 or 19:00–22:30) or the trigger will be rejected. This is by design.

**For bandh triggers:** confidence must exceed 75% AND restaurant closure must exceed 80%. Zone 1 (Chennai/Adyar) and Zone 6 (Delhi/Connaught Place) have pre-configured social signal data that will pass this threshold.

---

## What the ML Engine Actually Does

The premium and coverage numbers are not hardcoded per rider. Every time a quote is requested, the backend:

1. Pulls the rider's last 4 weeks of performance history from the database
2. Computes their score from the three delivery behaviour dimensions
3. Applies that score to the base rate formula: `Premium = Base Rate × Zone Risk × (1.5 − Score)`
4. Computes coverage: `Coverage = 40% + (25% × Score)`, capped at 65%

A rider with a score of 1.0 pays 0.5× the base rate and gets 65% coverage.
A rider with a score of 0.0 pays 1.5× the base rate and gets 40% coverage.

The zone risk multiplier is layered on top — a rider in a historically high-disruption zone pays more regardless of their personal score. From week 5 onward, city-level defaults are replaced by pin-code level zone history specific to the rider's registered delivery zones.

---

## Fraud Prevention (Built Into the Design)

- No claim form means nothing to fake — triggers fire from independent data the rider cannot influence
- 24-hour activation window blocks last-minute purchases before known disruptions
- Platform outage trigger requires a logged delivery attempt in the last 30 minutes — someone who opened the app purely to collect a payout is ineligible
- GPS zone matching — rider must be in their registered zone when the disruption fires
- Personal loss ratio monitor — if total payouts exceed 1.8× total premiums paid, a compounding surcharge applies to the following week's premium
- Duplicate trigger blocking — the same event ID cannot produce duplicate payouts under the same policy


