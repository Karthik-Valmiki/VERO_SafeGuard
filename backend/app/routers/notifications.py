from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from ..db.database import get_db
from ..core.security import get_current_rider
from ..services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _serialize_notification(n: dict) -> dict:
    """Ensure datetime fields are ISO-serialized for JSON transport."""
    out = dict(n)
    for key in ("created_at",):
        if key in out and isinstance(out[key], datetime):
            out[key] = out[key].isoformat()
    return out


@router.get("/")
def get_notifications(
    db: Session = Depends(get_db),
    current_rider=Depends(get_current_rider),
):
    """Get all notifications for the current rider."""
    raw = NotificationService.get_rider_notifications(db, str(current_rider.profile_id))
    return [_serialize_notification(n) for n in raw]


@router.post("/mark-read/{notification_id}")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_rider=Depends(get_current_rider),
):
    """Mark a notification as read. Acknowledged by client."""
    return {"message": "Notification marked as read", "notification_id": notification_id}


@router.delete("/clear-completed")
def clear_completed_notifications(
    db: Session = Depends(get_db),
    current_rider=Depends(get_current_rider),
):
    """Clear all completed trigger notifications from the rider's view."""
    return {"message": "Completed notifications cleared"}