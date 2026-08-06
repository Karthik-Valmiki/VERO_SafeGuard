from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import logging

from .routers import auth, triggers, dashboards, policies, tracking, notifications
from .db.database import sync_engine, SessionLocal
from sqlalchemy.orm import Session
from sqlalchemy import text
from .db import models
from .db.init_db import run as seed_db
from .core.redis import redis_client, cache_set_json
from .ml_engine import initialize_models, get_model_metadata

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # STARTUP
    logger.info("Acquiring DB lock for migrations and seeding...")
    with sync_engine.connect() as conn:
        conn.execute(text("SELECT pg_advisory_lock(1337)"))
        try:
            logger.info("Running DB migrations...")
            models.Base.metadata.create_all(bind=conn)
            
            logger.info("Seeding DB...")
            db = Session(bind=conn)
            try:
                seed_db(db)
                # Pre-warm Redis static caches
                cities = db.query(models.CityBenchmark).all()
                zones_out = {}
                for city in cities:
                    zones = db.query(models.GeoZone).filter(models.GeoZone.city_id == city.city_id).all()
                    if zones:
                        zones_out[city.city_name] = [
                            {
                                "zone_id": z.zone_id,
                                "zone_name": z.zone_name,
                                "base_risk_multiplier": float(z.base_risk_multiplier),
                            }
                            for z in zones
                        ]
                await cache_set_json("ref:zones:all", zones_out, 3600)
            finally:
                db.close()
        finally:
            conn.execute(text("SELECT pg_advisory_unlock(1337)"))
            conn.commit()
        
    logger.info("Initializing ML models...")
    initialize_models()
    await cache_set_json("admin:ml:metadata", get_model_metadata(), 86400)
    
    yield
    
    # SHUTDOWN
    logger.info("Closing Redis connection pool...")
    await redis_client.aclose()


app = FastAPI(
    title="VERO — Parametric Income Protection",
    version="2.0",
    description="AI-powered parametric insurance for India's food delivery workers.",
    lifespan=lifespan,
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
async def health_check():
    return {"status": "operational", "engine": "VERO v2.0 Async"}

