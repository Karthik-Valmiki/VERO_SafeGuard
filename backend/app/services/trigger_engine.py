from datetime import datetime, timezone
import logging
from sqlalchemy.orm import Session
from fastapi import BackgroundTasks
from ..db import models
from ..schemas.trigger import TriggerCreate, TriggerResponse
from ..services import payout_engine, mock_api
from ..db.database import SessionLocal

logger = logging.getLogger(__name__)

PEAK_WINDOWS = [("12:00", "14:30"), ("19:00", "22:30")]


def _hhmm_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def _overlap_hours(d_start: str, d_end: str, s_start: str, s_end: str) -> float:
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


def _fetch_and_validate(data: TriggerCreate) -> tuple[bool, str, dict]:
    """
    Calls the appropriate mock API, validates threshold, returns
    (passed, summary_message, api_response_dict).
    """
    mt = data.metric_type
    metadata = data.event_metadata or {}
    threshold_value = metadata.get("thresholdValue", 0)

    if mt == "WEATHER":
        api_data = mock_api.fetch_weather(data.zone_id)

        # Check thresholds based on metadata flags
        if metadata.get("hail"):
            # Hailstorm - immediate trigger if confirmed
            met = threshold_value >= 1
            threshold_desc = (
                f"Hail {'confirmed' if met else 'not confirmed'} · threshold: confirmed"
            )
        elif metadata.get("heat"):
            # Extreme heat
            temp = threshold_value
            sustained = api_data.get("sustained_hours", 0)
            met = temp >= 40 and sustained >= 2
            threshold_desc = f"Temperature {temp}°C · sustained {sustained}h · threshold ≥40°C for 2h"
        else:
            # Heavy rain
            rainfall = threshold_value
            wind = api_data.get("wind_kmh", 0)
            sustained = api_data.get("sustained_hours", 0)
            met = rainfall >= 35 and sustained >= 1
            threshold_desc = f"Rainfall {rainfall}mm/hr · Wind {wind}km/hr · sustained {sustained}h · threshold ≥35mm/hr for 1h"

        summary = (
            f"OpenWeatherMap+Tomorrow.io | {api_data['zone']} | "
            f"{threshold_desc} | "
            f"{'✓ Threshold met' if met else '✗ Below threshold'}"
        )
        api_data["threshold_met"] = met
        api_data["user_input_value"] = threshold_value
        return met, summary, api_data

    elif mt == "AQI":
        api_data = mock_api.fetch_aqi(data.zone_id)
        # AQI
        aqi = threshold_value
        sustained = api_data.get("sustained_hours", 0)
        met = aqi > 300 and sustained >= 2

        summary = (
            f"IQAir/CPCB | {api_data['zone']} | "
            f"AQI {aqi} · sustained {sustained}h · threshold >300 for 2h | "
            f"{'✓ Threshold met' if met else '✗ Below threshold'}"
        )
        api_data["threshold_met"] = met
        api_data["user_input_value"] = threshold_value
        api_data["aqi"] = aqi
        return met, summary, api_data

    elif mt == "PLATFORM_BLACKOUT":
        platform = data.platform or "zomato"
        api_data = mock_api.fetch_platform_status(platform)

        # Peak hour check
        in_peak = any(s <= data.trigger_time <= e for s, e in PEAK_WINDOWS)
        if not in_peak:
            return (
                False,
                f"PLATFORM_BLACKOUT only triggers during peak hours (12:00–14:30 or 19:00–22:30). Got {data.trigger_time}.",
                api_data,
            )

        # Platform outage
        outage_min = threshold_value
        met = outage_min > 45

        summary = (
            f"DownDetector | {api_data['platform']} | "
            f"Outage {outage_min}min · threshold >45min during peak | "
            f"{'✓ Threshold met' if met else '✗ Below threshold'}"
        )
        api_data["threshold_met"] = met
        api_data["user_input_value"] = threshold_value
        api_data["outage_duration_min"] = outage_min
        return met, summary, api_data

    elif mt == "SOCIAL_DISRUPTION":
        api_data = mock_api.fetch_social_signals(data.zone_id)
        # Social disruption
        confidence = threshold_value
        closure = api_data.get("restaurant_closure_pct", 0)
        met = confidence > 75 and closure > 80

        source_types = " + ".join(s["type"] for s in api_data.get("sources", []))
        summary = (
            f"NewsAPI+Twitter/X | {api_data.get('zone', '')} | "
            f"Confidence {confidence}% · Restaurant closure {closure}% · threshold >75% confidence + >80% closure | "
            f"{'✓ Threshold met' if met else '✗ Below threshold'}"
        )
        api_data["threshold_met"] = met
        api_data["user_input_value"] = threshold_value
        api_data["confidence_pct"] = confidence
        return met, summary, api_data

    return False, f"Unknown metric_type: {mt}", {}


