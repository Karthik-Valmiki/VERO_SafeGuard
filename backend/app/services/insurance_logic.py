"""
insurance_logic.py
Pure business logic for premium calculation and R-score computation.
No FastAPI, no DB models — only domain rules.
Called by routers and payout_engine.
"""
import math
import logging
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from ..db import models
from ..ml_engine import predict_rider_metrics

logger = logging.getLogger(__name__)

def compute_r(profile_id, db: Session) -> float:
    """R = min(sqrt(TU × DE × CR), 1.0). Returns 0.0 for new users."""
    h = (
        db.query(models.RiderPerformanceHistory)
        .filter(models.RiderPerformanceHistory.profile_id == profile_id)
        .order_by(models.RiderPerformanceHistory.week_start_date.desc())
        .first()
    )
    if not h:
        return 0.0
    tu = float(h.time_utilization or 0.0)
    de = float(h.delivery_efficiency or 0.0)
    cr = float(h.completion_rate or 0.0)
    return round(min(math.sqrt(tu * de * cr), 1.0), 2)


def compute_r_breakdown(profile_id, db: Session) -> dict:
    """Returns full R breakdown — last 4 weeks of history + current R."""
    rows = (
        db.query(models.RiderPerformanceHistory)
        .filter(models.RiderPerformanceHistory.profile_id == profile_id)
        .order_by(models.RiderPerformanceHistory.week_start_date.desc())
        .limit(4)
        .all()
    )
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


def is_new_user(profile_id, db: Session) -> bool:
    return (
        db.query(models.RiderPerformanceHistory)
        .filter(models.RiderPerformanceHistory.profile_id == profile_id)
        .count()
    ) < 2


def _infer_lifestyle_features(profile_id, db: Session) -> tuple[int, float, int]:
    """Helper to derive ML lifestyle inputs from DB rider profile."""
    rider = db.query(models.RiderProfile).filter(models.RiderProfile.profile_id == profile_id).first()
    
    # Defaults
    shift_pref = 1
    avg_hours = 8.0
    exp_months = 12

    if rider:
        # Infer experience
        if rider.created_at:
            delta = datetime.now(timezone.utc) - rider.created_at
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


def compute_coverage_and_premium(
    city: models.CityBenchmark,
    zone: models.GeoZone | None,
    profile_id,
    is_new: bool,
    db: Session,
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
    shift_preference, avg_daily_hours, experience_months = _infer_lifestyle_features(profile_id, db)
    weather_severity = 0.5  # Standard baseline for prediction mapping
    
    # ML Engine strictly predicts the raw probabilities (TU, DE, CR)
    pred_tu, pred_de, pred_cr = predict_rider_metrics(
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
