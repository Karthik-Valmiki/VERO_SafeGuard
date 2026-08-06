import os
from pydantic_settings import BaseSettings, SettingsConfigDict

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Demo mode: activation window compressed to 20 seconds instead of 24 hours
DEMO_ACTIVATION_SECONDS = 20
# Demo mode: each payout interval is 10 seconds (real = 30 minutes)
DEMO_PAYOUT_INTERVAL_SECONDS = 10
# Number of demo intervals per disruption hour (real = 2 per hour i.e. every 30min)
DEMO_SECONDS_PER_REAL_MINUTE = 1

# Razorpay — loaded from env only (never hardcoded)
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

# Admin API key — protects all /dashboards/admin/* endpoints

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    SECRET_KEY: str
    ADMIN_API_KEY: str
    DB_POOL_SIZE: int = 20
    DB_MAX_OVERFLOW: int = 10
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()