def _promote_pending_policies(db: Session, now: datetime):
    pending = db.query(models.Policy).filter(models.Policy.status == "PENDING").all()
    promoted = 0
    for p in pending:
        if p.activated_at:
            act = p.activated_at
            if act.tzinfo is None:
                act = act.replace(tzinfo=timezone.utc)
            if act <= now:
                p.status = "ACTIVE"
                promoted += 1
    if promoted:
        db.commit()


def activate_trigger(
    data: TriggerCreate, db: Session, background_tasks: BackgroundTasks
) -> TriggerResponse:
    zone = (
        db.query(models.GeoZone).filter(models.GeoZone.zone_id == data.zone_id).first()
    )
    if not zone:
        raise ValueError(f"Zone {data.zone_id} does not exist.")

    if data.trigger_end_time <= data.trigger_time:
        raise ValueError(
            f"trigger_end_time ({data.trigger_end_time}) must be after trigger_time ({data.trigger_time})."
        )

    passed, threshold_msg, api_data = _fetch_and_validate(data)
    if not passed:
        raise ValueError(f"Trigger rejected: {threshold_msg}")

    now = datetime.now(timezone.utc)
    _promote_pending_policies(db, now)

    metadata = dict(data.event_metadata or {})
    metadata.update(
        {
            "trigger_time": data.trigger_time,
            "trigger_end_time": data.trigger_end_time,
            "threshold_check": threshold_msg,
            "mock_api_response": api_data,
        }
    )

    event = models.TriggerEvent(
        zone_id=data.zone_id,
        metric_type=data.metric_type,
        event_metadata=metadata,
        started_at=now,
        is_active=True,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    zone_links = (
        db.query(models.RiderZone)
        .filter(models.RiderZone.zone_id == data.zone_id)
        .all()
    )
    zone_profile_ids = {link.profile_id for link in zone_links}

    active_policies = (
        db.query(models.Policy)
        .filter(
            models.Policy.profile_id.in_(zone_profile_ids),
            models.Policy.status == "ACTIVE",
            models.Policy.expires_at > now,
        )
        .all()
    )

    eligible, skipped_shift = 0, 0
    max_overlap = 0.0

    for policy in active_policies:
        rider = (
            db.query(models.RiderProfile)
            .filter(models.RiderProfile.profile_id == policy.profile_id)
            .first()
        )
        if not rider:
            continue
        shift_start = rider.shift_hours.get("start", "00:00")
        shift_end = rider.shift_hours.get("end", "23:59")
        overlap = _overlap_hours(
            data.trigger_time, data.trigger_end_time, shift_start, shift_end
        )
        if overlap > 0:
            eligible += 1
            max_overlap = max(max_overlap, overlap)
        else:
            skipped_shift += 1

    real_intervals = max(1, round(max_overlap * 2))
    interval_count = real_intervals

    city = (
        db.query(models.CityBenchmark)
        .filter(models.CityBenchmark.city_id == zone.city_id)
        .first()
    )
    est_new = est_ret = 0.0
    if city and float(city.baseline_active_hours) > 0:
        hourly = float(city.baseline_weekly_income) / float(city.baseline_active_hours)
        est_new = round(max_overlap * hourly * 0.40, 2)
        est_ret = round(max_overlap * hourly * 0.65, 2)

    logger.info(
        f"[TRIGGER] Event {event.event_id} | zone {data.zone_id} | "
        f"overlap={max_overlap}h | {interval_count} intervals | {eligible} eligible"
    )

    bg_db = SessionLocal()
    background_tasks.add_task(
        payout_engine.process_payouts_for_event,
        bg_db,
        event.event_id,
        zone.zone_id,
        data.trigger_time,
        data.trigger_end_time,
        interval_count,
    )

    return TriggerResponse(
        event_id=str(event.event_id),
        zone_id=data.zone_id,
        metric_type=data.metric_type,
        status="ACTIVATED",
        riders_evaluated=len(active_policies),
        payouts_queued=eligible,
        message=f"Disruption {data.trigger_time}–{data.trigger_end_time} | {eligible} rider(s) eligible | {interval_count} payout intervals.",
        threshold_check=threshold_msg,
        skipped_fraud=skipped_shift,
        overlap_hours=max_overlap,
        interval_count=interval_count,
        estimated_payout_new=est_new,
        estimated_payout_returning=est_ret,
        mock_api_data=api_data,
    )
