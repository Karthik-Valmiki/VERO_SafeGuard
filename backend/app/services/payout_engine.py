import logging
import time
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from ..db import models
from ..core.config import DEMO_PAYOUT_INTERVAL_SECONDS

logger = logging.getLogger(__name__)


def _hhmm_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _overlap_hours(d_start: str, d_end: str, s_start: str, s_end: str) -> float:
    """Overlap in hours between disruption window and rider shift."""
    ds = _hhmm_to_minutes(d_start)
    de = _hhmm_to_minutes(d_end)
    ss = _hhmm_to_minutes(s_start)
    se = _hhmm_to_minutes(s_end)
    if de <= ds:
        de = 23 * 60 + 59
    if se <= ss:
        se = 23 * 60 + 59
    overlap_min = max(0, min(de, se) - max(ds, ss))
    return round(overlap_min / 60.0, 4)


def process_payouts_for_event(
    db: Session,
    event_id,
    zone_id: int,
    trigger_time: str,
    trigger_end_time: str,
    interval_count: int,
):
    """
    Fires `interval_count` payout intervals, each DEMO_PAYOUT_INTERVAL_SECONDS apart.

    Logic per rider:
      total_payout = overlap_hours × verified_hourly × coverage_ratio
      per_interval = total_payout / interval_count   (equal slices)
      last_interval = total_payout - sum(previous intervals)  (exact remainder)

    By the last interval the rider has received exactly total_payout.
    Fraud check: must have activity log in zone within last 30 min of real time.
    """
    logger.info(
        f"[PAYOUT] Starting event {event_id} | {interval_count} intervals × {DEMO_PAYOUT_INTERVAL_SECONDS}s"
    )

    try:
        now = datetime.now(timezone.utc)

        event = (
            db.query(models.TriggerEvent)
            .filter(models.TriggerEvent.event_id == event_id)
            .first()
        )
        if not event or not event.is_active:
            logger.info("[PAYOUT] Event not active — aborting.")
            return

        zone_profile_ids = {
            link.profile_id
            for link in db.query(models.RiderZone)
            .filter(models.RiderZone.zone_id == zone_id)
            .all()
        }
        if not zone_profile_ids:
            return

        active_policies = (
            db.query(models.Policy)
            .filter(
                models.Policy.profile_id.in_(zone_profile_ids),
                models.Policy.status == "ACTIVE",
                models.Policy.expires_at > now,
            )
            .all()
        )

        logger.info(
            f"[PAYOUT] {len(active_policies)} active policies in zone {zone_id}"
        )

        rider_payouts: dict = {}

        for policy in active_policies:
            # Activation window check
            if policy.activated_at:
                act = policy.activated_at
                if act.tzinfo is None:
                    act = act.replace(tzinfo=timezone.utc)
                if act > now:
                    logger.info(
                        f"[SKIP] Policy {policy.policy_id} still in activation window."
                    )
                    continue

            rider = (
                db.query(models.RiderProfile)
                .filter(models.RiderProfile.profile_id == policy.profile_id)
                .first()
            )
            if not rider:
                continue

            # Fraud check: must have recent activity in this zone
            recent_activity = (
                db.query(models.RiderActivityLog)
                .filter(
                    models.RiderActivityLog.profile_id == rider.profile_id,
                    models.RiderActivityLog.zone_id == zone_id,
                    models.RiderActivityLog.recorded_at >= now - timedelta(minutes=30),
                )
                .first()
            )
            if not recent_activity:
                logger.info(
                    f"[SKIP/FRAUD] No recent activity for {policy.profile_id} in zone {zone_id}"
                )
                continue

            # Compute overlap between disruption and THIS rider's shift
            shift_start = rider.shift_hours.get("start", "00:00")
            shift_end = rider.shift_hours.get("end", "23:59")
            overlap = _overlap_hours(
                trigger_time, trigger_end_time, shift_start, shift_end
            )
            if overlap <= 0:
                logger.info(
                    f"[SKIP/SHIFT] No overlap for {policy.profile_id}. Disruption {trigger_time}–{trigger_end_time}, Shift {shift_start}–{shift_end}"
                )
                continue

            city = (
                db.query(models.CityBenchmark)
                .filter(models.CityBenchmark.city_id == rider.city_id)
                .first()
            )
            if not city or float(city.baseline_active_hours) == 0:
                continue

            verified_hourly = float(city.baseline_weekly_income) / float(
                city.baseline_active_hours
            )
            coverage_ratio = float(policy.coverage_ratio)

            # Total payout for the entire disruption overlap
            total_payout = round(overlap * verified_hourly * coverage_ratio, 2)

            # Weekly cap check — how much money is left..?
            weekly_cap = float(city.baseline_weekly_income) * coverage_ratio
            already_paid = sum(
                float(p.amount)
                for p in db.query(models.Payout)
                .filter(
                    models.Payout.policy_id == policy.policy_id,
                    models.Payout.status == "SUCCESS",
                )
                .all()
            )
            cap_remaining = max(0.0, weekly_cap - already_paid)
            if cap_remaining <= 0:
                logger.info(f"[SKIP] Weekly cap exhausted for {policy.profile_id}")
                continue

            # Clamp total to cap
            total_payout = min(total_payout, cap_remaining)
            if total_payout <= 0:
                continue

            per_interval = round(total_payout / interval_count, 2)

            rider_payouts[str(policy.policy_id)] = {
                "policy": policy,
                "rider": rider,
                "total_payout": total_payout,
                "per_interval": per_interval,
                "paid_so_far": 0.0,
                "overlap_hours": overlap,
            }
            logger.info(
                f"[PAYOUT] Rider {policy.profile_id} | overlap={overlap}h | "
                f"total=₹{total_payout} | {interval_count} intervals × ₹{per_interval}"
            )

        if not rider_payouts:
            logger.info("[PAYOUT] No eligible riders — done.")
            event.is_active = False
            db.commit()
            return

        # ── Fire intervals ────────────────────────────────────────────────────
        for interval_num in range(1, interval_count + 1):
            time.sleep(DEMO_PAYOUT_INTERVAL_SECONDS)
            interval_now = datetime.now(timezone.utc)
            is_last = interval_num == interval_count

            for pid, data in rider_payouts.items():
                policy = data["policy"]
                rider = data["rider"]

                if is_last:
                    # Last interval: pay exact remainder so total is precise
                    amount = round(data["total_payout"] - data["paid_so_far"], 2)
                else:
                    amount = data["per_interval"]

                if amount <= 0:
                    continue

                db.add(
                    models.Payout(
                        policy_id=policy.policy_id,
                        event_id=event.event_id,
                        amount=amount,
                        status="SUCCESS",
                        processed_at=interval_now,
                    )
                )
                rider.total_payouts_received = (
                    float(rider.total_payouts_received or 0) + amount
                )
                data["paid_so_far"] = round(data["paid_so_far"] + amount, 2)

                logger.info(
                    f"[PAYOUT] Interval {interval_num}/{interval_count} | "
                    f"₹{amount:.2f} → {rider.upi_id} | "
                    f"total so far ₹{data['paid_so_far']:.2f} / ₹{data['total_payout']:.2f}"
                )

            db.commit()

        # Mark event closed and notify completion
        event.is_active = False
        event.ended_at = datetime.now(timezone.utc)
        db.commit()

        # Log completion for each rider
        for pid, data in rider_payouts.items():
            logger.info(
                f"[PAYOUT COMPLETE] Rider {data['rider'].profile_id} | "
                f"Total paid: ₹{data['paid_so_far']:.2f} | "
                f"Event: {event_id}"
            )

        logger.info(f"[PAYOUT] Event {event_id} complete. All intervals fired.")

    except Exception as e:
        logger.error(f"[PAYOUT ERROR] {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()
