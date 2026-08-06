from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import datetime, timedelta, timezone
from jose import jwt
import bcrypt
import math
import random
import asyncio

from ..db import models
from ..db.database import get_db
from ..schemas.auth import OtpRequest, OtpVerify, RiderCreate, RiderLogin, TokenResponse, UpiVerifyRequest, UpiVerifyResponse
from ..core.config import (
    settings,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_HOURS,
    DEMO_ACTIVATION_SECONDS,
)
from ..core.redis import cache_get, cache_set, cache_delete

router = APIRouter(prefix="/auth", tags=["Auth"])

OTP_EXPIRY_SECONDS = 300  # 5 minutes


# ── helpers ──────────────────────────────────────────────────────────────────


async def _hash_password(plain: str) -> str:
    return await asyncio.to_thread(
        lambda: bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    )


async def _verify_password(plain: str, hashed: str) -> bool:
    return await asyncio.to_thread(
        lambda: bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    )


def _make_token(rider_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": rider_id, "exp": expire}, settings.SECRET_KEY, algorithm=ALGORITHM)


from ..services.insurance_logic import compute_r, compute_coverage_and_premium


async def _get_zone(profile_id, db: AsyncSession):
    res = await db.execute(
        select(models.RiderZone)
        .filter(
            models.RiderZone.profile_id == profile_id,
            models.RiderZone.is_primary == True,
        )
    )
    link = res.scalars().first()
    if not link:
        return None
    res = await db.execute(select(models.GeoZone).filter(models.GeoZone.zone_id == link.zone_id))
    return res.scalars().first()


def _secs_until_active(policy) -> int:
    if not policy or policy.status != "PENDING" or not policy.activated_at:
        return 0
    act = policy.activated_at
    if act.tzinfo is None:
        act = act.replace(tzinfo=timezone.utc)
    return max(0, int((act - datetime.now(timezone.utc)).total_seconds()))


async def _is_new_user(profile_id, db: AsyncSession) -> bool:
    res = await db.execute(
        select(func.count(models.RiderPerformanceHistory.history_id))
        .filter(models.RiderPerformanceHistory.profile_id == profile_id)
    )
    return res.scalar() < 2


# ── Zones endpoint (public, for registration dropdown) ────────────────────────


@router.get("/zones")
async def get_zones_for_city(city: str, db: AsyncSession = Depends(get_db)):
    """Returns all zones for a given city name. Used in registration dropdown."""
    res = await db.execute(
        select(models.CityBenchmark).filter(
            models.CityBenchmark.city_name == city.strip().title()
        )
    )
    city_obj = res.scalars().first()
    if not city_obj:
        return {"zones": []}
    res = await db.execute(
        select(models.GeoZone)
        .filter(models.GeoZone.city_id == city_obj.city_id)
        .order_by(models.GeoZone.zone_name)
    )
    zones = res.scalars().all()
    return {
        "zones": [
            {
                "zone_id": z.zone_id,
                "zone_name": z.zone_name,
                "risk": float(z.base_risk_multiplier),
            }
            for z in zones
        ]
    }


# ── OTP endpoints ─────────────────────────────────────────────────────────────


@router.post("/otp/send", status_code=200)
async def send_otp(data: OtpRequest):
    """
    Simulated OTP — generates a 6-digit code and stores in Redis
    """
    otp_code = str(random.randint(100000, 999999))
    await cache_set(f"otp:{data.phone_number}", otp_code, OTP_EXPIRY_SECONDS)

    return {
        "message": f"OTP sent to {data.phone_number} (demo — shown here)",
        "otp_code": otp_code,
        "expires_in_seconds": OTP_EXPIRY_SECONDS,
    }


@router.post("/otp/verify", status_code=200)
async def verify_otp(data: OtpVerify):
    """Verify OTP before registration. Returns verified=True on success."""
    stored_otp = await cache_get(f"otp:{data.phone_number}")

    if not stored_otp:
        raise HTTPException(status_code=400, detail="OTP expired or not requested")

    if stored_otp != data.otp_code:
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # Mark as verified using a temp key that registration checks
    await cache_set(f"otp_verified:{data.phone_number}", "1", 3600) # Valid for 1 hour
    await cache_delete(f"otp:{data.phone_number}")
    
    return {"verified": True, "phone_number": data.phone_number}


# ── Registration ──────────────────────────────────────────────────────────────


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
async def register(data: RiderCreate, db: AsyncSession = Depends(get_db)):
    """
    Register a new rider.
    - OTP must be verified before calling this.
    - Creates account + assigns zone based on city.
    - Does NOT create a policy — rider sees premium quote and pays separately.
    """
    verified = await cache_get(f"otp_verified:{data.phone_number}")
    if not verified:
        raise HTTPException(
            status_code=400,
            detail="Phone number not OTP-verified. Call /auth/otp/send and /auth/otp/verify first.",
        )

    res = await db.execute(
        select(models.RiderProfile)
        .filter(models.RiderProfile.phone_number == data.phone_number)
    )
    if res.scalars().first():
        raise HTTPException(status_code=409, detail="Phone number already registered")

    res = await db.execute(
        select(models.CityBenchmark)
        .filter(models.CityBenchmark.city_name == data.city)
    )
    city = res.scalars().first()
    if not city:
        raise HTTPException(status_code=400, detail=f"City '{data.city}' not supported")

    if data.zone_id:
        res = await db.execute(
            select(models.GeoZone)
            .filter(
                models.GeoZone.zone_id == data.zone_id,
                models.GeoZone.city_id == city.city_id,
            )
        )
        zone = res.scalars().first()
        if not zone:
            raise HTTPException(
                status_code=400,
                detail=f"Zone {data.zone_id} does not belong to city '{data.city}'"
            )
    else:
        res = await db.execute(
            select(models.GeoZone)
            .filter(models.GeoZone.city_id == city.city_id)
            .order_by(models.GeoZone.base_risk_multiplier)
        )
        city_zones = res.scalars().all()
        if not city_zones:
            zone = models.GeoZone(
                city_id=city.city_id,
                zone_name=f"{city.city_name} Central",
                base_risk_multiplier=city.default_risk_multiplier,
            )
            db.add(zone)
            await db.flush()
        else:
            zone = city_zones[len(city_zones) // 2]

    hashed_pw = await _hash_password(data.password)
    rider = models.RiderProfile(
        full_name=data.name,
        phone_number=data.phone_number,
        hashed_password=hashed_pw,
        platform=data.platform,
        city_id=city.city_id,
        shift_hours={"start": data.shift_start, "end": data.shift_end},
        upi_id=data.upi_id,
        reliability_score=0.00,
        is_verified=True,
    )
    db.add(rider)
    await db.flush()

    db.add(
        models.RiderZone(
            profile_id=rider.profile_id, zone_id=zone.zone_id, is_primary=True
        )
    )

    db.add(
        models.RiderActivityLog(
            profile_id=rider.profile_id,
            activity_type="REGISTRATION_CHECKIN",
            zone_id=zone.zone_id,
        )
    )
    await db.commit()
    await db.refresh(rider)

    coverage, premium, weekly_cap = await compute_coverage_and_premium(
        city, zone, rider.profile_id, is_new=True, db=db
    )

    await cache_delete(f"otp_verified:{data.phone_number}")

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
async def login(data: RiderLogin, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(models.RiderProfile)
        .filter(models.RiderProfile.phone_number == data.phone_number)
    )
    rider = res.scalars().first()
    if not rider:
        raise HTTPException(status_code=401, detail="Invalid phone number or password")
        
    pw_match = await _verify_password(data.password, rider.hashed_password)
    if not pw_match:
        raise HTTPException(status_code=401, detail="Invalid phone number or password")

    res = await db.execute(
        select(models.CityBenchmark)
        .filter(models.CityBenchmark.city_id == rider.city_id)
    )
    city = res.scalars().first()
    zone = await _get_zone(rider.profile_id, db)

    is_new = await _is_new_user(rider.profile_id, db)
    r = await compute_r(rider.profile_id, db) if not is_new else 0.0
    coverage, premium, weekly_cap = await compute_coverage_and_premium(city, zone, rider.profile_id, is_new, db)

    res = await db.execute(
        select(models.Policy)
        .filter(
            models.Policy.profile_id == rider.profile_id,
            models.Policy.status.in_(["ACTIVE", "PENDING"]),
        )
        .order_by(models.Policy.purchased_at.desc())
    )
    policy = res.scalars().first()

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


# ── UPI KYC Penny-Drop  (DPDP 2023 §7 — test mode) ─────────────────────────

# Maps VPA handle suffix → simulated bank name (NPCI ecosystem)
_UPI_BANK_MAP: dict[str, str] = {
    "okaxis":      "Axis Bank",
    "oksbi":       "State Bank of India",
    "okicici":     "ICICI Bank",
    "ybl":         "Yes Bank (PhonePe)",
    "paytm":       "Paytm Payments Bank",
    "upi":         "BHIM UPI",
    "ibl":         "IndusInd Bank",
    "okhdfcbank":  "HDFC Bank",
    "okbizaxis":   "Axis Bank (Business)",
    "apl":         "Amazon Pay",
    "jupiteraxis": "Jupiter / Axis Bank",
    "airtel":      "Airtel Payments Bank",
    "pthdfc":      "Paytm / HDFC",
    "ptaxis":      "Paytm / Axis",
}


@router.post("/upi/verify", response_model=UpiVerifyResponse)
async def verify_upi_penny_drop(data: UpiVerifyRequest):
    """
    DPDP 2023 §7 UPI KYC compliance — simulated NPCI penny-drop.
    """
    vpa = data.upi_id
    username, handle = vpa.split("@", 1)

    display_name = username.replace(".", " ").replace("_", " ").replace("-", " ").title()

    bank = _UPI_BANK_MAP.get(handle, "HDFC Bank")
    now = datetime.now(timezone.utc)
    ref = f"TXN_NPCI_TEST_{now.strftime('%Y%m%d%H%M%S')}_{random.randint(100000, 999999)}"

    return UpiVerifyResponse(
        status="SUCCESS",
        upi_id=vpa,
        account_holder=display_name,
        bank=bank,
        deducted_inr=1.00,
        transaction_ref=ref,
        mode="TEST",
        note="Penny-drop verified in NPCI test environment. ₹1 debit is auto-refunded within 24 h.",
    )
