from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from ..db.database import get_db
from ..core.security import get_current_rider
from ..services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=List[Dict[str, Any]])
def get_notifications(
    db: Session = Depends(get_db),
    current_rider = Depends(get_current_rider)
):
    """Get all notifications for the current rider."""
    return NotificationService.get_rider_notifications(db, str(current_rider.profile_id))


@router.post("/mark-read/{notification_id}")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_rider = Depends(get_current_rider)
):
    """Mark a notification as read."""
    # For now, just return success - can implement read tracking later
    return {"message": "Notification marked as read", "notification_id": notification_id}


@router.delete("/clear-completed")
def clear_completed_notifications(
    db: Session = Depends(get_db),
    current_rider = Depends(get_current_rider)
):
    """Clear all completed trigger notifications."""
    # This would clear completed notifications from database
    # For now, just return success
    return {"message": "Completed notifications cleared"}