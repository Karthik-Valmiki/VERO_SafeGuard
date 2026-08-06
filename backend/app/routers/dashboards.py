"""
dashboards.py — VERO SafeGuard Admin & Rider Dashboard API

All endpoints are production-grade:
  - Rider dashboard: authenticated, enriched with policy + payout history
  - Admin summary: KPIs, active disruptions, fraud counts
  - Admin live-payouts: batch-resolved, no N+1 queries, grouped by event
  - Admin analytics: city + weekly + zone breakdown
  - Admin map: aggregated zone counts (not raw 8k flat list)
  - Generate riders: async background job, progress tracked via /status
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, case
from datetime import datetime, timezone, timedelta
import asyncio
import uuid
import random
import threading
import logging

from ..db import models
from ..db.database import get_db, SessionLocal
from ..core.security import get_current_rider, verify_admin_key
from ..services.insurance_logic import compute_r, compute_r_breakdown, compute_coverage_and_premium
from ..ml_engine import predict_rider_metrics
from ..core.redis import cache_get_json, cache_set_json

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])
logger = logging.getLogger(__name__)

# ── In-memory generation state (thread-safe) ──────────────────────────────────
_gen_lock = threading.Lock()
_gen_state: dict = {
    "status": "idle",       # idle | running | done | error
    "progress": 0,          # 0–100
    "message": "",
    "generated": 0,
    "active_policies": 0,
    "activity_logs": 0,
    "error": None,
    "started_at": None,
    "finished_at": None,
}


# ══════════════════════════════════════════════════════════════════════════════
#  RIDER DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/rider/me")
async def get_my_dashboard(
    current_rider: models.RiderProfile = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db),
):
    """Authenticated rider's full dashboard."""
    res = await db.execute(
        select(models.CityBenchmark).filter(
            models.CityBenchmark.city_id == current_rider.city_id
        )
    )
    city = res.scalars().first()

    res = await db.execute(
        select(models.Policy)
        .filter(
            models.Policy.profile_id == current_rider.profile_id,
            models.Policy.status.in_(["ACTIVE", "PENDING"]),
        )
        .order_by(models.Policy.purchased_at.desc())
    )
    policy = res.scalars().first()

    if policy and policy.status == "PENDING" and policy.activated_at:
        now = datetime.now(timezone.utc)
        act = policy.activated_at
        if act.tzinfo is None:
            act = act.replace(tzinfo=timezone.utc)
        if act <= now:
            policy.status = "ACTIVE"
            await db.commit()
            await db.refresh(policy)

    res = await db.execute(
        select(models.Payout)
        .join(models.Policy, models.Payout.policy_id == models.Policy.policy_id)
        .filter(models.Policy.profile_id == current_rider.profile_id)
        .order_by(models.Payout.processed_at.desc())
        .limit(20)
    )
    payouts = res.scalars().all()

    res = await db.execute(
        select(func.count(models.RiderPerformanceHistory.history_id))
        .filter(models.RiderPerformanceHistory.profile_id == current_rider.profile_id)
    )
    perf_count = res.scalar() or 0
    is_new = perf_count < 2
    r = await compute_r(current_rider.profile_id, db) if not is_new else 0.0
    r_breakdown = await compute_r_breakdown(current_rider.profile_id, db)

    res = await db.execute(
        select(models.RiderZone).filter(
            models.RiderZone.profile_id == current_rider.profile_id,
            models.RiderZone.is_primary == True,
        )
    )
    zone_link = res.scalars().first()
    zone = None
    if zone_link:
        res = await db.execute(
            select(models.GeoZone).filter(models.GeoZone.zone_id == zone_link.zone_id)
        )
        zone = res.scalars().first()

    weekly_cap = 0.0
    already_paid = 0.0
    remaining_cap = None
    if policy and city:
        weekly_cap = float(city.baseline_weekly_income) * float(policy.coverage_ratio)
        res = await db.execute(
            select(func.coalesce(func.sum(models.Payout.amount), 0)).filter(
                models.Payout.policy_id == policy.policy_id,
                models.Payout.status == "SUCCESS",
            )
        )
        already_paid = float(res.scalar() or 0.0)
        remaining_cap = max(0.0, weekly_cap - already_paid)

    # Batch-resolve trigger types for payout history (avoids N+1)
    event_ids = list({p.event_id for p in payouts if p.event_id})
    trigger_type_map = {}
    if event_ids:
        res = await db.execute(
            select(models.TriggerEvent.event_id, models.TriggerEvent.metric_type)
            .filter(models.TriggerEvent.event_id.in_(event_ids))
        )
        trigger_type_map = {str(row.event_id): row.metric_type for row in res.all()}

    return {
        "rider": {
            "name":              current_rider.full_name,
            "phone":             current_rider.phone_number,
            "platform":          current_rider.platform,
            "city":              city.city_name if city else None,
            "zone":              zone.zone_name if zone else None,
            "zone_id":           zone.zone_id if zone else None,
            "upi_id":            current_rider.upi_id,
            "reliability_score": float(current_rider.reliability_score or 0),
            "is_new_user":       is_new,
            "shift_hours":       current_rider.shift_hours,
            "r_score":           round(r, 4),
            "r_breakdown":       r_breakdown,
            "total_payouts_received": float(current_rider.total_payouts_received or 0),
        },
        "policy": {
            "policy_id":      str(policy.policy_id) if policy else None,
            "status":         policy.status if policy else None,
            "premium":        float(policy.premium_amount) if policy else None,
            "coverage_ratio": float(policy.coverage_ratio) if policy else None,
            "coverage_pct":   round(float(policy.coverage_ratio or 0) * 100, 1) if policy else None,
            "purchased_at":   policy.purchased_at.isoformat() if policy and policy.purchased_at else None,
            "activated_at":   policy.activated_at.isoformat() if policy and policy.activated_at else None,
            "expires_at":     policy.expires_at.isoformat() if policy and policy.expires_at else None,
            "weekly_cap":     round(weekly_cap, 2) if policy and city else None,
            "total_paid_out": round(already_paid, 2) if policy and city else 0.0,
            "remaining_cap":  remaining_cap,
        } if policy else None,
        "payout_history": [
            {
                "payout_id":    str(p.payout_id),
                "amount":       float(p.amount),
                "status":       p.status,
                "processed_at": p.processed_at.isoformat() if p.processed_at else None,
                "trigger_type": trigger_type_map.get(str(p.event_id), "WEATHER"),
            }
            for p in payouts
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ADMIN SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/summary")
async def get_admin_dashboard(db: AsyncSession = Depends(get_db), _admin: str = Depends(verify_admin_key)):
    """Admin overview — flat keys for frontend, enriched disruptions with zone names."""
    cache_key = "admin:summary"
    cached = await cache_get_json(cache_key)
    if cached:
        return cached

    res = await db.execute(select(func.count(models.RiderProfile.profile_id)))
    total_riders = res.scalar() or 0
    res = await db.execute(select(func.count(models.Policy.policy_id)).filter(models.Policy.status == "ACTIVE"))
    active_policies = res.scalar() or 0
    res = await db.execute(select(func.count(models.Policy.policy_id)).filter(models.Policy.status == "PENDING"))
    pending_policies = res.scalar() or 0
    res = await db.execute(select(func.sum(models.Payout.amount)))
    total_payout_sum = res.scalar() or 0.0
    res = await db.execute(select(func.sum(models.Policy.premium_amount)))
    total_premium_sum = res.scalar() or 0.0
    res = await db.execute(
        select(func.count(models.FraudCheckLog.check_id)).filter(models.FraudCheckLog.result == "BLOCK")
    )
    total_fraud_blocked = res.scalar() or 0

    res = await db.execute(
        select(models.TriggerEvent)
        .filter(models.TriggerEvent.is_active == True)
        .order_by(models.TriggerEvent.started_at.desc())
    )
    active_events = res.scalars().all()

    loss_ratio = round(float(total_payout_sum) / float(total_premium_sum), 3) if total_premium_sum else 0.0

    # Batch-load zones and payout counts to eliminate N+1
    event_zone_ids = list({e.zone_id for e in active_events})
    event_ids_list = [e.event_id for e in active_events]

    zone_map = {}
    city_map_local = {}
    if event_zone_ids:
        res = await db.execute(select(models.GeoZone).filter(models.GeoZone.zone_id.in_(event_zone_ids)))
        for gz in res.scalars().all():
            zone_map[gz.zone_id] = gz
        city_ids = list({gz.city_id for gz in zone_map.values()})
        res = await db.execute(select(models.CityBenchmark).filter(models.CityBenchmark.city_id.in_(city_ids)))
        for c in res.scalars().all():
            city_map_local[c.city_id] = c

    riders_per_zone = {}
    if event_zone_ids:
        res = await db.execute(
            select(models.RiderZone.zone_id, func.count(models.RiderZone.profile_id))
            .filter(models.RiderZone.zone_id.in_(event_zone_ids))
            .group_by(models.RiderZone.zone_id)
        )
        riders_per_zone = dict(res.all())

    payouts_per_event = {}
    if event_ids_list:
        res = await db.execute(
            select(models.Payout.event_id, func.count(models.Payout.payout_id))
            .filter(models.Payout.event_id.in_(event_ids_list))
            .group_by(models.Payout.event_id)
        )
        payouts_per_event = dict(res.all())

    disruptions = []
    for e in active_events:
        gz = zone_map.get(e.zone_id)
        city = city_map_local.get(gz.city_id) if gz else None
        disruptions.append({
            "event_id":        str(e.event_id),
            "zone_id":         e.zone_id,
            "zone_name":       gz.zone_name if gz else f"Zone {e.zone_id}",
            "city":            city.city_name if city else "Unknown",
            "metric_type":     e.metric_type,
            "started_at":      e.started_at.isoformat() if e.started_at else None,
            "riders_affected": riders_per_zone.get(e.zone_id, 0),
            "payouts_queued":  payouts_per_event.get(e.event_id, 0),
        })

    result = {
        "total_riders":       total_riders,
        "active_policies":    active_policies,
        "pending_policies":   pending_policies,
        "premium_collected":  round(float(total_premium_sum), 2),
        "payouts_issued":     round(float(total_payout_sum), 2),
        "loss_ratio":         loss_ratio,
        "fraud_blocked_total": total_fraud_blocked,
        "active_disruptions": disruptions,
    }
    await cache_set_json(cache_key, result, 30)  # 30-second cache
    return result


# ══════════════════════════════════════════════════════════════════════════════
#  ADMIN ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/analytics")
async def get_admin_analytics(db: AsyncSession = Depends(get_db), _admin: str = Depends(verify_admin_key)):
    """Analytics: premium vs payout per city, weekly payout trend, zone risk table."""
    # City stats — one aggregate query per city (no inner loops hitting DB)
    res = await db.execute(
        select(
            models.RiderProfile.city_id,
            func.sum(models.Policy.premium_amount).label("premium"),
            func.sum(models.Payout.amount).label("payout"),
        )
        .join(models.Policy, models.Policy.profile_id == models.RiderProfile.profile_id)
        .outerjoin(models.Payout, models.Payout.policy_id == models.Policy.policy_id)
        .group_by(models.RiderProfile.city_id)
    )
    city_agg = {row.city_id: (float(row.premium or 0), float(row.payout or 0)) for row in res.all()}

    res = await db.execute(select(models.CityBenchmark))
    all_cities = res.scalars().all()
    city_stats = []
    for city in all_cities:
        premium, payout = city_agg.get(city.city_id, (0.0, 0.0))
        if premium > 0 or payout > 0:
            city_stats.append({
                "city":       city.city_name,
                "premium":    round(premium, 2),
                "payout":     round(payout, 2),
                "loss_ratio": round(payout / premium, 3) if premium else 0.0,
            })

    now    = datetime.now(timezone.utc)
    weekly = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end   = day_start + timedelta(days=1)
        res = await db.execute(
            select(
                func.sum(models.Payout.amount).label("total"),
                func.count(models.Payout.payout_id).label("cnt"),
            ).filter(
                models.Payout.processed_at >= day_start,
                models.Payout.processed_at <  day_end,
                models.Payout.status == "SUCCESS",
            )
        )
        row = res.first()
        weekly.append({
            "day":    day_start.strftime("%a"),
            "date":   day_start.strftime("%d %b"),
            "amount": round(float(row.total or 0), 2),
            "count":  row.cnt or 0,
        })

    # Zone table — batch aggregates, no per-zone queries
    res = await db.execute(
        select(models.GeoZone, models.CityBenchmark)
        .join(models.CityBenchmark, models.GeoZone.city_id == models.CityBenchmark.city_id)
    )
    zone_city_pairs = res.all()

    zone_ids = [z.zone_id for z, _ in zone_city_pairs]
    res = await db.execute(
        select(models.RiderZone.zone_id, func.count(models.RiderZone.profile_id))
        .filter(models.RiderZone.zone_id.in_(zone_ids))
        .group_by(models.RiderZone.zone_id)
    )
    rider_count_map = dict(res.all())

    res = await db.execute(
        select(models.RiderZone.zone_id, func.count(models.Policy.policy_id))
        .join(models.Policy, models.Policy.profile_id == models.RiderZone.profile_id)
        .filter(models.RiderZone.zone_id.in_(zone_ids), models.Policy.status == "ACTIVE")
        .group_by(models.RiderZone.zone_id)
    )
    active_count_map = dict(res.all())

    res = await db.execute(
        select(models.TriggerEvent.zone_id, func.count(models.TriggerEvent.event_id))
        .filter(models.TriggerEvent.zone_id.in_(zone_ids))
        .group_by(models.TriggerEvent.zone_id)
    )
    event_count_map = dict(res.all())

    zone_table = [
        {
            "zone_id":         z.zone_id,
            "zone_name":       z.zone_name,
            "city":            city.city_name if city else "Unknown",
            "risk_multiplier": float(z.base_risk_multiplier),
            "total_riders":    rider_count_map.get(z.zone_id, 0),
            "active_policies": active_count_map.get(z.zone_id, 0),
            "trigger_events":  event_count_map.get(z.zone_id, 0),
        }
        for z, city in zone_city_pairs
    ]
    zone_table.sort(key=lambda x: x["risk_multiplier"], reverse=True)

    return {
        "city_stats":   city_stats,
        "weekly_trend": weekly,
        "zone_table":   zone_table,
    }


# ═══════════════════════════════════════
#  ADMIN LIVE PAYOUTS  
# ═══════════════════════════════════════

@router.get("/admin/live-payouts")
async def get_live_payouts(limit: int = 100, db: AsyncSession = Depends(get_db), _admin: str = Depends(verify_admin_key)):
    """
    Last N payouts enriched with rider name, zone, event type, rider source.
    Single JOIN query — no N+1 lookups.
    Groups payouts by event_id so the frontend can render expandable cards.
    """
    res = await db.execute(
        select(models.TriggerEvent.event_id).order_by(models.TriggerEvent.started_at.desc()).limit(5)
    )
    recent_eids = [row[0] for row in res.all()]

    payout_ids_to_fetch = []
    for eid in recent_eids:
        res = await db.execute(
            select(models.Payout.payout_id)
            .filter(models.Payout.event_id == eid)
            .order_by(models.Payout.processed_at.desc())
            .limit(25)
        )
        payout_ids_to_fetch.extend([row[0] for row in res.all()])

    res = await db.execute(
        select(models.Payout.payout_id)
        .filter(models.Payout.event_id.is_(None))
        .order_by(models.Payout.processed_at.desc())
        .limit(25)
    )
    payout_ids_to_fetch.extend([row[0] for row in res.all()])

    if not payout_ids_to_fetch:
        res = await db.execute(
            select(models.Payout.payout_id).order_by(models.Payout.processed_at.desc()).limit(limit)
        )
        payout_ids_to_fetch = [row[0] for row in res.all()]

    if not payout_ids_to_fetch:
        return {"payouts": [], "event_meta": {}}

    res = await db.execute(
        select(models.Payout, models.Policy, models.RiderProfile, models.TriggerEvent)
        .join(models.Policy,       models.Payout.policy_id  == models.Policy.policy_id)
        .join(models.RiderProfile, models.Policy.profile_id == models.RiderProfile.profile_id)
        .outerjoin(models.TriggerEvent, models.Payout.event_id == models.TriggerEvent.event_id)
        .filter(models.Payout.payout_id.in_(payout_ids_to_fetch))
        .order_by(models.Payout.processed_at.desc())
    )
    rows = res.all()

    profile_ids = list({str(r.RiderProfile.profile_id) for r in rows})
    zone_map: dict = {}
    if profile_ids:
        res = await db.execute(
            select(models.RiderZone.profile_id, models.GeoZone.zone_name, models.GeoZone.zone_id)
            .join(models.GeoZone, models.RiderZone.zone_id == models.GeoZone.zone_id)
            .filter(models.RiderZone.is_primary == True)
            .filter(models.RiderZone.profile_id.in_(profile_ids))
        )
        for pid, zname, zid in res.all():
            zone_map[str(pid)] = {"name": zname, "id": zid}

    result = []
    for row in rows:
        payout, policy, rider, event = row.Payout, row.Policy, row.RiderProfile, row.TriggerEvent
        pid = str(rider.profile_id)
        zone_info = zone_map.get(pid, {})
        result.append({
            "payout_id":    str(payout.payout_id),
            "event_id":     str(payout.event_id) if payout.event_id else None,
            "rider_name":   rider.full_name,
            "rider_type":   "real" if rider.platform != "mock_simulator" else "mock",
            "upi_id":       rider.upi_id,
            "amount":       float(payout.amount),
            "status":       payout.status,
            "processed_at": payout.processed_at.isoformat() if payout.processed_at else None,
            "zone_name":    zone_info.get("name"),
            "zone_id":      zone_info.get("id"),
            "metric_type":  event.metric_type if event else "—",
            "coverage_pct": round(float(policy.coverage_ratio) * 100, 1),
        })

    event_ids = list({r["event_id"] for r in result if r["event_id"]})
    event_meta = {}
    if event_ids:
        res = await db.execute(
            select(
                models.Payout.event_id,
                func.sum(models.Payout.amount).label("total_amount"),
                func.count(models.Payout.payout_id).label("total_count"),
                func.sum(case((models.RiderProfile.platform == "mock_simulator", 1), else_=0)).label("mock_count"),
                func.sum(case((models.RiderProfile.platform != "mock_simulator", 1), else_=0)).label("real_count"),
                func.min(models.TriggerEvent.started_at).label("started_at")
            )
            .join(models.Policy,       models.Payout.policy_id  == models.Policy.policy_id)
            .join(models.RiderProfile, models.Policy.profile_id == models.RiderProfile.profile_id)
            .join(models.TriggerEvent, models.Payout.event_id   == models.TriggerEvent.event_id)
            .filter(models.Payout.event_id.in_(event_ids))
            .group_by(models.Payout.event_id)
        )
        for row in res.all():
            event_meta[str(row.event_id)] = {
                "total_amount": float(row.total_amount or 0),
                "total_count":  row.total_count,
                "mock_count":   row.mock_count,
                "real_count":   row.real_count,
                "started_at":   row.started_at.isoformat() if row.started_at else None,
                "total_fraud":  0,
            }

        res = await db.execute(
            select(models.FraudCheckLog.event_id, func.count(models.FraudCheckLog.check_id))
            .filter(models.FraudCheckLog.event_id.in_(event_ids), models.FraudCheckLog.result == "BLOCK")
            .group_by(models.FraudCheckLog.event_id)
        )
        for eid, fcount in res.all():
            if str(eid) in event_meta:
                event_meta[str(eid)]["total_fraud"] = fcount

    res = await db.execute(select(func.sum(models.Policy.premium_amount)))
    system_premium = float(res.scalar() or 0.0)
    res = await db.execute(
        select(func.count(models.FraudCheckLog.check_id)).filter(models.FraudCheckLog.result == "BLOCK")
    )
    system_fraud = res.scalar() or 0

    return {
        "payouts":        result,
        "event_meta":     event_meta,
        "system_premium": system_premium,
        "system_fraud":   system_fraud,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ML MODELS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/ml-models")
async def get_ml_models(_admin: str = Depends(verify_admin_key)):
    """Returns ML model metadata — type, features, importance, training stats."""
    from ..ml_engine import get_model_metadata
    return {"models": get_model_metadata()}


# ══════════════════════════════════════════════════════════════════════════════
#  FRAUD LOG
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/fraud-log")
async def get_fraud_log(db: AsyncSession = Depends(get_db), _admin: str = Depends(verify_admin_key)):
    """Last 30 fraud checks with full feature breakdowns for admin visibility."""
    res = await db.execute(
        select(models.FraudCheckLog, models.RiderProfile)
        .join(models.RiderProfile, models.FraudCheckLog.profile_id == models.RiderProfile.profile_id)
        .order_by(models.FraudCheckLog.checked_at.desc())
        .limit(30)
    )
    rows = res.all()
    result = [
        {
            "check_id":      row.FraudCheckLog.check_id,
            "rider_name":    row.RiderProfile.full_name,
            "profile_id":    str(row.FraudCheckLog.profile_id),
            "event_id":      str(row.FraudCheckLog.event_id) if row.FraudCheckLog.event_id else None,
            "result":        row.FraudCheckLog.result,
            "anomaly_score": float(row.FraudCheckLog.anomaly_score) if row.FraudCheckLog.anomaly_score else 0,
            "features":      row.FraudCheckLog.features or {},
            "reason":        row.FraudCheckLog.reason,
            "checked_at":    row.FraudCheckLog.checked_at.isoformat() if row.FraudCheckLog.checked_at else None,
        }
        for row in rows
    ]

    res = await db.execute(select(func.count(models.FraudCheckLog.check_id)))
    total_checks = res.scalar() or 0
    res = await db.execute(
        select(func.count(models.FraudCheckLog.check_id)).filter(models.FraudCheckLog.result == "BLOCK")
    )
    total_blocks = res.scalar() or 0

    return {
        "checks": result,
        "summary": {
            "total_checks":  total_checks,
            "total_blocks":  total_blocks,
            "total_passes":  total_checks - total_blocks,
            "block_rate":    round(total_blocks / total_checks * 100, 1) if total_checks else 0.0,
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ADMIN ZONES  (for SimulatorTab select dropdowns)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/zones")
async def get_admin_zones(db: AsyncSession = Depends(get_db), _admin: str = Depends(verify_admin_key)):
    """City → zones map for simulator target dropdowns."""
    res = await db.execute(
        select(models.GeoZone, models.CityBenchmark)
        .join(models.CityBenchmark, models.GeoZone.city_id == models.CityBenchmark.city_id)
        .order_by(models.CityBenchmark.city_name, models.GeoZone.zone_name)
    )
    out: dict = {}
    for gz, city in res.all():
        out.setdefault(city.city_name, []).append({
            "zone_id":              gz.zone_id,
            "zone_name":            gz.zone_name,
            "base_risk_multiplier": float(gz.base_risk_multiplier),
        })
    return out


# ══════════════════════════════════════════════════════════════════════════════
#  ADMIN MAP  (aggregated — not 8k flat list)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/map")
async def get_admin_map(db: AsyncSession = Depends(get_db), _admin: str = Depends(verify_admin_key)):
    """
    Returns geo data for Command Map: zone clusters + active events.
    Returns aggregate rider/policy counts per zone — NOT individual 8k row list.
    """
    res = await db.execute(
        select(models.GeoZone, models.CityBenchmark)
        .join(models.CityBenchmark, models.GeoZone.city_id == models.CityBenchmark.city_id)
    )
    zone_city_pairs = res.all()
    zone_ids = [z.zone_id for z, _ in zone_city_pairs]

    # Batch rider and policy counts
    res = await db.execute(
        select(models.RiderZone.zone_id, func.count(models.RiderZone.profile_id))
        .filter(models.RiderZone.zone_id.in_(zone_ids))
        .group_by(models.RiderZone.zone_id)
    )
    rider_count_map = dict(res.all())

    res = await db.execute(
        select(models.RiderZone.zone_id, func.count(models.Policy.policy_id))
        .join(models.Policy, models.Policy.profile_id == models.RiderZone.profile_id)
        .filter(models.RiderZone.zone_id.in_(zone_ids), models.Policy.status == "ACTIVE")
        .group_by(models.RiderZone.zone_id)
    )
    policy_count_map = dict(res.all())

    zone_list = [
        {
            "zone_id":   zone.zone_id,
            "zone_name": zone.zone_name,
            "city":      city.city_name,
            "risk":      float(zone.base_risk_multiplier),
            "riders":    rider_count_map.get(zone.zone_id, 0),
            "policies":  policy_count_map.get(zone.zone_id, 0),
        }
        for zone, city in zone_city_pairs
    ]

    res = await db.execute(
        select(models.TriggerEvent.zone_id).filter(models.TriggerEvent.is_active == True)
    )
    active_zone_ids = [row[0] for row in res.all()]

    return {
        "zones":        zone_list,
        "activeEvents": active_zone_ids,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  NOTIFICATIONS (completed trigger history)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/notifications")
async def get_admin_notifications(db: AsyncSession = Depends(get_db), _admin: str = Depends(verify_admin_key)):
    """Returns the last 20 completed (inactive) disruptions for the notification bell."""
    res = await db.execute(
        select(models.TriggerEvent)
        .filter(models.TriggerEvent.is_active == False)
        .order_by(models.TriggerEvent.ended_at.desc())
        .limit(20)
    )
    events = res.scalars().all()

    event_ids = [e.event_id for e in events]
    zone_ids = list({e.zone_id for e in events})

    # Batch zone lookup
    zone_name_map = {}
    if zone_ids:
        res = await db.execute(select(models.GeoZone).filter(models.GeoZone.zone_id.in_(zone_ids)))
        for gz in res.scalars().all():
            zone_name_map[gz.zone_id] = gz.zone_name

    # Batch payout aggregates
    payout_agg = {}
    if event_ids:
        res = await db.execute(
            select(
                models.Payout.event_id,
                func.count(models.Payout.payout_id).label("cnt"),
                func.coalesce(func.sum(models.Payout.amount), 0).label("total"),
            )
            .filter(models.Payout.event_id.in_(event_ids), models.Payout.status == "SUCCESS")
            .group_by(models.Payout.event_id)
        )
        for row in res.all():
            payout_agg[row.event_id] = {"count": row.cnt, "total": float(row.total)}

    notifs = [
        {
            "event_id":     str(e.event_id),
            "zone_name":    zone_name_map.get(e.zone_id, "Unknown"),
            "metric_type":  e.metric_type,
            "started_at":   e.started_at.isoformat() if e.started_at else None,
            "ended_at":     e.ended_at.isoformat() if e.ended_at else None,
            "metadata":     e.event_metadata,
            "payout_count": payout_agg.get(e.event_id, {}).get("count", 0),
            "total_paid":   payout_agg.get(e.event_id, {}).get("total", 0.0),
        }
        for e in events
    ]
    return {"notifications": notifs}



# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 3 — PREDICTIVE RISK FORECAST
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/risk-forecast")
async def get_risk_forecast(db: AsyncSession = Depends(get_db), _admin: str = Depends(verify_admin_key)):
    """
    Phase 3 — Predictive analysis of next week's likely weather/disruption claims.

    Methodology (three-signal composite model):
      Signal 1 — Historical Trigger Frequency (weight 0.45)
        Counts how many TriggerEvents fired in this zone over the past 30 days.
        Normalised to [0,1] against the max-frequency zone.
      Signal 2 — Zone Risk Multiplier (weight 0.30)
        The actuarial base_risk_multiplier already encodes long-term climate and
        civic risk for the zone. High-risk zones are inherently more likely to trigger.
      Signal 3 — Live 7-Day Weather Forecast (weight 0.25)
        Calls Open-Meteo /v1/forecast for the zone's coordinates — the same API
        used in the trigger pipeline — and reads max daily precipitation and
        max temperature over the next 7 days. High rainfall or extreme heat inflates
        the weather signal toward 1.0.

    Output: per-zone probability score in [0,1] with top-3 driver reasons,
    sorted by descending probability for the admin dashboard card.
    """
    import requests as _req

    res = await db.execute(
        select(models.GeoZone, models.CityBenchmark)
        .join(models.CityBenchmark, models.GeoZone.city_id == models.CityBenchmark.city_id)
    )
    zones = res.all()
    if not zones:
        return {"forecast": [], "generated_at": datetime.now(timezone.utc).isoformat(), "methodology": "No zones found"}

    now = datetime.now(timezone.utc)
    thirty_days_ago = now - timedelta(days=30)

    res = await db.execute(
        select(models.TriggerEvent.zone_id, func.count(models.TriggerEvent.event_id).label("cnt"))
        .filter(models.TriggerEvent.started_at >= thirty_days_ago)
        .group_by(models.TriggerEvent.zone_id)
    )
    freq_map = {row.zone_id: row.cnt for row in res.all()}
    max_freq = max(freq_map.values(), default=1) or 1

    # ── Pull zone coordinates for weather forecast ─────────────────────────
    # Reuse coordinates from mock_api.py — same source of truth
    ZONE_COORDS = {
        1: {"lat": 12.9784, "lon": 77.6408}, 2: {"lat": 12.9352, "lon": 77.6245},
        3: {"lat": 12.9698, "lon": 77.7499}, 4: {"lat": 13.0418, "lon": 80.2341},
        5: {"lat": 13.0012, "lon": 80.2565}, 6: {"lat": 12.9815, "lon": 80.2180},
        7: {"lat": 13.0878, "lon": 80.2100}, 8: {"lat": 19.0544, "lon": 72.8402},
        9: {"lat": 19.1136, "lon": 72.8697}, 10: {"lat": 19.0176, "lon": 72.8562},
        11: {"lat": 19.2183, "lon": 72.8543}, 12: {"lat": 28.6315, "lon": 77.2167},
        13: {"lat": 28.5672, "lon": 77.2374}, 14: {"lat": 28.7495, "lon": 77.0667},
        15: {"lat": 28.5921, "lon": 77.0460}, 16: {"lat": 17.3850, "lon": 78.4867},
        17: {"lat": 17.4126, "lon": 78.4482}, 18: {"lat": 17.4399, "lon": 78.4983},
        19: {"lat": 18.5362, "lon": 73.8938}, 20: {"lat": 18.5074, "lon": 73.8077},
        21: {"lat": 22.5605, "lon": 88.3509}, 22: {"lat": 22.5804, "lon": 88.4183},
    }

    # Cache one Open-Meteo call per unique lat/lon pair to avoid redundant requests
    weather_cache: dict = {}

    def _fetch_forecast_sync(lat: float, lon: float) -> dict:
        """Synchronous HTTP call — run in thread pool to avoid blocking the event loop."""
        key = f"{lat:.4f},{lon:.4f}"
        if key in weather_cache:
            return weather_cache[key]
        try:
            url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={lat}&longitude={lon}"
                f"&daily=precipitation_sum,temperature_2m_max,windspeed_10m_max"
                f"&timezone=Asia%2FKolkata&forecast_days=7"
            )
            resp = _req.get(url, timeout=5)
            if resp.status_code == 200:
                data = resp.json().get("daily", {})
                result = {
                    "max_rain": max(data.get("precipitation_sum", [0]) or [0]),
                    "max_temp": max(data.get("temperature_2m_max", [30]) or [30]),
                    "max_wind": max(data.get("windspeed_10m_max", [0]) or [0]),
                    "live": True,
                }
                weather_cache[key] = result
                return result
        except Exception as e:
            logger.warning(f"[FORECAST] Weather API failed for {lat},{lon}: {e}")
        fallback = {"max_rain": 0.0, "max_temp": 32.0, "max_wind": 0.0, "live": False}
        weather_cache[key] = fallback
        return fallback

    # Collect unique coords and fetch all in parallel threads
    unique_coords = {}
    for zone, _ in zones:
        coords = ZONE_COORDS.get(zone.zone_id, {"lat": 20.5937, "lon": 78.9629})
        key = f"{coords['lat']:.4f},{coords['lon']:.4f}"
        unique_coords[key] = coords

    fetch_tasks = [
        asyncio.to_thread(_fetch_forecast_sync, c["lat"], c["lon"])
        for c in unique_coords.values()
    ]
    await asyncio.gather(*fetch_tasks)  # results cached in weather_cache

    forecast = []
    for zone, city in zones:
        coords = ZONE_COORDS.get(zone.zone_id, {"lat": 20.5937, "lon": 78.9629})
        wx = _fetch_forecast_sync(coords["lat"], coords["lon"])

        # ── Signal 1: historical frequency [0,1] ──────────────────────────
        hist_count = freq_map.get(zone.zone_id, 0)
        sig_history = round(hist_count / max_freq, 4)

        # ── Signal 2: zone risk multiplier [0,1] ──────────────────────────
        risk_raw = float(zone.base_risk_multiplier)
        sig_risk = round(min(risk_raw / 1.5, 1.0), 4)   # 1.5× = max expected multiplier

        # ── Signal 3: weather forecast [0,1] ──────────────────────────────
        # Heavy rain: anything ≥35mm scores 1.0, scales linearly below
        rain_score = min(wx["max_rain"] / 35.0, 1.0)
        # Extreme heat: anything ≥42°C scores 1.0
        heat_score = max(0.0, (wx["max_temp"] - 30.0) / 12.0)
        heat_score = min(heat_score, 1.0)
        sig_weather = round(min(max(rain_score, heat_score * 0.6), 1.0), 4)

        # ── Composite probability (weighted sum) ───────────────────────────
        probability = round(
            sig_history * 0.45 + sig_risk * 0.30 + sig_weather * 0.25,
            4,
        )
        probability = min(probability, 1.0)

        # ── Human-readable driver reasons ─────────────────────────────────
        drivers = []
        if sig_history >= 0.5:
            drivers.append(f"{hist_count} trigger event{'s' if hist_count != 1 else ''} in past 30 days")
        elif sig_history > 0:
            drivers.append(f"{hist_count} historical trigger in past 30 days")
        if risk_raw >= 1.2:
            drivers.append(f"High zone risk multiplier ({risk_raw:.1f}×)")
        if wx["max_rain"] >= 20:
            drivers.append(f"{'LIVE' if wx['live'] else 'Est.'} forecast: {wx['max_rain']:.0f}mm rain next 7 days")
        if wx["max_temp"] >= 38:
            drivers.append(f"{'LIVE' if wx['live'] else 'Est.'} forecast: {wx['max_temp']:.0f}°C extreme heat")
        if not drivers:
            drivers.append("Low historical activity — minimal risk expected")

        # ── Determine risk tier for UI coloring ───────────────────────────
        if probability >= 0.65:
            tier, tier_color = "HIGH", "red"
        elif probability >= 0.35:
            tier, tier_color = "MEDIUM", "amber"
        else:
            tier, tier_color = "LOW", "green"

        forecast.append({
            "zone_id":     zone.zone_id,
            "zone_name":   zone.zone_name,
            "city":        city.city_name,
            "probability": probability,
            "probability_pct": round(probability * 100, 1),
            "tier":        tier,
            "tier_color":  tier_color,
            "signals": {
                "historical_frequency": sig_history,
                "zone_risk":            sig_risk,
                "weather_forecast":     sig_weather,
            },
            "forecast_detail": {
                "max_rain_mm":  round(wx["max_rain"], 1),
                "max_temp_c":   round(wx["max_temp"], 1),
                "max_wind_kmh": round(wx["max_wind"], 1),
                "live_weather": wx["live"],
            },
            "drivers":          drivers[:3],
            "historical_events": hist_count,
        })

    forecast.sort(key=lambda x: x["probability"], reverse=True)

    return {
        "forecast": forecast,
        "generated_at": now.isoformat(),
        "model_version": "v1.0 — 3-signal composite (history 45% + zone_risk 30% + weather 25%)",
        "data_source": "Open-Meteo 7-day forecast (live) + DB historical triggers + zone risk index",
        "horizon": "Next 7 days",
    }


# ══════════════════════════════════════════════════════════════════════════════
#  GENERATE RIDERS  (background job + progress endpoint)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/generate-riders/status")
async def get_generate_status(_admin: str = Depends(verify_admin_key)):
    """Poll this to track progress of the background rider generation job."""
    with _gen_lock:
        return dict(_gen_state)


@router.post("/admin/generate-riders")
async def generate_riders(background_tasks: BackgroundTasks, target_users: int = 8000, _admin: str = Depends(verify_admin_key)):
    """
    Kicks off 8k rider generation as a background task.
    Returns immediately — poll /admin/generate-riders/status for progress.
    Safe to call multiple times: each call resets and regenerates.
    """
    with _gen_lock:
        if _gen_state["status"] == "running":
            raise HTTPException(status_code=409, detail="Generation already in progress")
        _gen_state.update({
            "status":         "running",
            "progress":       0,
            "message":        "Initialising...",
            "generated":      0,
            "active_policies": 0,
            "activity_logs":  0,
            "error":          None,
            "started_at":     datetime.now(timezone.utc).isoformat(),
            "finished_at":    None,
        })
    background_tasks.add_task(_generate_riders_bg, target_users)
    return {
        "status":  "started",
        "message": "Generation started in background. Poll /admin/generate-riders/status for progress.",
    }


def _update_gen(progress: int, message: str, **kw):
    """Helper — thread-safe state update during generation."""
    with _gen_lock:
        _gen_state["progress"] = progress
        _gen_state["message"]  = message
        _gen_state.update(kw)


def _generate_riders_bg(target_users: int):
    """
    Background worker: clears old mock data, inserts target_users fresh riders.
    Updates _gen_state throughout so the frontend can poll progress.
    Real rider data is NEVER touched (platform != 'mock_simulator').
    """
    import bcrypt
    db = SessionLocal()
    try:
        # Clear old mock riders in 500-row chunks to avoid ORM in-memory overload
        # on large datasets. Real riders (platform != 'mock_simulator') are untouched.
        _update_gen(5, "Clearing previous simulation data...")
        chunk_size = 500
        deleted = 0
        while True:
            batch = db.query(models.RiderProfile.profile_id).filter(
                models.RiderProfile.platform == "mock_simulator"
            ).limit(chunk_size).all()
            if not batch:
                break
            ids = [r[0] for r in batch]
            db.query(models.FraudCheckLog).filter(
                models.FraudCheckLog.profile_id.in_(ids)
            ).delete(synchronize_session=False)
            db.query(models.RiderActivityLog).filter(
                models.RiderActivityLog.profile_id.in_(ids)
            ).delete(synchronize_session=False)
            mock_policy_ids = [
                p[0] for p in db.query(models.Policy.policy_id).filter(
                    models.Policy.profile_id.in_(ids)
                ).all()
            ]
            if mock_policy_ids:
                db.query(models.Payout).filter(
                    models.Payout.policy_id.in_(mock_policy_ids)
                ).delete(synchronize_session=False)
            db.query(models.Policy).filter(
                models.Policy.profile_id.in_(ids)
            ).delete(synchronize_session=False)
            db.query(models.RiderPerformanceHistory).filter(
                models.RiderPerformanceHistory.profile_id.in_(ids)
            ).delete(synchronize_session=False)
            db.query(models.RiderZone).filter(
                models.RiderZone.profile_id.in_(ids)
            ).delete(synchronize_session=False)
            db.query(models.RiderProfile).filter(
                models.RiderProfile.profile_id.in_(ids)
            ).delete(synchronize_session=False)
            db.commit()
            deleted += len(ids)
        logger.info(f"[GENERATE] Cleared {deleted} old mock riders.")
        _update_gen(12, "Clearing previous trigger events and payouts for mock data...")

        # ── Scope deletion to mock rider data only ─────────────────────────
        # Real riders (platform != 'mock_simulator') and their payouts/policies
        # are NEVER touched. We only wipe mock-linked records.
        all_mock_ids = [
            r[0] for r in db.query(models.RiderProfile.profile_id).filter(
                models.RiderProfile.platform == "mock_simulator"
            ).all()
        ]

        if all_mock_ids:
            # Get policy IDs belonging to mock riders
            mock_policy_ids = [
                p[0] for p in db.query(models.Policy.policy_id).filter(
                    models.Policy.profile_id.in_(all_mock_ids)
                ).all()
            ]

            # Delete payouts that belong to mock policies only
            if mock_policy_ids:
                db.query(models.Payout).filter(
                    models.Payout.policy_id.in_(mock_policy_ids)
                ).delete(synchronize_session=False)

            # Delete fraud logs for mock riders
            db.query(models.FraudCheckLog).filter(
                models.FraudCheckLog.profile_id.in_(all_mock_ids)
            ).delete(synchronize_session=False)

        # Clear ALL trigger events (they are zone-level, not rider-level).
        # Real rider payouts have already been preserved above since we only
        # deleted mock-policy payouts. Trigger events from the previous
        # simulation run are stale and should not appear in the new feed.
        db.query(models.TriggerEvent).delete(synchronize_session=False)
        db.commit()
        logger.info("[GENERATE] Cleared mock payouts, fraud logs, and stale trigger events. Real user data preserved.")

        _update_gen(15, f"Cleared {deleted} old records. Building {target_users} riders...")

        # Load zones for distribution, crash-fast if init_db hasn't run.
        zones = db.query(models.GeoZone).all()
        if not zones:
            raise RuntimeError("No geo zones found in database — run init_db first.")

        # One shared bcrypt hash for all mock riders (significant speedup)
        mock_hash           = bcrypt.hashpw(b"mock_vero_2026", bcrypt.gensalt()).decode()
        now                 = datetime.now(timezone.utc)
        total_active_target = random.randint(5500, 5900)

        # Pre-load city benchmarks keyed by city_id for O(1) lookup inside the
        # 8k-rider loop — eliminates 8000 individual DB round-trips.
        city_map: dict = {c.city_id: c for c in db.query(models.CityBenchmark).all()}

        # Two shifts cover morning and extended evening. Riders 0-3199 get Shift A
        # (08:00-12:00); the remainder get Shift B (12:00-02:00, night delivery heavy).
        SHIFT_A = {"pref": 0, "start": "08:00", "end": "12:00", "hours": 4.0}
        SHIFT_B = {"pref": 1, "start": "12:00", "end": "02:00", "hours": 14.0}

        new_riders   = []
        new_rzones   = []
        new_policies = []
        new_activity = []

        for i in range(target_users):
            zone            = random.choice(zones)
            city_bench      = city_map.get(zone.city_id)
            base_income     = float(city_bench.baseline_weekly_income) if city_bench else 5500.0
            zone_risk       = float(zone.base_risk_multiplier)
            is_active_batch = i < total_active_target

            # ── Rider profile tier ────────────────────────────────────────────
            # Active riders: experienced, high hours → ML predicts high TU/DE/CR
            # Fraud seeds : low experience, low hours → ML predicts low TU/DE/CR
            shift = SHIFT_A if i < 3200 else SHIFT_B
            if is_active_batch:
                experience_months = random.randint(6, 48)
                avg_daily_hours   = random.uniform(7.0, 14.0)
                weather_severity  = random.uniform(0.0, 0.5)   # mostly clear days
                policy_status     = "ACTIVE"
            else:
                experience_months = random.randint(1, 8)
                avg_daily_hours   = random.uniform(2.0, 6.0)
                weather_severity  = random.uniform(0.4, 1.0)   # bad conditions
                policy_status     = random.choice(["PENDING", "EXPIRED", "ACTIVE"])

            # ── ML-predicted metrics (same MLP used for real riders) ───────────
            # predict_rider_metrics calls the trained vero_nn_metrics.pkl.
            # Falls back to heuristics if pkl is unavailable — never crashes.
            pred_tu, pred_de, pred_cr = predict_rider_metrics(
                shift_preference  = shift["pref"],
                zone_risk_index   = zone_risk,
                avg_daily_hours   = avg_daily_hours,
                experience_months = experience_months,
                weather_severity  = weather_severity,
            )
            r_score = round(min((pred_tu * pred_de * pred_cr) ** 0.5, 1.0), 4)

            # ── Premium via the exact VERO formula (mirrors insurance_logic.py) ─
            # base_rate  = city baseline weekly income × 2%
            # premium    = base_rate × zone_risk × (1.5 - R)
            # High-R riders pay less; high-risk zones pay more.
            # ±3% jitter models week-to-week forecast variation.
            base_rate      = base_income * 0.02
            jitter         = random.uniform(0.97, 1.03)
            premium        = round(base_rate * zone_risk * (1.5 - r_score) * jitter, 2)
            coverage_ratio = round(min(0.40 + 0.25 * r_score, 0.65), 2)

            pr_id = uuid.uuid4()

            # ── Fraud seed: set financial history so Isolation Forest fires ───
            # Normal riders: loss_ratio 0.5–1.2× (within actuarial target)
            # Fraudsters   : loss_ratio 3–8×  (draining the pool)
            if not is_active_batch:
                total_premium_paid     = round(premium, 2)
                total_payouts_received = round(random.uniform(3.0, 8.0) * premium, 2)
            else:
                total_premium_paid     = round(premium, 2)
                total_payouts_received = round(random.uniform(0.0, 1.2) * premium, 2)

            new_riders.append(models.RiderProfile(
                profile_id             = pr_id,
                full_name              = f"Rider_{i:05d}",
                phone_number           = f"+9199{str(i).zfill(8)}",
                hashed_password        = mock_hash,
                platform               = "mock_simulator",
                city_id                = zone.city_id,
                shift_hours            = {"start": shift["start"], "end": shift["end"]},
                upi_id                 = f"sim{i}@vero",
                reliability_score      = round(r_score, 2),
                is_verified            = True,
                total_payouts_received = total_payouts_received,
                total_premium_paid     = total_premium_paid,
                created_at             = now,
            ))

            new_rzones.append(models.RiderZone(
                profile_id = pr_id,
                zone_id    = zone.zone_id,
                is_primary = True,
            ))

            activation_buffer = timedelta(seconds=random.randint(30, 300))
            new_policies.append(models.Policy(
                policy_id            = uuid.uuid4(),
                profile_id           = pr_id,
                premium_amount       = premium,
                coverage_ratio       = coverage_ratio,
                r_factor_at_purchase = r_score,
                status               = policy_status,
                # purchased_at floor at 48h so policy_age_hours always lands
                # inside the Isolation Forest's normal training range (48–2000h)
                # and legitimate riders are never false-positive blocked.
                purchased_at         = now - timedelta(hours=random.randint(48, 120)),
                activated_at         = (now - activation_buffer) if policy_status == "ACTIVE" else (now + timedelta(hours=1)),
                expires_at           = now + timedelta(days=7),
                is_surcharge_applied = False,
            ))

            # ── Activity logs — zone-aware telemetry ──────────────────────────
            # Normal riders : recent in-zone pings (low recency, high zone match)
            # Fraudsters    : stale pings in wrong zone (high recency, low zone match)
            # Both patterns feed directly into the Isolation Forest features.
            if is_active_batch and policy_status == "ACTIVE":
                for _ in range(random.randint(2, 5)):
                    new_activity.append(models.RiderActivityLog(
                        profile_id    = pr_id,
                        activity_type = "delivery",
                        zone_id       = zone.zone_id,
                        recorded_at   = now - timedelta(minutes=random.randint(5, 90)),
                    ))
            elif not is_active_batch:
                wrong_zone = random.choice(
                    [z for z in zones if z.zone_id != zone.zone_id] or zones
                )
                for _ in range(random.randint(1, 3)):
                    new_activity.append(models.RiderActivityLog(
                        profile_id    = pr_id,
                        activity_type = "delivery",
                        zone_id       = wrong_zone.zone_id,
                        recorded_at   = now - timedelta(minutes=random.randint(120, 1440)),
                    ))

            # Update progress during build (15→60 range)
            if i % 500 == 0 and i > 0:
                pct = 15 + int((i / target_users) * 45)
                _update_gen(pct, f"Building riders... {i}/{target_users}")

        # ── STEP 3: Batch insert ────────────────────────────────────────────
        _update_gen(60, f"Inserting {len(new_riders)} riders into database...")
        batch_size = 1000

        for i in range(0, len(new_riders), batch_size):
            db.add_all(new_riders[i:i + batch_size])
            db.commit()

        _update_gen(72, "Inserting zone assignments...")
        for i in range(0, len(new_rzones), batch_size):
            db.add_all(new_rzones[i:i + batch_size])
            db.commit()

        _update_gen(82, "Inserting policies...")
        for i in range(0, len(new_policies), batch_size):
            db.add_all(new_policies[i:i + batch_size])
            db.commit()

        _update_gen(92, "Inserting activity telemetry logs...")
        for i in range(0, len(new_activity), batch_size):
            db.add_all(new_activity[i:i + batch_size])
            db.commit()

        logger.info(
            f"[GENERATE] Done: {len(new_riders)} riders, "
            f"{len(new_policies)} policies, {len(new_activity)} activity logs."
        )
        with _gen_lock:
            _gen_state.update({
                "status":          "done",
                "progress":        100,
                "message":         f"Done! {len(new_riders)} riders, {total_active_target} active policies, {len(new_activity)} activity logs.",
                "generated":       len(new_riders),
                "active_policies": total_active_target,
                "activity_logs":   len(new_activity),
                "finished_at":     datetime.now(timezone.utc).isoformat(),
            })

    except Exception as e:
        logger.error(f"[GENERATE] Failed: {e}", exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass
        with _gen_lock:
            _gen_state.update({
                "status":  "error",
                "error":   str(e),
                "message": f"Error: {e}",
            })
    finally:
        try:
            db.close()
        except Exception:
            pass
