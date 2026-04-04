from pydantic_settings import BaseSettings, SettingsConfigDict

SECRET_KEY = "VERO_SRMIST_2026_SECRET"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Demo mode: activation window compressed to 20 seconds instead of 24 hours
DEMO_ACTIVATION_SECONDS = 20
# Demo mode: each payout interval is 10 seconds (real = 30 minutes)
DEMO_PAYOUT_INTERVAL_SECONDS = 10
# Number of demo intervals per disruption hour (real = 2 per hour i.e. every 30min)
# In demo: 1 real-second = 1 real-minute, so 1 disruption-hour = 60 demo-seconds = 6 intervals of 10s
DEMO_SECONDS_PER_REAL_MINUTE = 1


class Settings(BaseSettings):
    DATABASE_URL: str
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()