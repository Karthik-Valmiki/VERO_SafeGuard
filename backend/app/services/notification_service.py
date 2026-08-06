"""
Notification service for VERO - handles trigger notifications and completion tracking.
Moves notification logic from frontend to backend for better architecture.
"""

import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from ..db import models
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

class NotificationService:
    """Manages trigger notifications and completion tracking."""

    @staticmethod
    async def create_trigger_notification(
        db: AsyncSession,
        profile_id: str,
        event_id: str,
        trigger_type: str,
        zone_name: str,
        estimated_payout: float,
        interval_count: int,
    ) -> Dict[str, Any]:
        """Create a notification when a trigger starts."""
        notification = {
            "notification_id": f"trigger_{event_id}",
            "profile_id": profile_id,
            "event_id": event_id,
            "type": "TRIGGER_STARTED",
            "title": f"{trigger_type} - Income Shield Active",
            "message": f"Disruption detected in {zone_name}. Automatic payouts started.",
            "metadata": {
                "trigger_type": trigger_type,
                "zone_name": zone_name,
                "estimated_payout": estimated_payout,
                "interval_count": interval_count,
                "status": "active",
            },
            "created_at": datetime.now(timezone.utc),
            "is_read": False,
        }
        logger.info(f"Trigger notification created for rider {profile_id}: {trigger_type}")
        return notification

    @staticmethod
    async def complete_trigger_notification(
        db: AsyncSession,
        profile_id: str,
        event_id: str,
        total_payout: float,
        intervals_completed: int,
    ) -> Dict[str, Any]:
        """Create a notification when a trigger completes."""
        notification = {
            "notification_id": f"complete_{event_id}",
            "profile_id": profile_id,
            "event_id": event_id,
            "type": "TRIGGER_COMPLETED",
            "title": "Payout Complete",
            "message": f"₹{total_payout:.2f} sent to your UPI. {intervals_completed} intervals processed.",
            "metadata": {
                "total_payout": total_payout,
                "intervals_completed": intervals_completed,
                "status": "completed",
            },
            "created_at": datetime.now(timezone.utc),
            "is_read": False,
        }
        logger.info(f"Completion notification created for rider {profile_id}: ₹{total_payout}")
        return notification

    @staticmethod
    async def get_rider_notifications(db: AsyncSession, profile_id: str) -> List[Dict[str, Any]]:
        """Get all notifications for a rider."""
        result = await db.execute(
            select(models.TriggerEvent)
            .join(models.RiderZone, models.TriggerEvent.zone_id == models.RiderZone.zone_id)
            .filter(
                models.RiderZone.profile_id == profile_id,
                models.TriggerEvent.is_active == True,
            )
        )
        active_events = result.scalars().all()

        result = await db.execute(
            select(models.Payout)
            .join(models.Policy, models.Payout.policy_id == models.Policy.policy_id)
            .filter(models.Policy.profile_id == profile_id)
            .order_by(models.Payout.processed_at.desc())
            .limit(10)
        )
        completed_payouts = result.scalars().all()

        notifications = []

        for event in active_events:
            res = await db.execute(select(models.GeoZone).filter(models.GeoZone.zone_id == event.zone_id))
            zone = res.scalars().first()
            notifications.append(
                {
                    "id": f"active_{event.event_id}",
                    "type": "active",
                    "title": f"{event.metric_type.replace('_', ' ').title()}",
                    "message": f"Active in {zone.zone_name if zone else 'Unknown Zone'}",
                    "created_at": event.started_at,
                    "metadata": {
                        "event_id": str(event.event_id),
                        "trigger_type": event.metric_type,
                        "zone_name": zone.zone_name if zone else "Unknown Zone",
                    },
                }
            )

        for payout in completed_payouts:
            res = await db.execute(select(models.TriggerEvent).filter(models.TriggerEvent.event_id == payout.event_id))
            event = res.scalars().first()

            if event:
                res = await db.execute(select(models.GeoZone).filter(models.GeoZone.zone_id == event.zone_id))
                zone = res.scalars().first()
                notifications.append(
                    {
                        "id": f"completed_{payout.payout_id}",
                        "type": "completed",
                        "title": f"{event.metric_type.replace('_', ' ').title()} - Complete",
                        "message": f"₹{float(payout.amount):.2f} sent to your UPI",
                        "created_at": payout.processed_at,
                        "metadata": {
                            "payout_amount": float(payout.amount),
                            "trigger_type": event.metric_type,
                            "zone_name": zone.zone_name if zone else "Unknown Zone",
                        },
                    }
                )

        notifications.sort(key=lambda x: x["created_at"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        return notifications

    @staticmethod
    async def mark_trigger_completed(db: AsyncSession, event_id: str):
        """Mark a trigger event as completed."""
        result = await db.execute(
            select(models.TriggerEvent).filter(models.TriggerEvent.event_id == event_id)
        )
        event = result.scalars().first()

        if event and event.is_active:
            event.is_active = False
            event.ended_at = datetime.now(timezone.utc)
            await db.commit()
            logger.info(f"Trigger event {event_id} marked as completed")
