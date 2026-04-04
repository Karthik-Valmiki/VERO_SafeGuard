from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone

from ..db import models
from ..core.security import get_current_rider
from ..db.database import get_db
from ..core.config import DEMO_ACTIVATION_SECONDS
from ..routers.auth import compute_r, compute_coverage_and_premium, _get_zone, _is_new_user, _secs_until_active
from ..schemas.auth import PremiumQuote

router = APIRouter(prefix="/policies", tags=["Policies"])


@router.get("/quote", response_model=PremiumQuote)
def get_premium_quote(
    current_rider: models.RiderProfile = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    """
    Returns the rider's personalised premium quote based on their city/zone.
    Call this before /purchase so the frontend can show the amount.
    No policy is created here.
    """
    city = db.query(models.CityBenchmark).filter(
        models.CityBenchmark.city_id == current_rider.city_id
    ).first()
    if not city:
        raise HTTPException(status_code=404, detail="City data not found")

    zone = _get_zone(current_rider.profile_id, db)
    is_new = _is_new_user(current_rider.profile_id, db)
    r = compute_r(current_rider.profile_id, db) if not is_new else 0.0
    coverage, premium, weekly_cap = compute_coverage_and_premium(city, zone, r, is_new)

    return PremiumQuote(
        city=city.city_name,
        zone_id=zone.zone_id if zone else 0,
        zone_name=zone.zone_name if zone else f"{city.city_name} Central",
        zone_risk_multiplier=float(zone.base_risk_multiplier) if zone else float(city.default_risk_multiplier),
        reliability_score=r,
        coverage_pct=round(coverage * 100, 1),
        premium=premium,
        weekly_cap=weekly_cap,
        is_new_user=is_new,
    )


@router.post("/purchase")
def purchase_policy(
    current_rider: models.RiderProfile = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    """
    One-click policy purchase — no payment input needed for demo.
    Rider presses 'Pay & Activate' button on frontend → this endpoint fires.
    Policy starts as PENDING, becomes ACTIVE after DEMO_ACTIVATION_SECONDS (20s).
    """
    existing = db.query(models.Policy).filter(
        models.Policy.profile_id == current_rider.profile_id,
        models.Policy.status.in_(["ACTIVE", "PENDING"]),
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"You already have a {existing.status} policy (ID: {existing.policy_id}). It expires at {existing.expires_at.isoformat()}.",
        )

    city = db.query(models.CityBenchmark).filter(
        models.CityBenchmark.city_id == current_rider.city_id
    ).first()
    if not city:
        raise HTTPException(status_code=404, detail="City data not found")

    zone = _get_zone(current_rider.profile_id, db)
    is_new = _is_new_user(current_rider.profile_id, db)
    r = compute_r(current_rider.profile_id, db) if not is_new else 0.0
    coverage, premium, weekly_cap = compute_coverage_and_premium(city, zone, r, is_new)

    now = datetime.now(timezone.utc)
    policy = models.Policy(
        profile_id=current_rider.profile_id,
        premium_amount=premium,
        coverage_ratio=coverage,
        r_factor_at_purchase=r,
        purchased_at=now,
        activated_at=now + timedelta(seconds=DEMO_ACTIVATION_SECONDS),
        expires_at=now + timedelta(days=7),
        status="PENDING",
    )
    db.add(policy)
    current_rider.total_premium_paid = float(current_rider.total_premium_paid or 0) + premium
    # Seed an activity log so fraud check passes immediately after purchase
    if zone:
        db.add(models.RiderActivityLog(
            profile_id=current_rider.profile_id,
            activity_type="POLICY_PURCHASE",
            zone_id=zone.zone_id,
            recorded_at=now,
        ))
    db.commit()
    db.refresh(policy)

    return {
        "message": "Policy purchased. Activates in 20 seconds (demo = 24 hours real).",
        "policy_id": str(policy.policy_id),
        "status": policy.status,
        "premium_paid": premium,
        "coverage_pct": round(coverage * 100, 1),
        "weekly_cap": weekly_cap,
        "reliability_score": r,
        "activates_in_seconds": DEMO_ACTIVATION_SECONDS,
        "activated_at": policy.activated_at.isoformat(),
        "expires_at": policy.expires_at.isoformat(),
    }


@router.get("/my-policy")
def get_my_policy(
    current_rider: models.RiderProfile = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    """Returns the rider's current policy status, cap usage, and countdown."""
    # Auto-promote PENDING → ACTIVE if window has passed
    now = datetime.now(timezone.utc)
    policy = (
        db.query(models.Policy)
        .filter(
            models.Policy.profile_id == current_rider.profile_id,
            models.Policy.status.in_(["ACTIVE", "PENDING"]),
        )
        .order_by(models.Policy.purchased_at.desc())
        .first()
    )
    if not policy:
        raise HTTPException(status_code=404, detail="No active or pending policy found. Call /policies/purchase first.")

    # Promote if activation window passed
    if policy.status == "PENDING" and policy.activated_at:
        act = policy.activated_at
        if act.tzinfo is None:
            act = act.replace(tzinfo=timezone.utc)
        if act <= now:
            policy.status = "ACTIVE"
            db.commit()

    # Mock Activity Log for Fraud Detection (Location spoof blocker)
    # In a real app, rider app sends GPS pings. In demo, viewing dashboard counts as activity.
    zone = _get_zone(current_rider.profile_id, db)
    if zone:
        db.add(models.RiderActivityLog(
            profile_id=current_rider.profile_id,
            activity_type="DASHBOARD_PING",
            zone_id=zone.zone_id,
            recorded_at=now
        ))
        db.commit()

    city = db.query(models.CityBenchmark).filter(
        models.CityBenchmark.city_id == current_rider.city_id
    ).first()
    weekly_cap = float(city.baseline_weekly_income) * float(policy.coverage_ratio) if city else 0.0

    paid_out = db.query(models.Payout).filter(
        models.Payout.policy_id == policy.policy_id,
        models.Payout.status == "SUCCESS",
    ).all()
    total_paid = sum(float(p.amount) for p in paid_out)

    return {
        "policy_id": str(policy.policy_id),
        "status": policy.status,
        "coverage_pct": round(float(policy.coverage_ratio) * 100, 1),
        "premium_paid": float(policy.premium_amount),
        "weekly_cap": round(weekly_cap, 2),
        "total_paid_out": round(total_paid, 2),
        "remaining_cap": round(max(0, weekly_cap - total_paid), 2),
        "activates_in_seconds": _secs_until_active(policy),
        "activated_at": policy.activated_at.isoformat() if policy.activated_at else None,
        "expires_at": policy.expires_at.isoformat() if policy.expires_at else None,
    }
