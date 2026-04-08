from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timezone

from ..db import models
from ..db.database import get_db
from ..core.security import get_current_rider
from ..routers.auth import compute_r, compute_r_breakdown, compute_coverage_and_premium

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])


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

    # For returning users, also compute what a new user would pay — shows the reward
    zone = (
        db.query(models.GeoZone)
        .join(models.RiderZone, models.GeoZone.zone_id == models.RiderZone.zone_id)
        .filter(models.RiderZone.profile_id == current_rider.profile_id,
                models.RiderZone.is_primary == True)
        .first()
    )
    coverage_now, premium_now, weekly_cap_now = compute_coverage_and_premium(city, zone, r, is_new) if city else (0.4, 0, 0)
    coverage_new, premium_new, _ = compute_coverage_and_premium(city, zone, 0.0, True) if city else (0.4, 0, 0)

    now = datetime.now(timezone.utc)
    
    # Auto-promote PENDING → ACTIVE if activation window has passed
    if policy and policy.status == "PENDING" and policy.activated_at:
        act = policy.activated_at
        if act.tzinfo is None:
            act = act.replace(tzinfo=timezone.utc)
        if act <= now:
            policy.status = "ACTIVE"
            db.commit()
            db.refresh(policy)
    
    secs_left = 0
    if policy and policy.status == "PENDING" and policy.activated_at:
        act = policy.activated_at
        if act.tzinfo is None:
            act = act.replace(tzinfo=timezone.utc)
        secs_left = max(0, int((act - now).total_seconds()))

    weekly_cap = 0.0
    total_paid_out = 0.0
    if policy and city:
        weekly_cap = round(float(city.baseline_weekly_income) * float(policy.coverage_ratio), 2)
        total_paid_out = sum(float(p.amount) for p in payouts if p.status == "SUCCESS")

    return {
        "rider": {
            "profile_id": str(current_rider.profile_id),
            "name": current_rider.full_name,
            "phone_number": current_rider.phone_number,  # Add phone number
            "platform": current_rider.platform,
            "city": city.city_name if city else "Unknown",
            "shift_start": current_rider.shift_hours.get("start") if current_rider.shift_hours else None,
            "shift_end": current_rider.shift_hours.get("end") if current_rider.shift_hours else None,
            "upi_id": current_rider.upi_id,
            "reliability_score": r,
            "is_new_user": is_new,
            "total_payouts_received": float(current_rider.total_payouts_received or 0),
            "total_premium_paid": float(current_rider.total_premium_paid or 0),
            # R breakdown for returning users
            "r_breakdown": r_breakdown,
            # Premium comparison: what they pay vs what a new user would pay
            "premium_comparison": {
                "your_premium": premium_now,
                "new_user_premium": premium_new,
                "your_coverage_pct": round(coverage_now * 100, 1),
                "new_user_coverage_pct": round(coverage_new * 100, 1),
                "premium_saving": round(max(0, premium_new - premium_now), 2),
                "coverage_gain_pct": round(max(0, coverage_now - coverage_new) * 100, 1),
            },
        },
        "policy": {
            "policy_id": str(policy.policy_id) if policy else None,
            "status": policy.status if policy else "NONE",
            "coverage_pct": round(float(policy.coverage_ratio) * 100, 1) if policy else 0,
            "premium_paid": float(policy.premium_amount) if policy else 0,
            "weekly_cap": weekly_cap,
            "total_paid_out": round(total_paid_out, 2),
            "remaining_cap": round(max(0, weekly_cap - total_paid_out), 2),
            "activates_in_seconds": secs_left,
            "activated_at": policy.activated_at.isoformat() if policy and policy.activated_at else None,
            "expires_at": policy.expires_at.isoformat() if policy and policy.expires_at else None,
        },
        "payout_history": [
            {
                "payout_id": str(p.payout_id),
                "amount": float(p.amount),
                "status": p.status,
                "processed_at": p.processed_at.isoformat() if p.processed_at else None,
            }
            for p in payouts
        ],
    }


