from pydantic import BaseModel, field_validator
from typing import Optional, Dict, Any


class TriggerCreate(BaseModel):
    zone_id: int
    metric_type: str            # WEATHER | AQI | PLATFORM_BLACKOUT | SOCIAL_DISRUPTION
    trigger_time: str           # HH:MM — disruption start (IST)
    trigger_end_time: str       # HH:MM — disruption end (IST)
    # Optional: override mock API data for demo flexibility
    platform: Optional[str] = "zomato"   # for PLATFORM_BLACKOUT
    event_metadata: Optional[Dict] = {}

    @field_validator("trigger_time", "trigger_end_time")
    @classmethod
    def validate_time_format(cls, v):
        parts = v.split(":")
        if len(parts) != 2 or not all(p.isdigit() for p in parts):
            raise ValueError("time must be HH:MM")
        h, m = int(parts[0]), int(parts[1])
        if not (0 <= h <= 23 and 0 <= m <= 59):
            raise ValueError("time out of range")
        return v


class TriggerResponse(BaseModel):
    event_id: str
    zone_id: int
    metric_type: str
    status: str
    riders_evaluated: int
    payouts_queued: int
    message: str
    threshold_check: str
    skipped_fraud: int
    overlap_hours: float
    interval_count: int
    estimated_payout_new: float
    estimated_payout_returning: float
    mock_api_data: Optional[Dict[str, Any]] = None   # live mock API response shown in UI
