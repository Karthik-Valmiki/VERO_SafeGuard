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
