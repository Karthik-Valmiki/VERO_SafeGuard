"""
init_db.py — runs automatically on every backend startup.
Idempotent: skips anything already present.
Seeds:
  1. 10 city benchmarks
  2. Zones for Bengaluru, Chennai, Mumbai, Delhi, Hyderabad
  3. 5 returning demo riders (password: demo1234)
"""

import math
import bcrypt
from datetime import date, timedelta, datetime, timezone
from sqlalchemy.orm import Session
from . import models


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
ZONES = [
    ("Indiranagar", "Bengaluru", 1.15),
    ("T Nagar", "Chennai", 1.20),
    ("Adyar", "Chennai", 1.25),
    ("Bandra", "Mumbai", 1.25),
    ("Andheri", "Mumbai", 1.20),
    ("Connaught Place", "Delhi", 1.20),
    ("Lajpat Nagar", "Delhi", 1.15),
    ("Hyderabad Central", "Hyderabad", 1.05),
]

DEMO_PASSWORD = "vero1234"

DEMO_RIDERS = [
    {
        "name": "Arjun Mehta",
        "phone": "+919000000001",
        "platform": "Zomato",
        "city": "Mumbai",
        "zone": "Bandra",
        "upi": "arjun.mehta@upi",
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
        "zone": "Indiranagar",
        "upi": "priya.nair@upi",
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
        "zone": "Connaught Place",
        "upi": "ravi.kumar@upi",
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
        "zone": "T Nagar",
        "upi": "deepa.krishnan@upi",
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
        "zone": "Hyderabad Central",
        "upi": "suresh.babu@upi",
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
    _seed_cities(db)
    _seed_zones(db)
    _seed_demo_riders(db)


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
