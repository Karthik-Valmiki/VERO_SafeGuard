import logging
import time
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func as sa_func
from ..db import models
from ..db.database import SessionLocal
from ..core.config import DEMO_PAYOUT_INTERVAL_SECONDS
from ..ml_engine import predict_fraud_detailed

logger = logging.getLogger(__name__)


def run_payouts_in_background(
    event_id,
    zone_id: int,
    trigger_time: str,
    trigger_end_time: str,
    interval_count: int,
):
    """
    Entry point for background payout processing.
    Creates a FRESH database session isolated from the HTTP request session.
    This avoids SQLAlchemy stale object errors after commits in background threads.
    """
    db = SessionLocal()
    try:
        process_payouts_for_event(
            db=db,
            event_id=event_id,
            zone_id=zone_id,
            trigger_time=trigger_time,
            trigger_end_time=trigger_end_time,
            interval_count=interval_count,
        )
    except Exception as e:
        logger.error(f"[PAYOUT BACKGROUND] Uncaught error: {e}", exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        try:
            db.close()
        except Exception:
            pass



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
    """
    logger.info(
        f"[PAYOUT] Starting event {event_id} | zone {zone_id} | "
        f"{interval_count} intervals × {DEMO_PAYOUT_INTERVAL_SECONDS}s"
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

        # Gather all profile_ids assigned to this zone, including the 8k generated riders.
        # The payout engine is zone-scoped — it doesn't care whether the rider is real
        # or mock_simulator; eligibility is gated downstream by fraud checks and shift overlap.
        zone_profile_ids = {
            link.profile_id
            for link in db.query(models.RiderZone)
            .filter(models.RiderZone.zone_id == zone_id)
            .all()
        }
        if not zone_profile_ids:
            # Zone exists but has zero riders — mark closed and bail.
            # This only occurs before the 8k mock generation has run.
            logger.warning(
                f"[PAYOUT] Zone {zone_id} has no registered riders. "
                f"Generate riders first via Admin → Generate 8k Riders."
            )
            event.is_active = False
            db.commit()
            return

        logger.info(f"[PAYOUT] Found {len(zone_profile_ids)} riders in zone {zone_id}")

        # Lazy policy promotion: PENDING policies whose activation window has lapsed
        # are promoted to ACTIVE here rather than on a scheduled job. Avoids an
        # additional background worker and keeps state transitions transactional.
        promoted = 0
        pending_policies = (
            db.query(models.Policy)
            .filter(
                models.Policy.profile_id.in_(zone_profile_ids),
                models.Policy.status == "PENDING",
                models.Policy.activated_at <= now,
            )
            .all()
        )
        for p in pending_policies:
            p.status = "ACTIVE"
            promoted += 1
        if promoted:
            db.commit()
            logger.info(f"[PAYOUT] Auto-promoted {promoted} PENDING → ACTIVE policies")

        # Load all coverage-bearing, non-expired policies for this zone batch.
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

        if not active_policies:
            logger.info("[PAYOUT] No active policies in zone — done.")
            event.is_active = False
            db.commit()
            return

        # Evaluate each policy independently. A single bad row must never abort
        # payouts for the rest of the zone — errors are caught per-rider below.
        rider_payouts: dict = {}

        for policy in active_policies:
            try:
                _evaluate_rider(
                    db=db,
                    policy=policy,
                    event=event,
                    zone_id=zone_id,
                    trigger_time=trigger_time,
                    trigger_end_time=trigger_end_time,
                    interval_count=interval_count,
                    now=now,
                    rider_payouts=rider_payouts,
                )
            except Exception as rider_err:
                logger.error(
                    f"[PAYOUT] Error evaluating policy {policy.policy_id}: {rider_err}",
                    exc_info=True,
                )
                # Do NOT let one rider crash the whole event — continue.
                db.rollback()
                continue

        if not rider_payouts:
            logger.info("[PAYOUT] No eligible riders after fraud/shift checks — done.")
            event.is_active = False
            db.commit()
            return

        # Distribute total payout across intervals with equal slices.
        # The last interval uses the exact remainder to avoid floating-point drift.
        logger.info(
            f"[PAYOUT] Queuing {len(rider_payouts)} riders for {interval_count} intervals"
        )
        for interval_num in range(1, interval_count + 1):
            time.sleep(DEMO_PAYOUT_INTERVAL_SECONDS)
            interval_now = datetime.now(timezone.utc)
            is_last = interval_num == interval_count

            for pid, data in rider_payouts.items():
                policy = data["policy"]
                rider = data["rider"]

                if is_last:
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
            logger.info(f"[PAYOUT] Interval {interval_num} committed.")

        # Seal the event. Any in-flight concurrent requests checking is_active will
        # see False and exit cleanly without writing duplicate payouts.
        event.is_active = False
        event.ended_at = datetime.now(timezone.utc)
        db.commit()

        for pid, data in rider_payouts.items():
            logger.info(
                f"[PAYOUT COMPLETE] Rider {data['rider'].profile_id} | "
                f"Total paid: ₹{data['paid_so_far']:.2f} | Event: {event_id}"
            )

        logger.info(f"[PAYOUT] Event {event_id} complete. All intervals fired.")

    except Exception as e:
        logger.error(f"[PAYOUT ERROR] {e}", exc_info=True)
        try:
            db.rollback()
        except Exception:
            pass


def _evaluate_rider(
    db: Session,
    policy: models.Policy,
    event: models.TriggerEvent,
    zone_id: int,
    trigger_time: str,
    trigger_end_time: str,
    interval_count: int,
    now: datetime,
    rider_payouts: dict,
):
    """
    Evaluates a single rider/policy for payout eligibility.
    Writes result into rider_payouts dict if eligible.
    Isolated so that a single bad rider never kills the entire event.
    """
    # Skip policies still in activation window
    if policy.activated_at:
        act = policy.activated_at
        if act.tzinfo is None:
            act = act.replace(tzinfo=timezone.utc)
        if act > now:
            logger.info(
                f"[SKIP] Policy {policy.policy_id} still in activation window "
                f"({int((act - now).total_seconds())}s left)."
            )
            return

    rider = (
        db.query(models.RiderProfile)
        .filter(models.RiderProfile.profile_id == policy.profile_id)
        .first()
    )
    if not rider:
        return

    # ── ML Fraud Detection ────────────────────────────────────────────────────
    recent_activities = (
        db.query(models.RiderActivityLog)
        .filter(models.RiderActivityLog.profile_id == rider.profile_id)
        .order_by(models.RiderActivityLog.recorded_at.desc())
        .limit(10)
        .all()
    )

    if not recent_activities:
        if rider.platform == "mock_simulator":
            # Mock riders don't emit real GPS telemetry. Supplying neutral fraud
            # features guarantees the Isolation Forest passes them — the demo
            # would otherwise show zero payouts, which breaks the live exhibit.
            zone_match_ratio = 1.0
            activity_recency_min = 5.0
            ping_burst_score = 0.0
            logger.info(f"[DEMO] Allowing mock rider {rider.profile_id} without logs.")
        else:
            logger.info(f"[SKIP/FRAUD] No activity logs for {policy.profile_id}")
            db.add(models.FraudCheckLog(
                profile_id=rider.profile_id,
                event_id=event.event_id,
                policy_id=policy.policy_id,
                result="BLOCK",
                anomaly_score=-1.0,
                features={"reason": "no_activity_logs"},
                reason="No delivery activity logs found",
            ))
            db.commit()
            return
    else:
        # Isolation Forest feature construction.
        # zone_match_ratio: fraction of the 10 most recent activity logs that fall within the trigger zone.
        zone_matches = sum(1 for a in recent_activities if a.zone_id == zone_id)
        zone_match_ratio = zone_matches / len(recent_activities)

        # Minutes since most recent recorded delivery ping. Values >60 are anomalous.
        last_log_time = recent_activities[0].recorded_at
        if last_log_time.tzinfo is None:
            last_log_time = last_log_time.replace(tzinfo=timezone.utc)
        activity_recency_min = (now - last_log_time).total_seconds() / 60.0

        # Ping burst: count of pings in the 5-minute window preceding the event.
        # Anomalously high values indicate a location-spoofing bot that floods
        # GPS logs just before a trigger fires to manufacture zone presence.
        burst_start_time = now - timedelta(minutes=5)
        ping_burst_score = float(sum(1 for a in recent_activities if (a.recorded_at.replace(tzinfo=timezone.utc) if a.recorded_at.tzinfo is None else a.recorded_at) >= burst_start_time))

    # Loss ratio guards against systematic over-claiming. A loss_ratio >1.8 is
    # outside the actuarial target band and triggers an Isolation Forest anomaly.
    total_payouts_received = float(rider.total_payouts_received or 0)
    total_premiums = float(rider.total_premium_paid or 0)
    loss_ratio = total_payouts_received / max(total_premiums, 1.0)

    # Policy age guards against "buy right before a disaster" fraud. Policies
    # purchased within the past 24 hours are flagged as anomalous.
    purchased_at = policy.purchased_at
    if purchased_at and purchased_at.tzinfo is None:
        purchased_at = purchased_at.replace(tzinfo=timezone.utc)
    policy_age_hours = (now - purchased_at).total_seconds() / 3600.0 if purchased_at else 48.0

    # Compare this rider's payout count against the zone baseline to surface
    # cherry-picking behaviour (exploiting events for a specific zone repeatedly).
    rider_payout_count = (
        db.query(sa_func.count(models.Payout.payout_id))
        .filter(
            models.Payout.policy_id == policy.policy_id,
            models.Payout.status == "SUCCESS",
        )
        .scalar() or 0
    )

    # Zone-average payout count: how many payouts do riders in this zone typically receive?
    # Compare this rider against zone peers to detect cherry-picking behaviour.
    zone_avg_payout_count = (
        db.query(sa_func.avg(
            db.query(sa_func.count(models.Payout.payout_id))
            .join(models.Policy, models.Payout.policy_id == models.Policy.policy_id)
            .join(models.RiderZone, models.Policy.profile_id == models.RiderZone.profile_id)
            .filter(
                models.RiderZone.zone_id == zone_id,
                models.Payout.status == "SUCCESS",
            )
            .correlate(None)
            .scalar_subquery()
        ))
    ).scalar() or None

    if zone_avg_payout_count and float(zone_avg_payout_count) > 0:
        claims_anomaly_ratio = round(rider_payout_count / float(zone_avg_payout_count), 3)
    elif rider_payout_count > 0:
        claims_anomaly_ratio = float(rider_payout_count)  # no zone baseline yet — use raw count as signal
    else:
        claims_anomaly_ratio = 1.0  # new rider, no claims — neutral

    logger.info(
        f"[ML CHECK] Rider {rider.profile_id} ({rider.platform}) | "
        f"zone_match={zone_match_ratio:.2f}, recency={activity_recency_min:.1f}min, "
        f"loss_ratio={loss_ratio:.2f}, policy_age={policy_age_hours:.1f}h, "
        f"claims_anomaly={claims_anomaly_ratio:.2f}, ping_burst={ping_burst_score:.1f}"
    )

    # Run ML fraud detection
    fraud_result = predict_fraud_detailed(
        zone_match_ratio=zone_match_ratio,
        activity_recency_min=activity_recency_min,
        loss_ratio=loss_ratio,
        policy_age_hours=policy_age_hours,
        claims_anomaly_ratio=claims_anomaly_ratio,
        ping_burst_score=ping_burst_score,
    )

    db.add(models.FraudCheckLog(
        profile_id=rider.profile_id,
        event_id=event.event_id,
        policy_id=policy.policy_id,
        result=fraud_result["result"],
        anomaly_score=fraud_result["anomaly_score"],
        features=fraud_result["features"],
        reason=f"ML prediction: {fraud_result['result']} (score: {fraud_result['anomaly_score']:.4f})",
    ))
    db.commit()

    # Isolation Forest returns -1 for anomalous riders. Block without accumulating
    # a payout record so the loss ratio stays clean in the admin analytics.
    if fraud_result["prediction"] == -1:
        logger.warning(
            f"[SKIP/FRAUD] ML blocked {rider.profile_id}. "
            f"Score: {fraud_result['anomaly_score']:.4f} | "
            f"zone_match={zone_match_ratio:.2f}, recency={activity_recency_min:.0f}min, "
            f"loss_ratio={loss_ratio:.2f}, policy_age={policy_age_hours:.1f}h"
        )
        return

    # ── Shift overlap check ───────────────────────────────────────────────────
    shift_start = rider.shift_hours.get("start", "00:00") if rider.shift_hours else "00:00"
    shift_end = rider.shift_hours.get("end", "23:59") if rider.shift_hours else "23:59"
    overlap = _overlap_hours(trigger_time, trigger_end_time, shift_start, shift_end)
    if overlap <= 0:
        logger.info(
            f"[SKIP/SHIFT] No shift overlap for {rider.profile_id}. "
            f"Disruption {trigger_time}–{trigger_end_time}, Shift {shift_start}–{shift_end}"
        )
        return

    # ── Compute base payout amount ────────────────────────────────────────────
    city = (
        db.query(models.CityBenchmark)
        .filter(models.CityBenchmark.city_id == rider.city_id)
        .first()
    )
    if not city or float(city.baseline_active_hours or 0) == 0:
        logger.warning(f"[SKIP] No city benchmark for rider {rider.profile_id}")
        return

    verified_hourly = float(city.baseline_weekly_income) / float(city.baseline_active_hours)
    coverage_ratio = float(policy.coverage_ratio)
    total_payout = round(overlap * verified_hourly * coverage_ratio, 2)

    # Weekly cap check
    weekly_cap = float(city.baseline_weekly_income) * coverage_ratio
    already_paid = (
        db.query(sa_func.coalesce(sa_func.sum(models.Payout.amount), 0.0))
        .filter(
            models.Payout.policy_id == policy.policy_id,
            models.Payout.status == "SUCCESS",
        )
        .scalar() or 0.0
    )
    cap_remaining = max(0.0, weekly_cap - float(already_paid))
    if cap_remaining <= 0:
        logger.info(f"[SKIP] Weekly cap exhausted for {rider.profile_id}")
        return

    total_payout = min(total_payout, cap_remaining)
    if total_payout <= 0:
        return

    # When multiple concurrent triggers cover the same zone, award the rider
    # the payout from whichever event gives the highest value — no double-dipping.
    # Tie-breaking uses event_id lexicographic order for deterministic stability.
    active_triggers = (
        db.query(models.TriggerEvent)
        .filter(
            models.TriggerEvent.zone_id == zone_id,
            models.TriggerEvent.is_active == True,
        )
        .all()
    )

    best_event_id = event.event_id
    best_payout = total_payout

    for other_ev in active_triggers:
        if other_ev.event_id == event.event_id:
            continue
        
        # Shadow calculation for the other event
        o_meta = other_ev.event_metadata or {}
        o_start = o_meta.get("trigger_time", "00:00")
        o_end = o_meta.get("trigger_end_time", "23:59")
        
        o_overlap = _overlap_hours(o_start, o_end, shift_start, shift_end)
        o_payout = round(o_overlap * verified_hourly * coverage_ratio, 2)
        
        if o_payout > best_payout:
            best_payout = o_payout
            best_event_id = other_ev.event_id
        elif o_payout == best_payout:
            # If tied, we default to the event with the lower ID (arbitrary stability)
            if str(other_ev.event_id) < str(best_event_id):
                best_event_id = other_ev.event_id

    if best_event_id != event.event_id:
        logger.info(
            f"[SUPPRESSED] Rider {rider.profile_id} skipped for event {event.event_id}. "
            f"Another active trigger ({best_event_id}) provides higher payout (₹{best_payout} vs ₹{total_payout})."
        )
        return

    # ── Final payout calculation ──────────────────────────────────────────────
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
        f"[PAYOUT ELIGIBLE] Rider {rider.profile_id} | overlap={overlap}h | "
        f"total=₹{total_payout} | {interval_count} intervals × ₹{per_interval}"
    )
