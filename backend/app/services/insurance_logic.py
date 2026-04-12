"""
insurance_logic.py
Pure business logic for premium calculation and R-score computation.
No FastAPI, no DB models — only domain rules.
Called by routers and payout_engine.
"""
import math
import logging
from sqlalchemy.orm import Session
from ..db import models
from ..ml_engine import predict_premium_multiplier

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


def get_rider_metrics(profile_id, db: Session) -> tuple[float, float, float]:
    """Returns (TU, DE, CR) from latest performance week. Falls back to city averages."""
    h = (
        db.query(models.RiderPerformanceHistory)
        .filter(models.RiderPerformanceHistory.profile_id == profile_id)
        .order_by(models.RiderPerformanceHistory.week_start_date.desc())
        .first()
    )
    if not h:
        return 0.65, 0.60, 0.85  # gig-economy internet averages
    return float(h.time_utilization or 0.0), float(h.delivery_efficiency or 0.0), float(h.completion_rate or 0.0)


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
    Returning  → RF predicts R from (TU, DE, CR); XGBoost predicts risk multiplier.
                 Coverage = 40% + 25% × R  (max 65%)
                 Premium  = base_rate × XGB_predicted_multiplier

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

    tu, de, cr = get_rider_metrics(profile_id, db)
    predicted_r, predicted_risk_mult = predict_premium_multiplier(
        zone_base_risk=risk_multi, tu=tu, de=de, cr=cr
    )

    coverage = round(min(0.40 + 0.25 * predicted_r, 0.65), 4)
    premium = round(base_rate * predicted_risk_mult, 2)
    weekly_cap = round(float(city.baseline_weekly_income) * coverage, 2)
    return coverage, premium, weekly_cap
