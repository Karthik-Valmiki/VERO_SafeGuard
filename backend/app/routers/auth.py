from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from jose import jwt
import bcrypt
import math
import random

from ..db import models
from ..db.database import get_db
from ..schemas.auth import OtpRequest, OtpVerify, RiderCreate, RiderLogin, TokenResponse
from ..core.config import (
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_HOURS,
    DEMO_ACTIVATION_SECONDS,
)

router = APIRouter(prefix="/auth", tags=["Auth"])

OTP_EXPIRY_SECONDS = 300  # 5 minutes


# ── helpers ──────────────────────────────────────────────────────────────────


def _hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _make_token(rider_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": rider_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


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
        return {
            "r": 0.0,
            "tu": 0.0,
            "de": 0.0,
            "cr": 0.0,
            "weeks_tracked": 0,
            "history": [],
        }

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


def compute_coverage_and_premium(city, zone, r: float, is_new: bool):
    """
    New user  : coverage = 40%,  premium = base_rate × risk_multi
    Returning : coverage = 40% + 25%×R  (max 65%)
                premium  = base_rate × risk_multi × (1.5 − R)
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
    else:
        coverage = round(min(0.40 + 0.25 * r, 0.65), 4)
        premium = round(base_rate * risk_multi * (1.5 - r), 2)

    weekly_cap = round(float(city.baseline_weekly_income) * coverage, 2)
    return coverage, premium, weekly_cap


def _get_zone(profile_id, db: Session):
    link = (
        db.query(models.RiderZone)
        .filter(
            models.RiderZone.profile_id == profile_id,
            models.RiderZone.is_primary == True,
        )
        .first()
    )
    if not link:
        return None
    return (
        db.query(models.GeoZone).filter(models.GeoZone.zone_id == link.zone_id).first()
    )


def _secs_until_active(policy) -> int:
    if not policy or policy.status != "PENDING" or not policy.activated_at:
        return 0
    act = policy.activated_at
    if act.tzinfo is None:
        act = act.replace(tzinfo=timezone.utc)
    return max(0, int((act - datetime.now(timezone.utc)).total_seconds()))


def _is_new_user(profile_id, db: Session) -> bool:
    return (
        db.query(models.RiderPerformanceHistory)
        .filter(models.RiderPerformanceHistory.profile_id == profile_id)
        .count()
    ) < 2


# ── OTP endpoints ─────────────────────────────────────────────────────────────


@router.post("/otp/send", status_code=200)
def send_otp(data: OtpRequest, db: Session = Depends(get_db)):
    """
    Simulated OTP — generates a 6-digit code and returns it directly
    (no real SMS). In production this would call Twilio/MSG91.
    """
    otp_code = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=OTP_EXPIRY_SECONDS)

    existing = (
        db.query(models.OtpStore)
        .filter(models.OtpStore.phone_number == data.phone_number)
        .first()
    )
    if existing:
        existing.otp_code = otp_code
        existing.expires_at = expires_at
        existing.is_used = False
    else:
        db.add(
            models.OtpStore(
                phone_number=data.phone_number,
                otp_code=otp_code,
                expires_at=expires_at,
                is_used=False,
            )
        )
    db.commit()

    return {
        "message": f"OTP sent to {data.phone_number} (demo — shown here)",
        "otp_code": otp_code,  # will remove in production code
        "expires_in_seconds": OTP_EXPIRY_SECONDS,
    }


@router.post("/otp/verify", status_code=200)
def verify_otp(data: OtpVerify, db: Session = Depends(get_db)):
    """Verify OTP before registration. Returns verified=True on success."""
    record = (
        db.query(models.OtpStore)
        .filter(models.OtpStore.phone_number == data.phone_number)
        .first()
    )

    now = datetime.now(timezone.utc)
    if not record or record.is_used:
        raise HTTPException(status_code=400, detail="OTP not found or already used")

    exp = record.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if now > exp:
        raise HTTPException(status_code=400, detail="OTP expired")

    if record.otp_code != data.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    record.is_used = True
    db.commit()
    return {"verified": True, "phone_number": data.phone_number}


# ── Registration ──────────────────────────────────────────────────────────────


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
def register(data: RiderCreate, db: Session = Depends(get_db)):
    """
    Register a new rider.
    - OTP must be verified before calling this.
    - Creates account + assigns zone based on city.
    - Does NOT create a policy — rider sees premium quote and pays separately.
    """
    # Validate OTP was verified
    otp_record = (
        db.query(models.OtpStore)
        .filter(models.OtpStore.phone_number == data.phone_number)
        .first()
    )
    if not otp_record or not otp_record.is_used:
        raise HTTPException(
            status_code=400,
            detail="Phone number not OTP-verified. Call /auth/otp/send and /auth/otp/verify first.",
        )

    if (
        db.query(models.RiderProfile)
        .filter(models.RiderProfile.phone_number == data.phone_number)
        .first()
    ):
        raise HTTPException(status_code=409, detail="Phone number already registered")

    city = (
        db.query(models.CityBenchmark)
        .filter(models.CityBenchmark.city_name == data.city)
        .first()
    )
    if not city:
        raise HTTPException(status_code=400, detail=f"City '{data.city}' not supported")

    # Assign zone — pick the median-risk zone for the city so new riders
    # get a representative premium, not the extreme high or low.
    city_zones = (
        db.query(models.GeoZone)
        .filter(models.GeoZone.city_id == city.city_id)
        .order_by(models.GeoZone.base_risk_multiplier)
        .all()
    )
    if not city_zones:
        zone = models.GeoZone(
            city_id=city.city_id,
            zone_name=f"{city.city_name} Central",
            base_risk_multiplier=city.default_risk_multiplier,
        )
        db.add(zone)
        db.flush()
    else:
        # Pick the middle zone by risk multiplier
        zone = city_zones[len(city_zones) // 2]

    rider = models.RiderProfile(
        full_name=data.name,
        phone_number=data.phone_number,
        hashed_password=_hash_password(data.password),
        platform=data.platform,
        city_id=city.city_id,
        shift_hours={"start": data.shift_start, "end": data.shift_end},
        upi_id=data.upi_id,
        reliability_score=0.00,
        is_verified=True,
    )
    db.add(rider)
    db.flush()

    db.add(
        models.RiderZone(
            profile_id=rider.profile_id, zone_id=zone.zone_id, is_primary=True
        )
    )
    db.commit()
    db.refresh(rider)

    # Compute premium quote (no policy created yet)
    coverage, premium, weekly_cap = compute_coverage_and_premium(
        city, zone, 0.0, is_new=True
    )

    return TokenResponse(
        access_token=_make_token(str(rider.profile_id)),
        token_type="bearer",
        profile_id=str(rider.profile_id),
        name=rider.full_name,
        city=city.city_name,
        zone_id=zone.zone_id,
        platform=rider.platform,
        reliability_score=0.0,
        coverage_pct=round(coverage * 100, 1),
        premium=premium,
        weekly_cap=weekly_cap,
        policy_id="",
        policy_status="NOT_PURCHASED",
        policy_activates_in_seconds=0,
        is_new_user=True,
    )


# ── Login ─────────────────────────────────────────────────────────────────────


@router.post("/login", response_model=TokenResponse)
def login(data: RiderLogin, db: Session = Depends(get_db)):
    rider = (
        db.query(models.RiderProfile)
        .filter(models.RiderProfile.phone_number == data.phone_number)
        .first()
    )
    if not rider or not _verify_password(data.password, rider.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid phone number or password")

    city = (
        db.query(models.CityBenchmark)
        .filter(models.CityBenchmark.city_id == rider.city_id)
        .first()
    )
    zone = _get_zone(rider.profile_id, db)

    is_new = _is_new_user(rider.profile_id, db)
    r = compute_r(rider.profile_id, db) if not is_new else 0.0
    coverage, premium, weekly_cap = compute_coverage_and_premium(city, zone, r, is_new)

    policy = (
        db.query(models.Policy)
        .filter(
            models.Policy.profile_id == rider.profile_id,
            models.Policy.status.in_(["ACTIVE", "PENDING"]),
        )
        .order_by(models.Policy.purchased_at.desc())
        .first()
    )

    return TokenResponse(
        access_token=_make_token(str(rider.profile_id)),
        token_type="bearer",
        profile_id=str(rider.profile_id),
        name=rider.full_name,
        city=city.city_name if city else "Unknown",
        zone_id=zone.zone_id if zone else 0,
        platform=rider.platform,
        reliability_score=r,
        coverage_pct=round(coverage * 100, 1),
        premium=float(policy.premium_amount) if policy else premium,
        weekly_cap=weekly_cap,
        policy_id=str(policy.policy_id) if policy else "",
        policy_status=policy.status if policy else "NOT_PURCHASED",
        policy_activates_in_seconds=_secs_until_active(policy),
        is_new_user=is_new,
    )