@router.get("/admin/summary")
def get_admin_dashboard(db: Session = Depends(get_db)):
    """Admin overview — riders, payouts, active disruptions."""
    total_riders = db.query(models.RiderProfile).count()
    active_policies = db.query(models.Policy).filter(models.Policy.status == "ACTIVE").count()
    pending_policies = db.query(models.Policy).filter(models.Policy.status == "PENDING").count()
    total_payout_sum = db.query(func.sum(models.Payout.amount)).scalar() or 0.0
    total_premium_sum = db.query(func.sum(models.Policy.premium_amount)).scalar() or 0.0

    active_events = db.query(models.TriggerEvent).filter(
        models.TriggerEvent.is_active == True
    ).order_by(models.TriggerEvent.started_at.desc()).all()

    recent_payouts = (
        db.query(models.Payout)
        .order_by(models.Payout.processed_at.desc())
        .limit(10)
        .all()
    )

    loss_ratio = round(float(total_payout_sum) / float(total_premium_sum), 3) if total_premium_sum else 0.0

    return {
        "network": {
            "total_riders": total_riders,
            "active_policies": active_policies,
            "pending_policies": pending_policies,
            "total_premiums_collected": round(float(total_premium_sum), 2),
            "total_payouts_issued": round(float(total_payout_sum), 2),
            "loss_ratio": loss_ratio,
        },
        "active_disruptions": [
            {
                "event_id": str(e.event_id),
                "zone_id": e.zone_id,
                "type": e.metric_type,
                "started_at": e.started_at.isoformat() if e.started_at else None,
            }
            for e in active_events
        ],
        "recent_payouts": [
            {
                "payout_id": str(p.payout_id),
                "amount": float(p.amount),
                "status": p.status,
                "processed_at": p.processed_at.isoformat() if p.processed_at else None,
            }
            for p in recent_payouts
        ],
    }


