from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from ..db.database import get_db
from ..db import models
from ..core.security import get_current_rider

router = APIRouter(prefix="/tracking", tags=["Tracking"])


@router.post("/activity")
async def log_activity(
    zone_id: int,
    current_rider: models.RiderProfile = Depends(get_current_rider),
    db: AsyncSession = Depends(get_db),
):
    """Log that the rider is currently active in a zone (used for payout eligibility)."""
    db.add(models.RiderActivityLog(
        profile_id=current_rider.profile_id,
        activity_type="DELIVERY_ATTEMPT",
        zone_id=zone_id,
    ))
    await db.commit()
    return {"logged": True}
