from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
import hmac
import hashlib

from ..db import models
from ..core.security import get_current_rider
from ..db.database import get_db
from ..core.config import DEMO_ACTIVATION_SECONDS, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
from ..routers.auth import compute_r, compute_coverage_and_premium, _get_zone, _is_new_user, _secs_until_active
from ..schemas.auth import PremiumQuote

router = APIRouter(prefix="/policies", tags=["Policies"])


def _razorpay_available() -> bool:
    return bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)


@router.get("/quote", response_model=PremiumQuote)
def get_premium_quote(
    current_rider: models.RiderProfile = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
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
    """Direct purchase fallback — used when Razorpay keys are not configured."""
    existing = db.query(models.Policy).filter(
        models.Policy.profile_id == current_rider.profile_id,
        models.Policy.status.in_(["ACTIVE", "PENDING"]),
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"You already have a {existing.status} policy.",
        )
    return _activate_policy(current_rider, db)


@router.post("/create-order")
def create_razorpay_order(
    current_rider: models.RiderProfile = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    """
    Creates a Razorpay order on the backend and returns the raw order data
    needed by the frontend to open the checkout modal.

    The backend is responsible for:
      - Computing the correct premium (zone-aware)
      - Creating the Razorpay order via the server-side SDK
      - Returning order_id, amount, key_id, and rider prefill data

    The frontend is responsible for:
      - Loading the Razorpay JS SDK
      - Configuring the checkout modal (UPI method, display config)
      - Opening the modal and handling the payment response
    """
    existing = db.query(models.Policy).filter(
        models.Policy.profile_id == current_rider.profile_id,
        models.Policy.status.in_(["ACTIVE", "PENDING"]),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"You already have a {existing.status} policy.")

    city = db.query(models.CityBenchmark).filter(
        models.CityBenchmark.city_id == current_rider.city_id
    ).first()
    if not city:
        raise HTTPException(status_code=404, detail="City data not found")

    zone = _get_zone(current_rider.profile_id, db)
    is_new = _is_new_user(current_rider.profile_id, db)
    r = compute_r(current_rider.profile_id, db) if not is_new else 0.0
    coverage, premium, weekly_cap = compute_coverage_and_premium(city, zone, r, is_new)

    # Razorpay requires amount in paise (integer). Minimum 100 paise = ₹1.
    amount_paise = max(100, int(round(premium * 100)))

    if not _razorpay_available():
        # No keys — return mock order. Frontend falls back to /purchase directly.
        return {
            "razorpay_available": False,
            "order_id": "mock_order_demo",
            "amount": amount_paise,
            "currency": "INR",
            "key_id": "",
            "premium": premium,
            "coverage_pct": round(coverage * 100, 1),
            "weekly_cap": weekly_cap,
            "rider_name": current_rider.full_name,
            "rider_upi": current_rider.upi_id or "",
        }

    import razorpay
    client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    order = client.order.create({
        "amount": amount_paise,
        "currency": "INR",
        "receipt": f"vero_{str(current_rider.profile_id)[:8]}",
        "notes": {
            "rider_id": str(current_rider.profile_id),
            "zone": zone.zone_name if zone else city.city_name,
            "coverage_pct": str(round(coverage * 100, 1)),
        },
    })

    # Return only raw order data — no checkout config, no method restrictions.
    # All Razorpay modal configuration (UPI-only, display blocks) lives in the frontend.
    return {
        "razorpay_available": True,
        "order_id": order["id"],
        "amount": amount_paise,
        "currency": "INR",
        "key_id": RAZORPAY_KEY_ID,
        "premium": premium,
        "coverage_pct": round(coverage * 100, 1),
        "weekly_cap": weekly_cap,
        "rider_name": current_rider.full_name,
        "rider_upi": current_rider.upi_id or "",
    }


@router.post("/verify-payment")
def verify_razorpay_payment(
    payload: dict,
    current_rider: models.RiderProfile = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
    """
    Verifies the Razorpay HMAC signature server-side, then activates the policy.

    Signature verification must happen on the backend — the secret key must
    never be exposed to the frontend. This is the correct production pattern.

    Payload: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    """
    order_id = payload.get("razorpay_order_id", "")
    payment_id = payload.get("razorpay_payment_id", "")
    signature = payload.get("razorpay_signature", "")

    # Mock path — no keys configured or demo order
    if order_id == "mock_order_demo" or not _razorpay_available():
        return _activate_policy(current_rider, db)

    # HMAC-SHA256 verification using the Razorpay secret key (server-side only)
    body = f"{order_id}|{payment_id}"
    expected = hmac.new(
        RAZORPAY_KEY_SECRET.encode(),
        body.encode(),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    return _activate_policy(current_rider, db)


@router.get("/my-policy")
def get_my_policy(
    current_rider: models.RiderProfile = Depends(get_current_rider),
    db: Session = Depends(get_db),
):
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
        raise HTTPException(status_code=404, detail="No active or pending policy found.")

    if policy.status == "PENDING" and policy.activated_at:
        act = policy.activated_at
        if act.tzinfo is None:
            act = act.replace(tzinfo=timezone.utc)
        if act <= now:
            policy.status = "ACTIVE"
            db.commit()

    zone = _get_zone(current_rider.profile_id, db)
    if zone:
        db.add(models.RiderActivityLog(
            profile_id=current_rider.profile_id,
            activity_type="DASHBOARD_PING",
            zone_id=zone.zone_id,
            recorded_at=now,
        ))
        db.commit()

    city = db.query(models.CityBenchmark).filter(
        models.CityBenchmark.city_id == current_rider.city_id
    ).first()
    weekly_cap = float(city.baseline_weekly_income) * float(policy.coverage_ratio) if city else 0.0
    total_paid = sum(
        float(p.amount)
        for p in db.query(models.Payout).filter(
            models.Payout.policy_id == policy.policy_id,
            models.Payout.status == "SUCCESS",
        ).all()
    )

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


def _activate_policy(rider: models.RiderProfile, db: Session) -> dict:
    """Creates a PENDING policy after payment is confirmed."""
    existing = db.query(models.Policy).filter(
        models.Policy.profile_id == rider.profile_id,
        models.Policy.status.in_(["ACTIVE", "PENDING"]),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Policy already exists: {existing.status}")

    city = db.query(models.CityBenchmark).filter(
        models.CityBenchmark.city_id == rider.city_id
    ).first()
    zone = _get_zone(rider.profile_id, db)
    is_new = _is_new_user(rider.profile_id, db)
    r = compute_r(rider.profile_id, db) if not is_new else 0.0
    coverage, premium, weekly_cap = compute_coverage_and_premium(city, zone, r, is_new)

    now = datetime.now(timezone.utc)
    policy = models.Policy(
        profile_id=rider.profile_id,
        premium_amount=premium,
        coverage_ratio=coverage,
        r_factor_at_purchase=r,
        purchased_at=now,
        activated_at=now + timedelta(seconds=DEMO_ACTIVATION_SECONDS),
        expires_at=now + timedelta(days=7),
        status="PENDING",
    )
    db.add(policy)
    rider.total_premium_paid = float(rider.total_premium_paid or 0) + premium
    if zone:
        db.add(models.RiderActivityLog(
            profile_id=rider.profile_id,
            activity_type="POLICY_PURCHASE",
            zone_id=zone.zone_id,
            recorded_at=now,
        ))
    db.commit()
    db.refresh(policy)

    return {
        "message": "Payment verified. Policy activating.",
        "policy_id": str(policy.policy_id),
        "status": policy.status,
        "premium_paid": premium,
        "coverage_pct": round(coverage * 100, 1),
        "weekly_cap": weekly_cap,
        "activates_in_seconds": DEMO_ACTIVATION_SECONDS,
        "activated_at": policy.activated_at.isoformat(),
        "expires_at": policy.expires_at.isoformat(),
    }
