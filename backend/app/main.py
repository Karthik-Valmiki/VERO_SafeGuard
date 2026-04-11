from fastapi import FastAPI
import asyncio
from datetime import datetime, timezone, timedelta
import random
import logging
from fastapi.middleware.cors import CORSMiddleware
from .routers import auth, triggers, dashboards, policies, tracking, notifications
from .db.database import engine, SessionLocal
from .db import models
from .db.init_db import run as seed_db
from sqlalchemy import text

models.Base.metadata.create_all(bind=engine)

# Drop legacy columns if they still exist (idempotent migration)
with engine.connect() as conn:
    conn.execute(text(
        "ALTER TABLE trigger_events DROP COLUMN IF EXISTS intensity_level;"
    ))
    conn.commit()

# Seed cities, zones, demo riders, and scale data on every startup (idempotent)
_db = SessionLocal()
try:
    seed_db(_db)
finally:
    _db.close()

# Initialize ML Models in memory
from .ml_engine import initialize_models
initialize_models()

app = FastAPI(
    title="VERO — Parametric Income Protection",
    version="2.0",
    description="AI-powered parametric insurance for India's food delivery workers.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # local dev rider app
        "http://localhost:3000",  # local dev alt
        "http://localhost:3001",  # local dev admin panel
        "http://localhost:80",    # docker rider app
        "http://localhost",       # docker (port 80 default)
        "http://localhost:8080",  # docker admin panel
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(policies.router)
app.include_router(triggers.router)
app.include_router(dashboards.router)
app.include_router(tracking.router)
app.include_router(notifications.router)


@app.get("/", tags=["Health"])
def health_check():
    return {"status": "operational", "engine": "VERO v2.0"}

async def telemetry_refresh_loop():
    """Generates continuous authentic tracking signals globally every 15 minutes."""
    while True:
        await asyncio.sleep(900)  # 15 minutes
        try:
            db_session = SessionLocal()
            now = datetime.now(timezone.utc)
            
            # Clean old logs to prevent unbounded bloat
            db_session.query(models.RiderActivityLog).filter(models.RiderActivityLog.activity_type == "delivery").delete()
            
            shadows = db_session.query(models.RiderProfile).filter(models.RiderProfile.full_name.like("Shadow Rider%")).all()
            if shadows:
                zones = [z.zone_id for z in db_session.query(models.GeoZone.zone_id).all()]
                new_logs = []
                for s in shadows:
                    primary_zone = db_session.query(models.RiderZone).filter_by(profile_id=s.profile_id, is_primary=True).first()
                    z_id = primary_zone.zone_id if primary_zone else (random.choice(zones) if zones else 1)
                    
                    # 90% get totally valid fresh pings
                    if random.random() < 0.90:
                        for _ in range(random.randint(1, 4)):
                            new_logs.append(models.RiderActivityLog(
                                profile_id=s.profile_id, activity_type="delivery", zone_id=z_id,
                                recorded_at=now - timedelta(minutes=random.randint(2, 45))
                            ))
                    else:
                        # 10% get explicitly stale/fraudulent tracking data
                        new_logs.append(models.RiderActivityLog(
                            profile_id=s.profile_id, activity_type="delivery", zone_id=z_id,
                            recorded_at=now - timedelta(minutes=random.randint(120, 300))
                        ))
                
                db_session.add_all(new_logs)
                db_session.commit()
            db_session.close()
            logging.info("Vero Engine: 15-Minute Telemetry Cycle Auto-Refreshed globally.")
        except Exception as e:
            logging.error(f"Telemetry loop error: {e}")

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(telemetry_refresh_loop())