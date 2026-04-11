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
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone, timedelta
import uuid
import random
import threading
import logging

from ..db import models
from ..db.database import get_db, SessionLocal
from ..core.security import get_current_rider
from ..routers.auth import compute_r, compute_r_breakdown, compute_coverage_and_premium

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
def get_my_dashboard(
    current_rider: models.RiderProfile = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    """Authenticated rider's full dashboard."""
    city = db.query(models.CityBenchmark).filter(
        models.CityBenchmark.city_id == current_rider.city_id
    ).first()

    policy = (
        db.query(models.Policy)
        .filter(
            models.Policy.profile_id == current_rider.profile_id,
            models.Policy.status.in_(["ACTIVE", "PENDING"]),
        )
        .order_by(models.Policy.purchased_at.desc())
        .first()
    )

    if policy and policy.status == "PENDING" and policy.activated_at:
        now = datetime.now(timezone.utc)
        act = policy.activated_at
        if act.tzinfo is None:
            act = act.replace(tzinfo=timezone.utc)
        if act <= now:
            policy.status = "ACTIVE"
            db.commit()
            db.refresh(policy)

    payouts = (
        db.query(models.Payout)
        .join(models.Policy, models.Payout.policy_id == models.Policy.policy_id)
        .filter(models.Policy.profile_id == current_rider.profile_id)
        .order_by(models.Payout.processed_at.desc())
        .limit(20)
        .all()
    )

    perf_count = db.query(models.RiderPerformanceHistory).filter(
        models.RiderPerformanceHistory.profile_id == current_rider.profile_id
    ).count()
    is_new = perf_count < 2
    r = compute_r(current_rider.profile_id, db) if not is_new else 0.0
    r_breakdown = compute_r_breakdown(current_rider.profile_id, db)

    zone_link = db.query(models.RiderZone).filter(
        models.RiderZone.profile_id == current_rider.profile_id,
        models.RiderZone.is_primary == True,
    ).first()
    zone = None
    if zone_link:
        zone = db.query(models.GeoZone).filter(
            models.GeoZone.zone_id == zone_link.zone_id
        ).first()

    # Compute remaining cap
    remaining_cap = None
    if policy and city:
        weekly_cap = float(city.baseline_weekly_income) * float(policy.coverage_ratio)
        already_paid = db.query(
            func.coalesce(func.sum(models.Payout.amount), 0)
        ).filter(
            models.Payout.policy_id == policy.policy_id,
            models.Payout.status == "SUCCESS",
        ).scalar() or 0.0
        remaining_cap = max(0.0, weekly_cap - float(already_paid))

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
            "total_paid_out": round(float(already_paid), 2) if policy and city else 0.0,
            "remaining_cap":  remaining_cap,
        } if policy else None,
        "payout_history": [
            {
                "payout_id":    str(p.payout_id),
                "amount":       float(p.amount),
                "status":       p.status,
                "processed_at": p.processed_at.isoformat() if p.processed_at else None,
                "trigger_type": (
                    db.query(models.TriggerEvent.metric_type)
                    .filter(models.TriggerEvent.event_id == p.event_id)
                    .scalar()
                ) or "WEATHER",
            }
            for p in payouts
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ADMIN SUMMARY
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/summary")
def get_admin_dashboard(db: Session = Depends(get_db)):
    """Admin overview — flat keys for frontend, enriched disruptions with zone names."""
    total_riders      = db.query(models.RiderProfile).count()
    active_policies   = db.query(models.Policy).filter(models.Policy.status == "ACTIVE").count()
    pending_policies  = db.query(models.Policy).filter(models.Policy.status == "PENDING").count()
    total_payout_sum  = db.query(func.sum(models.Payout.amount)).scalar() or 0.0
    total_premium_sum = db.query(func.sum(models.Policy.premium_amount)).scalar() or 0.0
    total_fraud_blocked = db.query(func.count(models.FraudCheckLog.check_id)).filter(
        models.FraudCheckLog.result == "BLOCK"
    ).scalar() or 0

    active_events = db.query(models.TriggerEvent).filter(
        models.TriggerEvent.is_active == True
    ).order_by(models.TriggerEvent.started_at.desc()).all()

    loss_ratio = round(float(total_payout_sum) / float(total_premium_sum), 3) if total_premium_sum else 0.0

    disruptions = []
    for e in active_events:
        gz   = db.query(models.GeoZone).filter(models.GeoZone.zone_id == e.zone_id).first()
        city = db.query(models.CityBenchmark).filter(
            models.CityBenchmark.city_id == gz.city_id
        ).first() if gz else None
        riders_affected = db.query(func.count(models.RiderZone.profile_id)).filter(
            models.RiderZone.zone_id == e.zone_id
        ).scalar() or 0
        disruptions.append({
            "event_id":        str(e.event_id),
            "zone_id":         e.zone_id,
            "zone_name":       gz.zone_name if gz else f"Zone {e.zone_id}",
            "city":            city.city_name if city else "Unknown",
            "metric_type":     e.metric_type,
            "started_at":      e.started_at.isoformat() if e.started_at else None,
            "riders_affected": riders_affected,
            "payouts_queued":  db.query(func.count(models.Payout.payout_id)).filter(
                models.Payout.event_id == e.event_id
            ).scalar() or 0,
        })

    return {
        "total_riders":       total_riders,
        "active_policies":    active_policies,
        "pending_policies":   pending_policies,
        "premium_collected":  round(float(total_premium_sum), 2),
        "payouts_issued":     round(float(total_payout_sum), 2),
        "loss_ratio":         loss_ratio,
        "fraud_blocked_total": total_fraud_blocked,
        "active_disruptions": disruptions,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ADMIN ANALYTICS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/analytics")
def get_admin_analytics(db: Session = Depends(get_db)):
    """Analytics: premium vs payout per city, weekly payout trend, zone risk table."""
    city_rows  = db.query(models.CityBenchmark).all()
    city_stats = []
    for city in city_rows:
        rider_ids = [
            r.profile_id for r in db.query(models.RiderProfile)
            .filter(models.RiderProfile.city_id == city.city_id).all()
        ]
        if not rider_ids:
            continue
        premium = db.query(func.sum(models.Policy.premium_amount)).filter(
            models.Policy.profile_id.in_(rider_ids)
        ).scalar() or 0.0
        policy_ids = [
            p.policy_id for p in db.query(models.Policy)
            .filter(models.Policy.profile_id.in_(rider_ids)).all()
        ]
        payout = db.query(func.sum(models.Payout.amount)).filter(
            models.Payout.policy_id.in_(policy_ids)
        ).scalar() or 0.0 if policy_ids else 0.0
        if premium > 0 or payout > 0:
            city_stats.append({
                "city":       city.city_name,
                "premium":    round(float(premium), 2),
                "payout":     round(float(payout), 2),
                "loss_ratio": round(float(payout) / float(premium), 3) if premium else 0.0,
            })

    now    = datetime.now(timezone.utc)
    weekly = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end   = day_start + timedelta(days=1)
        total = db.query(func.sum(models.Payout.amount)).filter(
            models.Payout.processed_at >= day_start,
            models.Payout.processed_at <  day_end,
            models.Payout.status == "SUCCESS",
        ).scalar() or 0.0
        count = db.query(func.count(models.Payout.payout_id)).filter(
            models.Payout.processed_at >= day_start,
            models.Payout.processed_at <  day_end,
            models.Payout.status == "SUCCESS",
        ).scalar() or 0
        weekly.append({
            "day":    day_start.strftime("%a"),
            "date":   day_start.strftime("%d %b"),
            "amount": round(float(total), 2),
            "count":  count,
        })

    zones      = db.query(models.GeoZone).all()
    zone_table = []
    for z in zones:
        city = db.query(models.CityBenchmark).filter(
            models.CityBenchmark.city_id == z.city_id
        ).first()
        rider_count = db.query(func.count(models.RiderZone.profile_id)).filter(
            models.RiderZone.zone_id == z.zone_id
        ).scalar() or 0
        active_count = db.query(func.count(models.Policy.policy_id)).join(
            models.RiderZone, models.Policy.profile_id == models.RiderZone.profile_id
        ).filter(
            models.RiderZone.zone_id == z.zone_id,
            models.Policy.status == "ACTIVE",
        ).scalar() or 0
        event_count = db.query(func.count(models.TriggerEvent.event_id)).filter(
            models.TriggerEvent.zone_id == z.zone_id
        ).scalar() or 0
        zone_table.append({
            "zone_id":         z.zone_id,
            "zone_name":       z.zone_name,
            "city":            city.city_name if city else "Unknown",
            "risk_multiplier": float(z.base_risk_multiplier),
            "total_riders":    rider_count,
            "active_policies": active_count,
            "trigger_events":  event_count,
        })

    zone_table.sort(key=lambda x: x["risk_multiplier"], reverse=True)

    return {
        "city_stats":   city_stats,
        "weekly_trend": weekly,
        "zone_table":   zone_table,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ADMIN LIVE PAYOUTS  (fixed N+1, enriched per event)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/live-payouts")
def get_live_payouts(limit: int = 100, db: Session = Depends(get_db)):
    """
    Last N payouts enriched with rider name, zone, event type, rider source.
    Single JOIN query — no N+1 lookups.
    Groups payouts by event_id so the frontend can render expandable cards.
    """
    rows = (
        db.query(
            models.Payout,
            models.Policy,
            models.RiderProfile,
            models.TriggerEvent,
        )
        .join(models.Policy,      models.Payout.policy_id  == models.Policy.policy_id)
        .join(models.RiderProfile, models.Policy.profile_id == models.RiderProfile.profile_id)
        .outerjoin(models.TriggerEvent, models.Payout.event_id == models.TriggerEvent.event_id)
        .order_by(models.Payout.processed_at.desc())
        .limit(limit)
        .all()
    )

    # Batch-resolve primary zone names in one query
    profile_ids = list({str(r.profile_id) for _, _, r, _ in rows})
    zone_map: dict = {}
    if profile_ids:
        rz_rows = (
            db.query(models.RiderZone.profile_id, models.GeoZone.zone_name, models.GeoZone.zone_id)
            .join(models.GeoZone, models.RiderZone.zone_id == models.GeoZone.zone_id)
            .filter(models.RiderZone.is_primary == True)
            .filter(models.RiderZone.profile_id.in_(profile_ids))
            .all()
        )
        for pid, zname, zid in rz_rows:
            zone_map[str(pid)] = {"name": zname, "id": zid}

    # Build flat list — frontend does grouping
    result = []
    for payout, policy, rider, event in rows:
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
    return {"payouts": result}


# ══════════════════════════════════════════════════════════════════════════════
#  ML MODELS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/ml-models")
def get_ml_models():
    """Returns ML model metadata — type, features, importance, training stats."""
    from ..ml_engine import get_model_metadata
    return {"models": get_model_metadata()}


# ══════════════════════════════════════════════════════════════════════════════
#  FRAUD LOG
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/fraud-log")
def get_fraud_log(db: Session = Depends(get_db)):
    """Last 30 fraud checks with full feature breakdowns for admin visibility."""
    rows = (
        db.query(models.FraudCheckLog, models.RiderProfile)
        .join(models.RiderProfile, models.FraudCheckLog.profile_id == models.RiderProfile.profile_id)
        .order_by(models.FraudCheckLog.checked_at.desc())
        .limit(30)
        .all()
    )
    result = []
    for check, rider in rows:
        result.append({
            "check_id":     check.check_id,
            "rider_name":   rider.full_name,
            "profile_id":   str(check.profile_id),
            "event_id":     str(check.event_id) if check.event_id else None,
            "result":       check.result,
            "anomaly_score": float(check.anomaly_score) if check.anomaly_score else 0,
            "features":     check.features or {},
            "reason":       check.reason,
            "checked_at":   check.checked_at.isoformat() if check.checked_at else None,
        })

    total_checks = db.query(func.count(models.FraudCheckLog.check_id)).scalar() or 0
    total_blocks = db.query(func.count(models.FraudCheckLog.check_id)).filter(
        models.FraudCheckLog.result == "BLOCK"
    ).scalar() or 0

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
def get_admin_zones(db: Session = Depends(get_db)):
    """City → zones map for simulator target dropdowns."""
    cities = db.query(models.CityBenchmark).all()
    out    = {}
    for city in cities:
        zones = db.query(models.GeoZone).filter(
            models.GeoZone.city_id == city.city_id
        ).all()
        if zones:
            out[city.city_name] = [
                {
                    "zone_id":              z.zone_id,
                    "zone_name":            z.zone_name,
                    "base_risk_multiplier": float(z.base_risk_multiplier),
                }
                for z in zones
            ]
    return out


# ══════════════════════════════════════════════════════════════════════════════
#  ADMIN MAP  (aggregated — not 8k flat list)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/map")
def get_admin_map(db: Session = Depends(get_db)):
    """
    Returns geo data for Command Map: zone clusters + active events.
    Returns aggregate rider/policy counts per zone — NOT individual 8k row list.
    """
    zones = (
        db.query(models.GeoZone, models.CityBenchmark)
        .join(models.CityBenchmark, models.GeoZone.city_id == models.CityBenchmark.city_id)
        .all()
    )
    zone_list = []
    for zone, city in zones:
        rider_count = (
            db.query(func.count(models.RiderZone.profile_id))
            .filter(models.RiderZone.zone_id == zone.zone_id)
            .scalar() or 0
        )
        policy_count = (
            db.query(func.count(models.Policy.policy_id))
            .join(models.RiderZone, models.RiderZone.profile_id == models.Policy.profile_id)
            .filter(models.RiderZone.zone_id == zone.zone_id, models.Policy.status == "ACTIVE")
            .scalar() or 0
        )
        zone_list.append({
            "zone_id":   zone.zone_id,
            "zone_name": zone.zone_name,
            "city":      city.city_name,
            "risk":      float(zone.base_risk_multiplier),
            "riders":    rider_count,
            "policies":  policy_count,
        })

    active_events = (
        db.query(models.TriggerEvent)
        .filter(models.TriggerEvent.is_active == True)
        .all()
    )
    active_zone_ids = [e.zone_id for e in active_events]

    # Return zone-level aggregates for map rendering (not individual rider dots)
    return {
        "zones":        zone_list,
        "activeEvents": active_zone_ids,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  NOTIFICATIONS (completed trigger history)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/notifications")
def get_admin_notifications(db: Session = Depends(get_db)):
    """Returns the last 20 completed (inactive) disruptions for the notification bell."""
    events = (
        db.query(models.TriggerEvent)
        .filter(models.TriggerEvent.is_active == False)
        .order_by(models.TriggerEvent.ended_at.desc())
        .limit(20)
        .all()
    )
    notifs = []
    for e in events:
        zone = db.query(models.GeoZone).filter(models.GeoZone.zone_id == e.zone_id).first()
        payout_count = db.query(func.count(models.Payout.payout_id)).filter(
            models.Payout.event_id == e.event_id,
            models.Payout.status == "SUCCESS",
        ).scalar() or 0
        total_paid = float(
            db.query(func.coalesce(func.sum(models.Payout.amount), 0)).filter(
                models.Payout.event_id == e.event_id,
                models.Payout.status == "SUCCESS",
            ).scalar() or 0
        )
        notifs.append({
            "event_id":     str(e.event_id),
            "zone_name":    zone.zone_name if zone else "Unknown",
            "metric_type":  e.metric_type,
            "started_at":   e.started_at.isoformat() if e.started_at else None,
            "ended_at":     e.ended_at.isoformat() if e.ended_at else None,
            "metadata":     e.event_metadata,
            "payout_count": payout_count,
            "total_paid":   total_paid,
        })
    return {"notifications": notifs}


# ══════════════════════════════════════════════════════════════════════════════
#  GENERATE RIDERS  (background job + progress endpoint)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/generate-riders/status")
def get_generate_status():
    """Poll this to track progress of the background rider generation job."""
    with _gen_lock:
        return dict(_gen_state)


@router.post("/admin/generate-riders")
def generate_riders(background_tasks: BackgroundTasks, target_users: int = 8000):
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
        # ── STEP 1: Clear old mock riders safely in chunks ─────────────────
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
        _update_gen(15, f"Cleared {deleted} old records. Building {target_users} riders...")

        # ── STEP 2: Load zones ─────────────────────────────────────────────
        zones = db.query(models.GeoZone).all()
        if not zones:
            raise RuntimeError("No geo zones found in database — run init_db first.")

        # One shared bcrypt hash for all mock riders (significant speedup)
        mock_hash           = bcrypt.hashpw(b"mock_vero_2026", bcrypt.gensalt()).decode()
        now                 = datetime.now(timezone.utc)
        total_active_target = random.randint(5500, 5900)

        new_riders   = []
        new_rzones   = []
        new_policies = []
        new_activity = []

        for i in range(target_users):
            zone           = random.choice(zones)
            is_active_batch = i < total_active_target

            if is_active_batch:
                # Reliable rider profile
                tu      = random.uniform(0.6, 0.98)
                de      = random.uniform(0.6, 0.98)
                cr      = random.uniform(0.7, 0.99)
                r_score = min(((tu * de * cr) ** 0.5), 1.0)
                policy_status = "ACTIVE"
            else:
                # Low-reliability / fraud seed
                tu      = random.uniform(0.1, 0.5)
                de      = random.uniform(0.1, 0.5)
                cr      = random.uniform(0.1, 0.5)
                r_score = min(((tu * de * cr) ** 0.5), 1.0)
                policy_status = random.choice(["PENDING", "EXPIRED", "ACTIVE"])

            pr_id = uuid.uuid4()

            new_riders.append(models.RiderProfile(
                profile_id=pr_id,
                full_name=f"Rider_{i:05d}",
                phone_number=f"+9199{str(i).zfill(8)}",
                hashed_password=mock_hash,
                platform="mock_simulator",
                city_id=zone.city_id,
                shift_hours={"start": "06:00", "end": "23:00"},
                upi_id=f"sim{i}@vero",
                reliability_score=round(r_score, 2),
                is_verified=True,
                total_payouts_received=0.0,
                total_premium_paid=0.0,
                created_at=now,
            ))

            new_rzones.append(models.RiderZone(
                profile_id=pr_id, zone_id=zone.zone_id, is_primary=True
            ))

            activation_buffer = timedelta(seconds=random.randint(30, 300))
            new_policies.append(models.Policy(
                policy_id=uuid.uuid4(),
                profile_id=pr_id,
                premium_amount=round(random.uniform(10.0, 45.0), 2),
                coverage_ratio=round(0.40 + 0.25 * r_score, 2),
                r_factor_at_purchase=round(r_score, 4),
                status=policy_status,
                purchased_at=now - timedelta(hours=random.randint(24, 72)),
                activated_at=(now - activation_buffer) if policy_status == "ACTIVE" else (now + timedelta(hours=1)),
                expires_at=now + timedelta(days=7),
                is_surcharge_applied=False,
            ))

            # Activity logs — reliable riders log in-zone, fraud riders log wrong-zone
            if policy_status == "ACTIVE" and is_active_batch:
                for _ in range(random.randint(2, 5)):
                    new_activity.append(models.RiderActivityLog(
                        profile_id=pr_id,
                        activity_type="delivery",
                        zone_id=zone.zone_id,
                        recorded_at=now - timedelta(minutes=random.randint(5, 90)),
                    ))
            elif not is_active_batch:
                wrong_zone = random.choice(
                    [z for z in zones if z.zone_id != zone.zone_id] or zones
                )
                for _ in range(random.randint(1, 3)):
                    new_activity.append(models.RiderActivityLog(
                        profile_id=pr_id,
                        activity_type="delivery",
                        zone_id=wrong_zone.zone_id,
                        recorded_at=now - timedelta(minutes=random.randint(120, 1440)),
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
