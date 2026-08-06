"""
insurance_logic.py
Pure business logic for premium calculation and R-score computation.
No FastAPI, no DB models — only domain rules.
Called by routers and payout_engine.
"""
import math
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
import asyncio
from datetime import datetime, timezone
from ..db import models
from ..ml_engine import predict_rider_metrics

logger = logging.getLogger(__name__)

async def compute_r(profile_id, db: AsyncSession) -> float:
    """R = min(sqrt(TU × DE × CR), 1.0). Returns 0.0 for new users."""
    result = await db.execute(
        select(models.RiderPerformanceHistory)
        .filter(models.RiderPerformanceHistory.profile_id == profile_id)
        .order_by(models.RiderPerformanceHistory.week_start_date.desc())
    )
    h = result.scalars().first()
    if not h:
        return 0.0
    tu = float(h.time_utilization or 0.0)
    de = float(h.delivery_efficiency or 0.0)
    cr = float(h.completion_rate or 0.0)
    return round(min(math.sqrt(tu * de * cr), 1.0), 2)


async def compute_r_breakdown(profile_id, db: AsyncSession) -> dict:
    """Returns full R breakdown — last 4 weeks of history + current R."""
    result = await db.execute(
        select(models.RiderPerformanceHistory)
        .filter(models.RiderPerformanceHistory.profile_id == profile_id)
        .order_by(models.RiderPerformanceHistory.week_start_date.desc())
        .limit(4)
    )
    rows = result.scalars().all()
    if not rows:
        return {"r": 0.0, "tu": 0.0, "de": 0.0, "cr": 0.0, "weeks_tracked": 0, "history": []}

    latest = rows[0]
    tu = float(latest.time_utilization or 0.0)
    de = float(latest.delivery_efficiency or 0.0)
    cr = float(latest.completion_rate or 0.0)
    r = round(min(math.sqrt(tu * de * cr), 1.0), 2)

    return {
        "r": r,
        "tu": round(tu, 2),
        "de": round(de, 2),
        "cr": round(cr, 2),
        "weeks_tracked": len(rows),
        "history": [
            {
                "week": str(row.week_start_date),
                "tu": float(row.time_utilization or 0),
                "de": float(row.delivery_efficiency or 0),
                "cr": float(row.completion_rate or 0),
                "r": float(row.final_r_score or 0),
            }
            for row in rows
        ],
    }


async def is_new_user(profile_id, db: AsyncSession) -> bool:
    result = await db.execute(
        select(func.count(models.RiderPerformanceHistory.history_id))
        .filter(models.RiderPerformanceHistory.profile_id == profile_id)
    )
    count = result.scalar()
    return count < 2


async def _infer_lifestyle_features(profile_id, db: AsyncSession) -> tuple[int, float, int]:
    """Helper to derive ML lifestyle inputs from DB rider profile."""
    result = await db.execute(
        select(models.RiderProfile).filter(models.RiderProfile.profile_id == profile_id)
    )
    rider = result.scalars().first()
    
    # Defaults
    shift_pref = 1
    avg_hours = 8.0
    exp_months = 12

    if rider:
        # Infer experience
        if rider.created_at:
            dt_now = datetime.now(timezone.utc)
            dt_created = rider.created_at.replace(tzinfo=timezone.utc) if rider.created_at.tzinfo is None else rider.created_at
            delta = dt_now - dt_created
            exp_months = max(1, int(delta.days / 30))
        
        # Infer shift and hours
        if rider.shift_hours and isinstance(rider.shift_hours, dict):
            start = rider.shift_hours.get("start", "12:00")
            end = rider.shift_hours.get("end", "20:00")
            try:
                # Basic parsing "HH:MM"
                h_start = int(start.split(":")[0])
                h_end = int(end.split(":")[0])
                if h_end < h_start:
                    h_end += 24
                avg_hours = float(h_end - h_start)
                
                if h_start < 10: shift_pref = 0
                elif h_start < 15: shift_pref = 1
                elif h_start < 20: shift_pref = 2
                else: shift_pref = 3
            except:
                pass
                
    return shift_pref, avg_hours, exp_months


async def compute_coverage_and_premium(
    city: models.CityBenchmark,
    zone: models.GeoZone | None,
    profile_id,
    is_new: bool,
    db: AsyncSession,
) -> tuple[float, float, float]:
    """
    ML-driven premium and coverage engine.

    New users  → fixed 40% coverage, base_rate × zone_risk (no R adjustment).
    Returning  → ML predicts (TU, DE, CR) from lifestyle factors.
                 Deterministic R = min(sqrt(TU × DE × CR), 1.0)
                 Coverage = 40% + 25% × R  (max 65%)
                 Premium  = base_rate × zone_risk × (1.5 - R)

    Returns (coverage_ratio, premium_amount, weekly_cap).
    """
    base_rate = float(city.baseline_weekly_income) * 0.02
    risk_multi = (
        float(zone.base_risk_multiplier)
        if zone
        else float(city.default_risk_multiplier)
    )

    if is_new:
        coverage = 0.40
        premium = round(base_rate * risk_multi, 2)
        weekly_cap = round(float(city.baseline_weekly_income) * coverage, 2)
        return coverage, premium, weekly_cap

    # Extract lifestyle ML inputs
    shift_preference, avg_daily_hours, experience_months = await _infer_lifestyle_features(profile_id, db)
    weather_severity = 0.5  # Standard baseline for prediction mapping
    
    # ML Engine strictly predicts the raw probabilities (TU, DE, CR)
    pred_tu, pred_de, pred_cr = await asyncio.to_thread(
        predict_rider_metrics,
        shift_preference=shift_preference,
        zone_risk_index=risk_multi,
        avg_daily_hours=avg_daily_hours,
        experience_months=experience_months,
        weather_severity=weather_severity
    )
    
    # Deterministic Formula Layer (Low-level Math enforcement)
    predicted_r = round(min(math.sqrt(pred_tu * pred_de * pred_cr), 1.0), 4)

    coverage = round(min(0.40 + 0.25 * predicted_r, 0.65), 4)
    premium = round(base_rate * risk_multi * (1.5 - predicted_r), 2)
    weekly_cap = round(float(city.baseline_weekly_income) * coverage, 2)
    
    return coverage, premium, weekly_cap
