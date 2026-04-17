# VERO — AI-Powered Parametric Income Protection for India's Food Delivery Workers

<p align="center">
  <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" />
  <img src="https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi" alt="FastAPI" />
  <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white" alt="Python" />
  <img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/scikit--learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white" alt="scikit-learn" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Razorpay-02042B?style=for-the-badge&logo=razorpay&logoColor=3395FF" alt="Razorpay" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
</p>

> **Setup Instructions:** To run this project locally, refer to **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**.
>
> **Pitch Deck:** Explore the complete architecture, including the ML pipeline, fraud detection system, and the business viability of the weekly pricing model — [View Pitch Deck](https://drive.google.com/file/d/11Kw09F-xZBmPYMXd9IdsvJLgSeKupLg3/view)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [What VERO Does](#3-what-vero-does)
4. [What Makes VERO Different](#4-what-makes-vero-different)
5. [Product Philosophy](#5-product-philosophy)
6. [Persona](#6-persona-food-delivery-partner-zomato--swiggy)
7. [User Categorization](#7-user-categorization--new-vs-returning)
8. [Three Core Features](#8-three-core-features)
   - 8.1 [Parametric Trigger System](#81-parametric-trigger-system)
   - 8.2 [Adaptive Weekly Premium Engine](#82-adaptive-weekly-premium-engine)
   - 8.3 [Income Continuity Guarantee](#83-income-continuity-guarantee)
9. [Payout Logic](#9-payout-logic)
10. [Policy Activation Rule](#10-policy-activation-rule)
11. [Financial Sustainability Model](#11-financial-sustainability-model)
12. [Adverse Selection Handling](#12-adverse-selection-handling)
13. [Fraud Prevention Design](#13-fraud-prevention-design)
14. [Application Workflow](#14-application-workflow)
15. [AI/ML Integration Plan](#15-aiml-integration-plan)
16. [Tech Stack](#16-tech-stack)
17. [6-Week Development Plan](#17-6-week-development-plan)
18. [Analytics Dashboard](#18-analytics-dashboard)
19. [Constraint Compliance](#19-constraint-compliance)
20. [Adversarial Defense & Anti-Spoofing Strategy](#20-adversarial-defense--anti-spoofing-strategy)

---

## 1. Executive Summary

India has over **1 million platform-based food delivery workers** on Zomato and Swiggy sustaining a ₹35,800 crore digital economy — yet not one of them has access to income protection when disruptions hit. A hailstorm, a platform outage, a city-wide bandh: the income loss happens, and nothing compensates for it.

**VERO is a parametric income protection platform built exclusively for these riders.** VERO — meaning *true* and *genuine* — reflects the core promise: coverage flows only to riders who are genuinely out there working. When a disruption is confirmed through independent third-party data, income compensation is transferred directly to the rider's UPI wallet in 30-minute intervals — automatically, with no claim form, no paperwork, and no delay.

### What sets VERO apart

**Platform outage coverage — a first.** When Zomato or Swiggy goes down during peak dinner hours, riders lose their highest-earning window with zero recourse. VERO is the only product that covers this, verified through neutral third-party uptime monitoring with no rider action required.

**Pre-armed social disruption coverage.** Bandhs are announced the night before — not detected on the day. VERO's Social Disruption Oracle reads those signals overnight and activates coverage before the rider even leaves home, not after the income is already lost.

**Adverse selection solved at the design level.** A 24-hour activation window, a continuity payout scale tied to rider tenure, and a personal loss ratio monitor make opportunistic last-minute purchasing structurally unprofitable — without requiring any enforcement after the fact.

**Personalized pricing via Reliability Score (R).** From week 3 onward, every rider's premium and coverage percentage are calculated from their own delivery activity data. A consistently active, efficient rider pays less and receives more. The two outcomes compound — sustained engagement is meaningfully rewarded.

**Resilient against coordinated fraud.** VERO's validation pipeline is grounded in independent data, device-level behavioral signals, and population-level anomaly detection — not GPS alone. A fraudster can fake a location coordinate. They cannot simultaneously fake a government weather feed, a third-party uptime monitor, and delivery activity patterns — across 500 devices in the same 15-minute window.

**Stack:** React PWA · FastAPI (Python) · PostgreSQL · scikit-learn ML · Open-Meteo API · GDELT Project · Razorpay Sandbox

---

## 2. Problem Statement

India has over 1 million platform-based food delivery workers operating on Zomato and Swiggy. These workers sustain a ₹35,800 crore digital economy but operate without any income safety net.

Their earnings are disrupted regularly by events entirely outside their control:

- Heavy rainfall, hailstorms, and extreme winds that make roads unsafe and cut delivery speeds
- High AQI levels that significantly reduce trip completion rates over sustained periods
- Platform app outages during peak meal hours that make earning physically impossible
- Bandhs, curfews, and civic shutdowns that close entire zones with little to no warning

When any disruption hits, the rider absorbs the full financial loss. There is no existing system — government, platform, or insurance — that compensates for this income shock. The rider either works through dangerous conditions or loses the day's income entirely.

---

## 3. What VERO Does

VERO watches for disruptions in real time, checks them against independent sources, and sends income compensation directly to the rider's UPI wallet every 30 minutes. No claim needed. No paperwork.

The rule is simple: if a disruption is confirmed by independent third-party data and the rider was working in the affected zone with an active policy, they get paid — for as long as the disruption lasts.

**What VERO does not cover:** Health, accident, or vehicle damage. Every trigger and every payout maps to one outcome — the rider could not earn today because of something outside their control.

---

## 4. What Makes VERO Different

Most parametric products for gig workers work the same way — detect bad weather, trigger a payout. Three gaps in that approach came up consistently when we looked at what actually causes income loss for food delivery riders.

**1. Platform outages are not covered anywhere**
When Swiggy or Zomato goes down during a Friday dinner peak, riders lose their highest-earning window with zero recourse. VERO covers this — verified through neutral third-party uptime monitoring, no rider action required.

**2. Social disruption coverage that arms the night before**
Bandhs and curfews are announced the night before, not detected on the day. VERO's Social Disruption Oracle reads those signals overnight and pre-arms coverage before the rider leaves home — not after they have already lost the income.

**3. Adverse selection built out at the design level**
Smart riders can game any subscription insurance by buying only during bad weeks. VERO treats this as a design problem, not an enforcement problem — a continuity payout scale, a loss ratio monitor, and pool math make opportunistic purchasing progressively unprofitable.

---

## 5. Product Philosophy

A Swiggy rider earning ₹80 an hour during a dangerous AQI day or a full bandh has one real choice right now — keep working or go home broke. VERO does not take that choice away. What it does is make stopping financially survivable for the first time. The rider still absorbs 40% of the income gap. But 60% is covered. That is enough to make the decision real.

What the rider does with that is up to them.

---

## 6. Persona: Food Delivery Partner (Zomato / Swiggy)

### 6.1 Who We're Building For

| Attribute | Detail |
|---|---|
| **Segment** | Food Delivery Partners (Zomato, Swiggy) |
| **Age Range** | 19–35 years |
| **Earnings** | ₹10,000–₹25,000/month (₹2,500–₹6,000/week) |
| **Work Pattern** | 6–12 hour shifts centred on lunch (12–2pm) and dinner (7–10pm) peaks |
| **Payment Cycle** | Weekly platform payouts |
| **Device** | Android smartphone — primary work tool |
| **Digital Literacy** | Comfortable with UPI and WhatsApp; limited experience with formal processes |

### 6.2 Persona Scenarios

---

**Scenario 1 — Ravi, Mumbai (Platform Outage)**

Ravi logs in at 7pm on a Friday — the peak dinner window. Swiggy's app goes down for 70 minutes. He sits on his bike outside a restaurant earning nothing. No orders come through. When the app returns, the best hours of his week are gone with no record of what happened and no way to report the lost time.

*VERO detects the outage at minute 1. By minute 47, when the outage crosses the trigger threshold, Ravi's income shield activates automatically. His payout begins processing — no claim filed, no support ticket raised.*

---

**Scenario 2 — Suresh, Delhi (AQI Crisis)**

It is November. Delhi's AQI crosses 380 for the third consecutive day. Suresh can barely breathe. Each delivery takes twice as long as his lungs struggle with the toxic air. Order demand is normal — but his delivery speed has collapsed. He completes half his usual trips in the same hours.

*VERO's AQI monitor detects that Suresh's active zone has crossed the trigger threshold for 4+ hours during his shift. A parametric income payout triggers automatically — no claim, no paperwork, no call to support.*

---

**Scenario 3 — Karan, Bengaluru (City Shutdown)**

A political party announces a bandh for Thursday morning. Karan does not see the news in time. He wakes up, gears up, and rides out — only to find every restaurant shuttered and his zone effectively locked down.

*VERO's Social Disruption Oracle detected the bandh announcement Wednesday night. By 11pm, Karan's zone shield was pre-activated. Thursday morning, when the disruption is confirmed across multiple independent sources, his payout processes before he even leaves home.*

---

## 7. User Categorization — New vs Returning

VERO treats new riders and returning riders differently. The approach changes depending on how much data the system has about the rider.

### 7.1 New Users (Week 1–2)

A new rider joining in week 1 has no history — no zone data, no earnings record, no track record. The system handles this by:

- Using city-level baseline income estimates as the hourly income reference
- Applying city-level default zone multipliers (Delhi: 1.3x, Mumbai: 1.15x, Bengaluru: 1.1x)
- Setting coverage fixed at 40% — making it financially unattractive to join only during a known bad week
- Applying the 24-hour policy activation window — prevents buying the night before an announced disruption

New users receive genuine coverage and real payouts. The calibration ensures joining right before a bad event does not produce a windfall that undermines the pool.

### 7.2 Returning Users (Week 3 Onward)

From week 3, each rider's premium and coverage depend on their own performance data. The system calculates a **Reliability Score (R)** — a number between 0 and 1 based on how active and effective the rider has been relative to others in their zone:

```
Adjusted TU     = Rider's active hours this week / Zone average active hours
Adjusted DE     = Rider's completed orders / Zone average completed orders
Completion Rate = Rider's completed orders / Rider's accepted orders

R               = min(sqrt(Adjusted TU × Adjusted DE × Completion Rate), 1.0)

Coverage %      = 40% + (25% × R)        → max 65%
Premium         = Base Rate × Risk Multiplier × (1.5 - R)
```

R is clamped to 1.0. This ensures coverage never exceeds 65% and the premium multiplier never falls below 0.5x.
Multiplicative form penalizes imbalance across dimensions. Square root normalizes extreme values and prevents domination by any single factor.

| R Value | Coverage | Premium Effect |
|---|---|---|
| R = 1.0 (top performer) | 65% | Lowest premium (multiplier = 0.5x) |
| R = 0.5 (average) | 52.5% | Neutral premium (multiplier = 1.0x) |
| R = 0.0 (inactive) | 40% floor | Highest premium (multiplier = 1.5x) |

A consistently active rider who completes orders efficiently pays less and receives more coverage. The two outcomes compound — sustained engagement is meaningfully rewarded. From week 5, zone averages shift from city-level defaults to pin-code level data specific to the rider's registered zones.

---

## 8. Three Core Features

---

### 8.1 Parametric Trigger System

VERO watches four types of disruption at the same time. Each one uses a specific, independent signal to confirm the income impact is genuine.

Paying the moment rain starts is a problem — a 10-minute shower would qualify. Waiting until rain stops is also a problem — the rider already lost that income. The approach here is to require two conditions at once: intensity above a threshold, and duration long enough to confirm it is a real disruption.

```
WEATHER / ENVIRONMENTAL TRIGGER:
  Threshold : Rainfall > 50mm/hr OR hailstorm confirmed OR wind > 40km/hr
  Duration  : Sustained > 1 hour continuously
  Signal    : Delivery time spike in zone — rain raises demand but
              destroys productivity. Spike confirms income impairment.
  Source    : Open-Meteo API (api.open-meteo.com) — real-time, no API key

AQI TRIGGER:
  Threshold : AQI > 300 in rider's active zone
  Duration  : Sustained > 2 hours during shift
  Signal    : Sustained toxic air cuts trip completion rates
  Source    : Open-Meteo Air Quality API (air-quality-api.open-meteo.com)

PLATFORM BLACKOUT TRIGGER:
  Threshold : Platform uptime < 100% (Zomato and Swiggy monitored separately)
  Duration  : Sustained > 45 continuous minutes within peak hours
              (12:00–14:30 OR 19:00–22:30)
  Signal    : Zero platform function = zero orders possible
              Fraud structurally impossible — third-party verified
  Source    : Enriched simulation (DownDetector has no free public API)
  Eligibility extra: GPS in zone + app active + delivery attempt in last 30 mins

SOCIAL DISRUPTION TRIGGER (Proactive — night before):
  Sources   : GDELT Project v2 (api.gdeltproject.org) — live global news scanner,
              no API key required; pre-armed zone signals for high-confidence cities
  Scoring   : 12% single tweet → 74% trending + news → 91% official notice
  Threshold : Oracle confidence > 75%
  Night before → zones pre-armed → riders notified before disruption day
  Disruption day → 3 sources confirm + restaurant availability drops > 80%
                 + rider GPS in zone → payout intervals begin
  Signal    : Restaurant availability collapse confirms supply shutdown
              Nothing to deliver = income impossible regardless of demand
```

**Multi-trigger resolution:** If two triggers are active simultaneously for the same rider, only the highest payout for that interval applies. Payouts are never stacked across concurrent triggers.

---

### 8.2 Adaptive Weekly Premium Engine

Most insurance products divide an annual premium by 52 and call it weekly pricing. That is not what VERO does. Every Sunday night, the premium for the coming week is recalculated from scratch based on what is actually forecast to happen in that specific rider's zone.

```
Weekly Premium = Base Rate × Risk Multiplier

Base Rate        = 2% of city-level estimated weekly earnings for the rider's bracket
Risk Multiplier  = Zone risk score derived from environmental, AQI, and social disruption
                   forecasts for the coming week
```

The 2% base rate is derived actuarially — expected weekly payout (₹80 × 5 hours × 10% probability × 60% coverage) plus operating margin = ₹50 for an average rider = approximately 1.5–2% of ₹3,500 weekly income.

**For returning users (week 3+), the Reliability Score R personalizes further:**

```
R = min(sqrt(Adjusted TU × Adjusted DE × Completion Rate), 1.0)

Premium = Base Rate × Risk Multiplier × (1.5 - R)
  R = 1.0 → multiplier 0.5x (lowest premium — top performer reward)
  R = 0.0 → multiplier 1.5x (highest premium — inactive rider)
```

**Example — Suresh, Delhi, Zomato, returning user (R = 0.8), ₹3,500 per week, heavy environmental disruption week forecast:**

```
Base Rate       = ₹3,500 × 2%              = ₹70
Risk Multiplier = 1.30 (Delhi zone, severe week forecast)
R               = 0.8

Premium         = ₹70 × 1.30 × (1.5 - 0.8)
                = ₹70 × 1.30 × 0.70
                = ₹63.70

Coverage %      = 40% + (25% × 0.8)        = 60%
Weekly payout cap = ₹3,500 × 60%           = ₹2,100
```

**City-level zone defaults (weeks 1–4):**

| City | Default Zone Multiplier |
|---|---|
| Delhi | 1.30x |
| Mumbai | 1.15x |
| Bengaluru | 1.10x |
| Chennai | 1.05x |
| Other cities | 1.00x (neutral baseline) |

From week 5, city-level defaults are replaced by pin-code level zone history specific to the rider's registered delivery zones.

**Income validation — prevents over-declaration:**

```
Verified Weekly Income = min(
  Self-declared income,
  City-level benchmark for rider's earnings bracket,
  Historical earnings from platform data (week 3 onward)
)
```

The base rate applies to verified weekly income — not self-declared income. This grounds payout calculations in real earnings, not inflated figures.

---

### 8.3 Income Continuity Guarantee

VERO caps income replacement at 65% maximum and never offers 100% — preventing moral hazard while ensuring meaningful relief. Coverage scales with rider tenure and performance.

**Why 60–65% and not 100%:**
100% coverage means a rider earns the same whether working or not — removing all incentive to work through manageable conditions. The cap means the rider still absorbs the remaining loss personally. Genuine disruptions get claimed. Mild conditions do not.

**Continuity scale table:**

| Tenure | Coverage % | Notes |
|---|---|---|
| Week 1–2 | Fixed 40% | No R data; city baseline income used |
| Week 3–4 | 40% + (25% × R), max 65% | R from past week's TU, DE, CR |
| Week 5+ | 40% + (25% × R), max 65% | Pin-code zone data replaces city defaults |

A consistently active rider with a high R score pays less premium and receives higher coverage. The two outcomes compound — sustained engagement is meaningfully rewarded.

---

## 9. Payout Logic

Paying a lump sum when rain starts is wrong — it might stop in 10 minutes. Waiting until rain ends is also wrong — the rider already lost the money. VERO pays in 30-minute intervals while the disruption is actually happening. The amount is accurate and the money arrives when it is needed.

```
Per-Interval Payout Formula:

  Payout = Interval Duration (hrs) × Verified Hourly Income × Coverage %

Where:
  Interval Duration  = 0.5 hours (fixed 30-minute intervals)
  Verified Hourly    = Verified Weekly Income / estimated weekly active hours
                       (city baseline for new users; verified income from week 3+)
  Coverage %         = 40% fixed for weeks 1–2
                       40% + (25% × R) for week 3+, max 65%

Payout Timeline:
  → Trigger confirmed → payout intervals begin
  → Every 30 minutes while conditions remain above threshold
  → Stops when conditions drop below threshold OR weekly cap exhausted
  → Weekly Cap = Coverage % × Verified Weekly Income (dynamic per rider)
  → Each interval logged with trigger event ID for audit and fraud tracking

Multi-Trigger Resolution Rule:
  If two triggers are active simultaneously for the same rider:
  → Only the trigger producing the highest payout for that interval applies
  → Payouts are never stacked across concurrent triggers
  → Prevents double-counting of the same income loss
```

An SMS confirmation is sent at the first interval with the trigger event ID. Subsequent intervals within the same event are processed silently until the event closes.

**Worked example — Suresh, Delhi, week 5+, R = 0.8, hailstorm, 3-hour disruption:**

```
Coverage %           = 40% + (25% × 0.8)  = 60%
Verified hourly      = ₹90
Per interval (30min) = 0.5 × ₹90 × 60%   = ₹27
Total (6 intervals)  = ₹27 × 6            = ₹162

Same rider, week 1 (coverage fixed at 40%):
Per interval         = 0.5 × ₹90 × 40%   = ₹18
Total                = ₹18 × 6            = ₹108
```

---

## 10. Policy Activation Rule

Every new policy takes effect **24 hours after purchase** — no exceptions.

```
Example:
  Policy purchased : Sunday 8:00pm
  Policy active    : Monday 8:00pm

  Any disruption between Sunday 8:00pm and Monday 8:00pm
  is NOT covered under this policy.
```

This exists for one reason: to prevent a rider from reading tonight's bandh announcement, buying a policy at 10pm, and claiming against it the next morning. The 24-hour window covers all disruption types with no exceptions.

Riders whose policy auto-renews each Sunday are not affected by this rule. It only kicks in when someone buys for the first time or rejoins after cancelling.

---

## 11. Financial Sustainability Model

The model is designed so the platform stays profitable without shortchanging riders.

**Coverage ceiling at 65%.** No matter how severe the disruption or how long the rider has been subscribed, payouts never exceed 65% of confirmed hourly income loss. This keeps expected claims manageable.

**New subscribers get reduced payouts.** Riders in weeks 1–2 receive 40% coverage, which cuts down on claims from people who sign up just before a bad week and disappear.

**Premium reflects actual risk.** Riders in high-risk zones during bad forecast weeks pay more. Riders who are consistently active and efficient pay less. The pricing is calibrated to match what is actually expected to be paid out.

**Weekly cycle keeps liability contained.** Each policy runs Monday to Sunday. There is no multi-year exposure — the platform's maximum liability is always limited to what is active in the current week.

```
Loss ratio target: 0.40 to 0.60
For every ₹1.00 collected, VERO targets ₹0.40–0.60 in claims
```

---

## 12. Adverse Selection Handling

The classic problem with subscription insurance is that smart users buy in when bad weather is coming and cancel when things look clear. VERO handles this through four mechanisms built into the product itself — not enforced after the fact.

**1. 24-Hour Activation Window**
A rider who reads tonight's bandh announcement and buys immediately cannot claim against that event. The 24-hour window is the primary structural block against last-minute opportunistic purchases. Applies to new purchases and rejoins only — not to auto-renewing subscribers.

**2. Continuity Payout Scale**
Week 1–2 subscribers receive 40% coverage — far less than a long-term subscriber with a good R score receives for the same disruption. Joining before a known bad week produces a significantly reduced payout, making the attempt financially unattractive once the premium cost is factored in.

**3. Cancellation Resets Eligibility**
Cancelling and rejoining resets the rider to week 1 status — restarting both the 24-hour window and the reduced continuity scale. Repeated cancel-and-rejoin cycling is progressively unattractive because reduced payouts in weeks 1–2 compound across each restart.

**4. Personal Loss Ratio Monitor**
VERO tracks each rider's personal loss ratio — total payouts received divided by total premiums paid. When this ratio exceeds 1.8x, a surcharge applies to the following week's premium. The surcharge compounds with repeated triggering, making sustained gaming progressively expensive until it becomes a net loss by month 5.

---

## 13. Fraud Prevention Design

Most fraud prevention relies on catching bad actors after the fact. VERO's approach is different — the way triggers are designed makes fraud structurally difficult in the first place.

**No claim form means nothing to fake.** Since riders submit nothing and triggers fire from independent data sources, there is no mechanism for a bad actor to exploit.

**Data sources have no connection to the rider.** Platform uptime, weather readings, AQI, and news signals all come from third parties who have no relationship with any individual rider. The signals fire or they don't — a rider cannot change that.

**24-hour policy activation window.** A rider cannot purchase coverage moments before a known disruption and immediately claim. The waiting period structurally eliminates last-minute opportunistic purchases.

**GPS-based zone validation.** The rider's GPS location at time of disruption must match one of their registered delivery zones. A rider outside the disrupted zone receives nothing.

**Duplicate trigger blocking.** The system stores trigger event IDs and blocks duplicate payouts for the same event under the same policy.

**Activity validation for platform blackout.** Rider must have attempted at least one delivery in the last 30 minutes. Riders who log in purely to collect a payout without working are ineligible.

**ML anomaly detection (Phase 2).** An Isolation Forest model flags claim patterns that deviate significantly from zone peers — for example, a rider repeatedly triggering payouts in weeks when no other rider in the same zone triggered.

---

## 14. Application Workflow

```
ONBOARDING  (under 2 minutes)
├── Phone number + OTP
├── Select platform: Zomato / Swiggy
├── Drop pin on active delivery zones (up to 3)
├── Declare weekly earnings bracket and shift hours
└── AI shows this week's premium → pay via UPI → coverage active

────────────────────────────────────────────────────────────────

EVERY SUNDAY NIGHT  (fully automated)
├── Premium engine re-runs for every active rider
├── Pulls fresh weather, AQI, and social disruption forecasts
├── Applies all six multipliers per rider per zone
└── New weekly premium auto-debited via UPI mandate

────────────────────────────────────────────────────────────────

REAL-TIME MONITORING  (always on)
├── Platform uptime checked every 5 minutes
├── AQI and delivery time spike tracked per zone hourly
├── Restaurant availability monitored per zone continuously
└── Social media, news feeds, and govt alerts scanned 24/7

────────────────────────────────────────────────────────────────

CLAIM TRIGGER  (zero rider action required)

ENVIRONMENTAL TRIGGER (Rain / Hail / Wind / Dust):
  Threshold: Rainfall above 50mm/hr, OR hailstorm alert confirmed,
             OR wind speed above 40km/hr in rider's registered zone
  Duration:  Sustained for more than 1 hour continuously
  Validation:
    Rider GPS confirms presence in the affected zone
    Active policy confirmed; 24-hour activation window has passed
    No duplicate event ID for this trigger
  Action:
    Payout intervals begin at trigger confirmation
    Processed at 30-minute intervals while threshold conditions hold
    Stops when environmental conditions drop below threshold
      or weekly coverage cap is exhausted

AQI TRIGGER:
  Threshold: AQI above 300 in rider's active zone
  Duration:  Sustained for more than 2 hours during the rider's shift
  Validation:
    Rider GPS confirms zone presence
    Active policy confirmed; 24-hour activation window has passed
  Action:
    Payout intervals begin at trigger confirmation
    Processed at 30-minute intervals while AQI remains above 300
    Stops when AQI drops below threshold or cap is exhausted

PLATFORM BLACKOUT TRIGGER (Zomato / Swiggy — monitored independently):
  Threshold: Platform outage (confirmed by third-party monitor)
  Duration:  Sustained for more than 45 minutes
             AND within peak hours (12:00–14:30 or 19:00–22:30)
  Validation:
    Rider was logged into the specific affected platform at outage start
    Active policy confirmed; 24-hour activation window has passed
    Zone match confirmed
  Action:
    Payout intervals begin at trigger confirmation
    Processed at 30-minute intervals while outage continues
    Stops when platform uptime restores or cap is exhausted

SOCIAL DISRUPTION TRIGGER:
  Night before:
    Oracle confidence crosses 75%
    Pre-activation alert sent to riders in affected zones via SMS and app notification
  Disruption day — three conditions confirmed simultaneously:
    (a) Three independent news or government sources confirm disruption is active
    (b) Restaurant availability in zone drops above 80%
    (c) Rider GPS confirms presence in the affected zone
  Validation:
    Active policy confirmed; 24-hour activation window has passed
  Action:
    All three conditions confirmed — payout intervals begin automatically
    Processed at 30-minute intervals while disruption conditions hold
    Stops when restaurant availability recovers or cap is exhausted

ALL TRIGGERS — Common Rule:
  Per-interval payout = Interval Duration (hrs) × Hourly Income × Coverage %
  SMS sent at first interval with trigger event ID
  Subsequent intervals within the same event processed silently
  Event closes when conditions end or weekly cap is exhausted

────────────────────────────────────────────────────────────────

DASHBOARD
├── Rider view: premium summary, disruption alerts, claim history, zone heatmap
└── Admin view: live monitoring panel, claims count, payout ratio, fraud flags
```

---

## 15. AI/ML Integration Plan

| Model | Type | Framework | Output |
|---|---|---|---|
| Premium engine | Supervised regression | XGBoost / scikit-learn | Weekly risk score → personalised premium per rider |
| Disruption oracle | NLP classifier | HuggingFace Transformers | Confidence score 0–100% per zone per day |
| Fraud anomaly engine | Rule-based + ML | Isolation Forest | Flags suspicious claim patterns for review |
| Payout calculator | Deterministic formula | — | Hourly Rate × Duration × Coverage % |

---

## 16. Tech Stack

### 16.1 Platform: Mobile-First Progressive Web App (PWA)

Riders use Android phones as their primary work tool. A PWA delivers an app-like experience without requiring Play Store installation — important for low-digital-literacy users — and supports push notifications and offline dashboard viewing natively.

| Layer | Technology | Reason |
|---|---|---|
| **Frontend** | React.js + Tailwind CSS (PWA) | Lightweight, fast, installable on Android |
| **Backend** | FastAPI (Python) | Fast async API, native ML integration |
| **Database** | PostgreSQL | Relational for policies, claims, rider profiles |
| **ML Service** | scikit-learn (MLPRegressor + IsolationForest) | Bundled in backend — no separate microservice |
| **Weather API** | Open-Meteo (api.open-meteo.com) | Real-time weather, no API key, free forever |
| **AQI API** | Open-Meteo Air Quality API | Real AQI (PM2.5, PM10, EU index), no API key |
| **News/Social** | GDELT Project v2 | Global news scanner for bandh/curfew signals, free, no key |
| **Platform** | Enriched simulation | DownDetector has no free public API — clearly labelled |
| **Payments** | Razorpay Sandbox (UPI payouts + mandate) | Indian-native, free sandbox |
| **Deployment** | Docker Compose (all services containerised) | Single command startup for demo |

---

## 17. 6-Week Development Plan

| Week | Phase | Key Deliverables |
|---|---|---|
| 1–2 | Ideation & Foundation | Persona research, feature design, README, repo setup |
| 3 | Core Build — Onboarding + Premium | OTP flow, zone picker, Sunday premium engine |
| 4 | Core Build — Triggers + Payouts | Uptime monitor, AQI/weather trigger, Razorpay payout flow |
| 5 | Advanced Features | Social disruption oracle (rule-based MVP), pre-activation alerts |
| 6 | Polish + Demo | Fraud engine (rule-based MVP), dashboards, end-to-end demo |

**MVP scope vs Phase 2:**

| Feature | Hackathon MVP | Phase 2 |
|---|---|---|
| Social disruption oracle | Rule-based keyword matching | Full NLP classifier (HuggingFace) |
| Fraud detection | Rule-based scoring with GPS validation | Isolation Forest on real claim data |
| Premium engine | XGBoost trained on synthetic data | Retrained on real disruption history |
| Dashboard | Basic admin view with mock data | Live data, full analytics pipeline |

The hackathon MVP uses rule-based implementations wherever full ML models require real training data that does not yet exist. The architecture is designed for these to be replaced with ML models in Phase 2 without structural changes.

---

## 18. Analytics Dashboard

**Rider View:**
- This week's premium breakdown and coverage summary
- Live disruption alerts for active zones
- Claim history with payout amounts and event IDs
- Zone risk heatmap for the current week

**Admin View:**
- Active riders by zone in real time
- Live monitoring panel — weather, AQI, platform uptime, social signals
- Claims triggered today — count and total payout value
- Fraud flags raised — anomalous claims pending review
- Weekly premium revenue vs. payout ratio
- Most disruption-prone zones heatmap

---

## 19. Constraint Compliance

| Requirement | Status | How We Comply |
|---|---|---|
| Delivery partners only | ✅ Met | Zomato and Swiggy food delivery riders only — no other segments |
| Income loss coverage only | ✅ Met | Every trigger maps to lost working time — nothing else |
| No health, accident, or vehicle coverage | ✅ Met | None of these are covered anywhere in the product |
| Weekly pricing model | ✅ Met | Premium recalculated fresh every Sunday based on coming week's forecast |
| AI/ML integration | ✅ Met | MLPRegressor (metrics prediction) + IsolationForest (fraud detection) bundled in backend |
| Intelligent fraud detection | ✅ Met | 24-hr activation window, Open-Meteo/GDELT trigger verification, GPS zone matching, loss ratio monitoring |
| Parametric automation | ✅ Met | No rider action needed at any point — triggers and payouts are fully automated |
| Integration capabilities | ✅ Met | Open-Meteo (weather), Open-Meteo Air Quality (AQI), GDELT Project (social), Razorpay (payments) |

---

## 20. Adversarial Defense & Anti-Spoofing Strategy

> **Market Crash Threat Brief:** A coordinated syndicate of 500 delivery
> workers used GPS-spoofing apps to fake presence in a red-alert weather
> zone while resting at home — triggering mass false payouts and draining
> a competitor platform's liquidity pool. Simple GPS verification is
> officially obsolete. Below is VERO's architectural response.

The attack only works on systems where location equals eligibility.
In VERO, it doesn't. Here is why.

---

### 20.1 The Differentiation — Genuine Rider vs. GPS Spoofer

VERO's parametric triggers were never built around GPS as the
primary signal. GPS is only a zone-matching check. What actually fires
a payout is entirely outside a rider's control:

| Trigger | What fires the payout | Can a rider fake this? |
|---|---|---|
| Weather / Hailstorm | Open-Meteo real-time meteorological API | No |
| AQI | Open-Meteo Air Quality API (PM2.5, PM10, EU AQI) | No |
| Platform blackout | Enriched simulation with realistic report data | No |
| Social disruption | GDELT Project v2 live news scan + pre-armed zone signals | No |

A fraudster sitting at home cannot manufacture a hailstorm on
OpenWeatherMap, take Zomato offline on DownDetector, or collapse
restaurant availability data across their zone. The triggers are
structurally unfakeable. GPS spoofing only affects the zone-match
check — and VERO has multiple layers that defeat that too.

**Beyond GPS — what the system actually checks:**

Even if a disruption is genuinely active, eligibility requires
demonstrated working behavior — not just presence:

- For platform blackout: rider must have a logged delivery attempt
  in the last 30 minutes before the outage. Someone who opened the
  app purely to collect a payout is ineligible.
- For all triggers: the Reliability Score (R) is built from Time
  Utilization, Delivery Efficiency, and Completion Rate over prior
  weeks. A fraudster with no real delivery history naturally sits at
  R = 0.0 — meaning 40% coverage floor, highest premium multiplier
  (1.5x), and minimum payout per interval. The economics of fraud
  are unattractive before any detection logic fires.
- The personal loss ratio monitor tracks total payouts divided by
  total premiums per rider. A ratio exceeding 1.8x triggers a
  compounding surcharge — making repeated gaming progressively
  expensive until it becomes a net loss by month 5.

---

### 20.2 The Data — What Catches a Coordinated Ring

Individual spoofing is hard to prove in isolation. A ring of 500
people is easy to detect because their coordination becomes the
signal. VERO's fraud anomaly engine (Isolation Forest, Phase 2)
monitors at the population level, not just the individual level.

**Temporal clustering:** Genuine disruptions produce staggered
triggers spread over 60–180 minutes as riders encounter conditions
at different times across a zone. A Telegram-coordinated ring
produces a spike — many riders in the same zone triggering within
a narrow window simultaneously. This pattern does not appear in
genuine disruptions and flags immediately as a ring-candidate event.

**Zone peer comparison:** Every claim is benchmarked against active
riders in the same zone at the same time. If a large group triggers
payouts while peer riders in that zone show normal delivery activity
— no slowdown, no delivery time spike, no restaurant availability
drop — the system flags this as a coordinated anomaly. A genuine
disruption affects all riders in the zone. A spoofed one doesn't.

**Duplicate trigger blocking:** Trigger event IDs are stored and
checked. The same event cannot produce duplicate payouts under the
same policy. Ring members attempting to trigger the same event
multiple times are blocked structurally.

**The 24-hour activation window** closes the most obvious attack
vector entirely. A rider who reads a bandh announcement tonight and
buys a policy cannot claim against it tomorrow morning. Organized
rings cannot exploit a known upcoming disruption through last-minute
mass sign-ups.

---

### 20.3 The UX Balance — Flagged Claims Without Penalizing Honest Workers

Fraud flags must never punish a genuine rider who simply has a bad
network connection during a storm. VERO handles this through
the existing fraud score pipeline:

**Flagged claims are held — not denied.** A suspicious claim enters
a review state. The payout is not rejected; it is paused while the
system gathers more signal passively. No rider action is required.

**Network drops are treated as neutral.** A failed re-verification
signal during a confirmed weather disruption does not count against
the rider. The system accounts for the fact that bad conditions
degrade connectivity — that is the whole point of the product.

**Honest riders are insulated by their history.** A returning rider
with a high R score and a clean personal loss ratio is extremely
unlikely to cross the fraud score threshold on a single genuine
claim. The score is built from behavioral history across weeks —
a one-off ambiguous signal does not override a strong track record.

**The R score naturally separates genuine riders from bad actors.**
A legitimate rider who has been active for weeks carries real Time
Utilization, Delivery Efficiency, and Completion Rate data. A
fraudster who joined to exploit a disruption has none of this. The
two profiles produce very different fraud scores without requiring
any manual intervention.

**If a flag is cleared, the rider receives the full payout** for
the period the disruption was confirmed active. No income is
permanently lost due to a false positive.

---

### 20.4 Why the Fraud Ring Cannot Win Against VERO

To drain VERO's liquidity pool the way the syndicate drained
the competitor platform, a coordinated ring would need to clear
all of the following simultaneously:

1. Wait the mandatory 24-hour activation window before any claim
   is possible
2. Trigger a real independent third-party source — a weather event
   on OpenWeatherMap, a platform outage on DownDetector, or a
   restaurant availability collapse in their zone
3. Pass the delivery activity check — a logged attempt on the
   platform in the 30 minutes prior to the trigger
4. Avoid the zone peer comparison alarm that fires when a large
   group triggers while no corresponding delivery slowdown is
   detected in the zone
5. Build enough R score history to receive anything beyond the
   40% minimum coverage at the maximum 1.5x premium multiplier
6. Do all of this profitably despite the personal loss ratio
   monitor applying compounding surcharges after the 1.8x threshold

Each of these is a separate structural barrier that exists in the
product for reasons entirely unrelated to fraud. The fraud
resistance is a byproduct of designing the product honestly —
not a bolt-on detection layer. That is what makes it durable.

---

### 20.5 Defense Summary

| Threat vector | Detection mechanism | Impact on honest rider |
|---|---|---|
| Single GPS spoof | Triggers fire from independent third-party data — GPS is zone-match only | Claim held for review, not denied; cleared on confirmation |
| Coordinated ring (500+ riders) | Temporal clustering + zone peer comparison + Isolation Forest anomaly engine | Zone enters audit mode; genuine riders' claims reviewed, not blocked |
| Last-minute buy + same-day claim | 24-hour activation window — no exceptions | None — applies only to new purchases and rejoins |
| Cancel-rejoin farming | Continuity scale resets to Week 1 on every rejoin | None for continuous auto-renewing subscribers |
| Income inflation | Verified income = min(self-declared, city benchmark, historical) | None — fair verification applies equally to all |
| No delivery activity at time of claim | Activity validation — delivery attempt required within last 30 minutes | None for riders actively working |
| High personal claim rate | Personal loss ratio monitor: ratio > 1.8x triggers compounding premium surcharge | Only activates if payout/premium ratio is genuinely anomalous over time |

> **The fundamental shift:** VERO moves trust away from user-controlled signals toward independent data, real economic activity, and population-level anomaly detection. The GPS coordinate is the *least* trusted signal in the pipeline — it is one input into a zone-match check, nothing more. The rest of the system is built on sources a fraudster cannot touch.

---

*VERO AI-Powered Insurance | Persona: Food Delivery Partners (Zomato / Swiggy)*