@router.get("/admin/predictive")
def get_admin_predictive(db: Session = Depends(get_db)):
    """
    Predictive analytics for next week.
    Uses deterministic math: zone risk × active policies × avg payout per event.
    No ML training data required.
    """
    zones = db.query(models.GeoZone).all()
    now = datetime.now(timezone.utc)

    zone_predictions = []
    for zone in zones:
        city = db.query(models.CityBenchmark).filter(
            models.CityBenchmark.city_id == zone.city_id
        ).first()
        if not city:
            continue

        # Count active policies in this zone
        policy_count = (
            db.query(models.Policy)
            .join(models.RiderZone, models.Policy.profile_id == models.RiderZone.profile_id)
            .filter(
                models.RiderZone.zone_id == zone.zone_id,
                models.Policy.status == "ACTIVE",
                models.Policy.expires_at > now,
            )
            .count()
        )

        # Historical trigger rate for this zone (events per week)
        total_events = db.query(models.TriggerEvent).filter(
            models.TriggerEvent.zone_id == zone.zone_id
        ).count()
        # Assume data spans ~4 weeks; floor at 0.5 so new zones still show a forecast
        trigger_rate_per_week = max(0.5, total_events / 4.0)

        # Average payout per event in this zone
        avg_payout_row = (
            db.query(func.avg(models.Payout.amount))
            .join(models.TriggerEvent, models.Payout.event_id == models.TriggerEvent.event_id)
            .filter(models.TriggerEvent.zone_id == zone.zone_id)
            .scalar()
        )
        avg_payout = float(avg_payout_row or 0) or float(city.baseline_weekly_income) * 0.05

        risk_mult = float(zone.base_risk_multiplier)
        expected_claims = round(policy_count * trigger_rate_per_week * risk_mult * avg_payout, 2)

        # Expected premium revenue next week
        avg_premium_row = (
            db.query(func.avg(models.Policy.premium_amount))
            .join(models.RiderZone, models.Policy.profile_id == models.RiderZone.profile_id)
            .filter(models.RiderZone.zone_id == zone.zone_id)
            .scalar()
        )
        avg_premium = float(avg_premium_row or 0) or float(city.baseline_weekly_income) * 0.02
        expected_revenue = round(policy_count * avg_premium, 2)

        expected_loss_ratio = round(expected_claims / expected_revenue, 3) if expected_revenue > 0 else 0.0

        # Risk level label
        if risk_mult >= 1.20:
            risk_label = "HIGH"
        elif risk_mult >= 1.10:
            risk_label = "MEDIUM"
        else:
            risk_label = "LOW"

        zone_predictions.append({
            "zone_id": zone.zone_id,
            "zone_name": zone.zone_name,
            "city": city.city_name,
            "risk_multiplier": risk_mult,
            "risk_label": risk_label,
            "active_policies": policy_count,
            "expected_claims_next_week": expected_claims,
            "expected_revenue_next_week": expected_revenue,
            "expected_loss_ratio": expected_loss_ratio,
        })

    # Sort by expected claims descending
    zone_predictions.sort(key=lambda x: x["expected_claims_next_week"], reverse=True)

    # Network-level totals
    total_expected_claims = round(sum(z["expected_claims_next_week"] for z in zone_predictions), 2)
    total_expected_revenue = round(sum(z["expected_revenue_next_week"] for z in zone_predictions), 2)
    network_loss_ratio = round(total_expected_claims / total_expected_revenue, 3) if total_expected_revenue > 0 else 0.0

    # Weekly payout trend (last 4 weeks bucketed)
    weekly_trend = []
    for week_offset in range(3, -1, -1):
        from datetime import timedelta
        week_start = now - timedelta(weeks=week_offset + 1)
        week_end = now - timedelta(weeks=week_offset)
        payout_sum = db.query(func.sum(models.Payout.amount)).filter(
            models.Payout.processed_at >= week_start,
            models.Payout.processed_at < week_end,
            models.Payout.status == "SUCCESS",
        ).scalar() or 0.0
        premium_sum = db.query(func.sum(models.Policy.premium_amount)).filter(
            models.Policy.purchased_at >= week_start,
            models.Policy.purchased_at < week_end,
        ).scalar() or 0.0
        weekly_trend.append({
            "week_label": f"W-{week_offset + 1}" if week_offset > 0 else "This week",
            "payouts": round(float(payout_sum), 2),
            "premiums": round(float(premium_sum), 2),
        })

    return {
        "network_forecast": {
            "total_expected_claims": total_expected_claims,
            "total_expected_revenue": total_expected_revenue,
            "expected_loss_ratio": network_loss_ratio,
            "loss_ratio_status": (
                "HEALTHY" if 0.40 <= network_loss_ratio <= 0.60
                else "ELEVATED" if network_loss_ratio > 0.60
                else "LOW_UTILISATION"
            ),
        },
        "zone_predictions": zone_predictions,
        "weekly_trend": weekly_trend,
    }


@router.get("/admin/zones")
def get_zone_breakdown(db: Session = Depends(get_db)):
    """All zones with their risk multipliers and active policy counts — for zone premium table."""
    zones = db.query(models.GeoZone).all()
    now = datetime.now(timezone.utc)
    result = []
    for zone in zones:
        city = db.query(models.CityBenchmark).filter(
            models.CityBenchmark.city_id == zone.city_id
        ).first()
        active = (
            db.query(models.Policy)
            .join(models.RiderZone, models.Policy.profile_id == models.RiderZone.profile_id)
            .filter(
                models.RiderZone.zone_id == zone.zone_id,
                models.Policy.status == "ACTIVE",
                models.Policy.expires_at > now,
            )
            .count()
        )
        result.append({
            "zone_id": zone.zone_id,
            "zone_name": zone.zone_name,
            "city": city.city_name if city else "Unknown",
            "risk_multiplier": float(zone.base_risk_multiplier),
            "active_policies": active,
        })
    result.sort(key=lambda x: x["risk_multiplier"], reverse=True)
    return result
