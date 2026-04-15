"""
init_db.py — runs automatically on every backend startup.
Idempotent: skips anything already present.
Seeds:
  1. 10 city benchmarks
  2. Zones for Bengaluru, Chennai, Mumbai, Delhi, Hyderabad
  3. 5 returning demo riders (password: demo1234)
"""

import math
import random
import bcrypt
from datetime import date, timedelta, datetime, timezone
from sqlalchemy import text
from sqlalchemy.orm import Session
from . import models
from app.ml_engine import predict_rider_metrics

def _hash(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def _r(tu, de, cr) -> float:
    return round(min(math.sqrt(tu * de * cr), 1.0), 2)


def _week(offset: int) -> date:
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    return monday - timedelta(weeks=offset)


CITIES = [
    ("Bengaluru", 5600.00, 50.00, 1.15),
    ("Chennai", 5200.00, 48.00, 1.20),
    ("Mumbai", 5800.00, 52.00, 1.25),
    ("Delhi", 5700.00, 50.00, 1.20),
    ("Gurgaon", 5500.00, 48.00, 1.10),
    ("Hyderabad", 5400.00, 48.00, 1.05),
    ("Vizag", 4200.00, 45.00, 1.05),
    ("Pune", 5100.00, 48.00, 1.10),
    ("Kolkata", 4600.00, 48.00, 1.15),
    ("Ahmedabad", 4800.00, 46.00, 1.05),
]

# zone_name, city_name, risk_multiplier
# Multiple zones per city so zone-level premium differentiation is visible.
# Higher multiplier = more disruption-prone = higher premium for riders there.
ZONES = [
    # Bengaluru — 3 zones with distinct risk profiles
    ("Indiranagar",      "Bengaluru", 1.20),
    ("Koramangala",      "Bengaluru", 1.15),
    ("Whitefield",       "Bengaluru", 1.05),
    # Chennai — 4 zones
    ("T Nagar",          "Chennai",   1.20),
    ("Adyar",            "Chennai",   1.25),
    ("Velachery",        "Chennai",   1.15),
    ("Anna Nagar",       "Chennai",   1.10),
    # Mumbai — 4 zones
    ("Bandra",           "Mumbai",    1.30),
    ("Andheri",          "Mumbai",    1.20),
    ("Dadar",            "Mumbai",    1.15),
    ("Borivali",         "Mumbai",    1.05),
    # Delhi — 4 zones
    ("Connaught Place",  "Delhi",     1.25),
    ("Lajpat Nagar",     "Delhi",     1.20),
    ("Rohini",           "Delhi",     1.10),
    ("Dwarka",           "Delhi",     1.05),
    # Hyderabad — 3 zones
    ("Hyderabad Central","Hyderabad", 1.10),
    ("Banjara Hills",    "Hyderabad", 1.15),
    ("Secunderabad",     "Hyderabad", 1.05),
    # Pune — 2 zones
    ("Koregaon Park",    "Pune",      1.15),
    ("Kothrud",          "Pune",      1.05),
    # Kolkata — 2 zones
    ("Park Street",      "Kolkata",   1.20),
    ("Salt Lake",        "Kolkata",   1.10),
    # Gurgaon — 2 zones
    ("Cyber City",       "Gurgaon",   1.25),
    ("Udyog Vihar",      "Gurgaon",   1.15),
    # Vizag — 2 zones
    ("MVP Colony",       "Vizag",     1.15),
    ("Gajuwaka",         "Vizag",     1.05),
    # Ahmedabad — 2 zones
    ("Navrangpura",      "Ahmedabad", 1.15),
    ("Satellite",        "Ahmedabad", 1.05),
]

DEMO_PASSWORD = "vero1234"

DEMO_RIDERS = [
    {
        "name": "Arjun Mehta",
        "phone": "+919000000001",
        "platform": "Zomato",
        "city": "Mumbai",
        "zone": "Bandra",          # highest risk zone in Mumbai — 1.30×
        "upi": "arjun.mehta@okaxis",
        "shift": {"start": "08:00", "end": "22:00"},
        "history": [
            {"offset": 1, "tu": 0.95, "de": 0.93, "cr": 0.96},
            {"offset": 2, "tu": 0.92, "de": 0.90, "cr": 0.94},
            {"offset": 3, "tu": 0.90, "de": 0.88, "cr": 0.93},
            {"offset": 4, "tu": 0.88, "de": 0.87, "cr": 0.91},
        ],
    },
    {
        "name": "Priya Nair",
        "phone": "+919000000002",
        "platform": "Swiggy",
        "city": "Bengaluru",
        "zone": "Indiranagar",      # highest risk zone in Bengaluru — 1.20×
        "upi": "priya.nair@oksbi",
        "shift": {"start": "10:00", "end": "20:00"},
        "history": [
            {"offset": 1, "tu": 0.60, "de": 0.55, "cr": 0.58},
            {"offset": 2, "tu": 0.58, "de": 0.52, "cr": 0.60},
            {"offset": 3, "tu": 0.55, "de": 0.50, "cr": 0.57},
            {"offset": 4, "tu": 0.52, "de": 0.48, "cr": 0.55},
        ],
    },
    {
        "name": "Ravi Kumar",
        "phone": "+919000000003",
        "platform": "Zomato",
        "city": "Delhi",
        "zone": "Connaught Place",  # highest risk zone in Delhi — 1.25×
        "upi": "ravi.kumar@okicici",
        "shift": {"start": "07:00", "end": "23:00"},
        "history": [
            {"offset": 1, "tu": 0.35, "de": 0.30, "cr": 0.72},
            {"offset": 2, "tu": 0.32, "de": 0.28, "cr": 0.70},
            {"offset": 3, "tu": 0.30, "de": 0.25, "cr": 0.68},
            {"offset": 4, "tu": 0.28, "de": 0.22, "cr": 0.65},
        ],
    },
    {
        "name": "Deepa Krishnan",
        "phone": "+919000000004",
        "platform": "Swiggy",
        "city": "Chennai",
        "zone": "Anna Nagar",       # lower risk zone in Chennai — 1.10×
        "upi": "deepa.krishnan@ybl",
        "shift": {"start": "11:00", "end": "23:00"},
        "history": [
            {"offset": 1, "tu": 0.78, "de": 0.74, "cr": 0.80},
            {"offset": 2, "tu": 0.74, "de": 0.70, "cr": 0.78},
            {"offset": 3, "tu": 0.70, "de": 0.65, "cr": 0.75},
            {"offset": 4, "tu": 0.65, "de": 0.60, "cr": 0.72},
        ],
    },
    {
        "name": "Suresh Babu",
        "phone": "+919000000005",
        "platform": "Zomato",
        "city": "Hyderabad",
        "zone": "Banjara Hills",    # mid risk zone in Hyderabad — 1.15×
        "upi": "suresh.babu@paytm",
        "shift": {"start": "09:00", "end": "21:00"},
        "history": [
            {"offset": 1, "tu": 0.50, "de": 0.45, "cr": 0.62},
            {"offset": 2, "tu": 0.44, "de": 0.40, "cr": 0.58},
            {"offset": 3, "tu": 0.38, "de": 0.35, "cr": 0.55},
            {"offset": 4, "tu": 0.30, "de": 0.28, "cr": 0.50},
        ],
    },
]


def run(db: Session) -> None:
    _run_migrations(db)
    _seed_cities(db)
    _seed_zones(db)
    _seed_demo_riders(db)


def _run_migrations(db: Session) -> None:
    """
    Zero-downtime additive schema migrations.
    Uses PostgreSQL 'ADD COLUMN IF NOT EXISTS' — safe to run on every startup.
    Skips silently if columns already exist.
    """
    try:
        db.execute(text(
            "ALTER TABLE rider_profiles "
            "ADD COLUMN IF NOT EXISTS consent_records JSONB"
        ))
        db.commit()
    except Exception:
        db.rollback()


def _seed_cities(db: Session) -> None:
    if db.query(models.CityBenchmark).first():
        return  # already seeded
    db.add_all(
        [
            models.CityBenchmark(
                city_name=name,
                baseline_weekly_income=income,
                baseline_active_hours=hours,
                default_risk_multiplier=risk,
            )
            for name, income, hours, risk in CITIES
        ]
    )
    db.commit()


def _seed_zones(db: Session) -> None:
    for zone_name, city_name, risk in ZONES:
        city = db.query(models.CityBenchmark).filter_by(city_name=city_name).first()
        if not city:
            continue
        exists = (
            db.query(models.GeoZone)
            .filter_by(city_id=city.city_id, zone_name=zone_name)
            .first()
        )
        if not exists:
            db.add(
                models.GeoZone(
                    city_id=city.city_id,
                    zone_name=zone_name,
                    base_risk_multiplier=risk,
                )
            )
    db.commit()


def _seed_demo_riders(db: Session) -> None:
    for rd in DEMO_RIDERS:
        if db.query(models.RiderProfile).filter_by(phone_number=rd["phone"]).first():
            continue  # already exists

        city = db.query(models.CityBenchmark).filter_by(city_name=rd["city"]).first()
        if not city:
            continue

        zone = (
            db.query(models.GeoZone)
            .filter_by(city_id=city.city_id, zone_name=rd["zone"])
            .first()
        )
        if not zone:
            zone = db.query(models.GeoZone).filter_by(city_id=city.city_id).first()

        now = datetime.now(timezone.utc)
        latest = rd["history"][0]
        r_val = _r(latest["tu"], latest["de"], latest["cr"])
        rider = models.RiderProfile(
            full_name=rd["name"],
            phone_number=rd["phone"],
            hashed_password=_hash(DEMO_PASSWORD),
            platform=rd["platform"],
            city_id=city.city_id,
            shift_hours=rd["shift"],
            upi_id=rd["upi"],
            reliability_score=r_val,
            is_verified=True,
            # DPDP 2023 — demo riders are pre-seeded as fully consented
            consent_records={
                "gps_zone":    True,
                "gps_claims":  True,
                "gps_oracle":  True,
                "dsa_data":    True,
                "dsa_read":    True,
                "upi_kyc":     True,
                "upi_consent": True,
                "consented_at": now.isoformat(),
                "mode":        "SEEDED",
            },
        )
        db.add(rider)
        db.flush()

        db.add(
            models.RiderZone(
                profile_id=rider.profile_id,
                zone_id=zone.zone_id,
                is_primary=True,
            )
        )

        # Mark OTP used so login works without OTP flow
        db.add(
            models.OtpStore(
                phone_number=rd["phone"],
                otp_code="000000",
                expires_at=datetime.now(timezone.utc),
                is_used=True,
            )
        )

        for w in rd["history"]:
            tu, de, cr = w["tu"], w["de"], w["cr"]
            db.add(
                models.RiderPerformanceHistory(
                    profile_id=rider.profile_id,
                    week_start_date=_week(w["offset"]),
                    time_utilization=tu,
                    delivery_efficiency=de,
                    completion_rate=cr,
                    final_r_score=_r(tu, de, cr),
                )
            )

        db.commit()


def _seed_mass_scale(db: Session, target_users: int = 8000) -> None:
    """
    Generates thousands of shadow riders across all zones for admin map clustering.
    Idempotent — skips if riders already exist beyond the 5 demo riders.
    """
    import uuid
    import logging
    logger = logging.getLogger(__name__)

    total_existing = db.query(models.RiderProfile).count()
    if total_existing > 100:
        logger.info(f"Mass scale already present ({total_existing} riders). Skipping.")
        return

    logger.info(f"Generating {target_users} shadow riders for admin map...")
    zones = db.query(models.GeoZone).all()
    if not zones:
        return

    mock_hash = _hash("mock")
    platforms = ["Swiggy", "Zomato", "Zepto", "Blinkit"]
    now = datetime.now(timezone.utc)

    new_riders = []
    new_zones = []
    new_policies = []
    new_activity = []

    for i in range(target_users):
        zone = random.choice(zones)
        tu = random.uniform(0.4, 0.98)
        de = random.uniform(0.4, 0.98)
        cr = random.uniform(0.5, 0.99)
        r_score = min(((tu * de * cr) ** 0.5), 1.0)

        pr_id = str(uuid.uuid4())

        rider = models.RiderProfile(
            profile_id=pr_id,
            full_name=f"Shadow Rider {i}",
            phone_number=f"+9180{str(i).zfill(8)}",
            hashed_password=mock_hash,
            platform="mock_simulator",
            city_id=zone.city_id,
            shift_hours={"start": "12:00", "end": "02:00"},
            upi_id=f"shadow{i}@axis",
            reliability_score=round(r_score, 2),
            is_verified=True,
            total_payouts_received=0.0,
            total_premium_paid=0.0,
            created_at=now,
        )
        new_riders.append(rider)

        rz = models.RiderZone(
            profile_id=pr_id, zone_id=zone.zone_id, is_primary=True
        )
        new_zones.append(rz)

        # Use ML Model to deduce Metrics & True Premium (as requested)
        zone_risk_index = float(zone.base_risk_multiplier)
        pred_tu, pred_de, pred_cr = predict_rider_metrics(
            shift_preference=random.randint(0,2),
            zone_risk_index=zone_risk_index,
            avg_daily_hours=random.uniform(4.0, 14.0),
            experience_months=random.randint(1, 48),
            weather_severity=0.5
        )
        r_score = min(((pred_tu * pred_de * pred_cr) ** 0.5), 1.0)
        
        city_benchmark = db.query(models.CityBenchmark).filter_by(city_id=zone.city_id).first()
        base_rate = float(city_benchmark.baseline_weekly_income) * 0.02 if city_benchmark else 160.0
        ml_premium = round(base_rate * zone_risk_index * (1.5 - r_score), 2)
        ml_coverage = round(0.40 + 0.25 * r_score, 2)

        pol = models.Policy(
            profile_id=pr_id,
            premium_amount=ml_premium,
            coverage_ratio=ml_coverage,
            r_factor_at_purchase=r_score,
            status="ACTIVE",
            purchased_at=now - timedelta(hours=random.randint(24, 72)),
            activated_at=now - timedelta(hours=random.randint(1, 24)),
            expires_at=now + timedelta(days=7),
            is_surcharge_applied=False,
        )
        new_policies.append(pol)

        # Generate starting baseline telemetry so fraud detection works
        is_bot = random.random() < 0.05
        
        if is_bot:
            # Bot behavior (Fraud): Spams 15-25 pings in the last 4 minutes, 
            # terrible loss ratio, often wrong zone
            rider.total_payouts_received = round(random.uniform(5.0, 10.0) * pol.premium_amount, 2)
            rider.total_premium_paid = round(pol.premium_amount, 2)
            
            for j in range(random.randint(15, 25)):
                new_activity.append(models.RiderActivityLog(
                    profile_id=pr_id,
                    activity_type="delivery",
                    zone_id=random.choice(zones).zone_id,
                    recorded_at=now - timedelta(minutes=random.uniform(0, 4)),
                ))
        else:
            # Normal behavior: 2-5 pings spread out over 2 hours in correct zone
            rider.total_payouts_received = round(random.uniform(0.0, 1.2) * pol.premium_amount, 2)
            rider.total_premium_paid = round(pol.premium_amount, 2)
            
            for j in range(random.randint(2, 5)):
                new_activity.append(models.RiderActivityLog(
                    profile_id=pr_id,
                    activity_type="delivery",
                    zone_id=zone.zone_id,
                    recorded_at=now - timedelta(minutes=random.randint(5, 120)),
                ))

    logger.info("Bulk inserting riders...")
    db.add_all(new_riders)
    db.commit()

    logger.info("Bulk inserting zone mappings...")
    db.add_all(new_zones)
    db.commit()

    logger.info("Bulk inserting policies...")
    db.add_all(new_policies)
    db.commit()

    logger.info("Bulk inserting activity logs...")
    db.add_all(new_activity)
    db.commit()

    logger.info(f"Mass Scale Complete: {len(new_riders)} riders, {len(new_policies)} policies, {len(new_activity)} activity logs.")

