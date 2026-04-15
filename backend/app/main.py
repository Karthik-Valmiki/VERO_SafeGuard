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
