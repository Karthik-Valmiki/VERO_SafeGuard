from datetime import datetime, timezone, timedelta
import logging
import time
import random
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import BackgroundTasks
from ..db import models
from ..schemas.trigger import TriggerCreate, TriggerResponse
from ..services import payout_engine, mock_api

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


async def _fetch_and_validate(data: TriggerCreate) -> tuple[bool, str, dict]:
    mt = data.metric_type
    metadata = data.event_metadata or {}
    threshold_value = metadata.get("thresholdValue", 0)

    if mt == "WEATHER":
        api_data = await mock_api.fetch_weather(data.zone_id)
        if metadata.get("hail"):
            met = threshold_value >= 1
            threshold_desc = f"Hail {'confirmed' if met else 'not confirmed'} · threshold: confirmed"
        elif metadata.get("heat"):
            temp = threshold_value
            sustained = api_data.get("sustained_hours", 0)
            met = temp >= 40 and sustained >= 2
            threshold_desc = f"Temperature {temp}°C · sustained {sustained}h · threshold ≥40°C for 2h"
        else:
            rainfall = threshold_value
            wind = api_data.get("wind_kmh", 0)
            sustained = api_data.get("sustained_hours", 0)
            met = rainfall >= 35 and sustained >= 1
            threshold_desc = f"Rainfall {rainfall}mm/hr · Wind {wind}km/hr · sustained {sustained}h · threshold ≥35mm/hr for 1h"

        summary = (
            f"Open-Meteo (LIVE) | {api_data['zone']} | "
            f"{threshold_desc} | "
            f"{'✓ Threshold met' if met else '✗ Below threshold'}"
        )
        api_data["threshold_met"] = met
        api_data["user_input_value"] = threshold_value
        return met, summary, api_data

    elif mt == "AQI":
        api_data = await mock_api.fetch_aqi(data.zone_id)
        aqi = threshold_value
        sustained = api_data.get("sustained_hours", 0)
        met = aqi > 300 and sustained >= 2

        summary = (
            f"Open-Meteo Air Quality (LIVE) | {api_data['zone']} | "
            f"AQI {aqi} · sustained {sustained}h · threshold >300 for 2h | "
            f"{'✓ Threshold met' if met else '✗ Below threshold'}"
        )
        api_data["threshold_met"] = met
        api_data["user_input_value"] = threshold_value
        api_data["aqi"] = aqi
        return met, summary, api_data

    elif mt == "PLATFORM_BLACKOUT":
        platform = data.platform or "zomato"
        api_data = await mock_api.fetch_platform_status(platform)
        trigger_mins = _hhmm_to_minutes(data.trigger_time)
        in_peak = any(
            _hhmm_to_minutes(s) <= trigger_mins <= _hhmm_to_minutes(e)
            for s, e in PEAK_WINDOWS
        )
        if not in_peak:
            return (
                False,
                f"PLATFORM_BLACKOUT only triggers during peak hours (12:00–14:30 or 19:00–22:30). Got {data.trigger_time}.",
                api_data,
            )
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
        api_data = await mock_api.fetch_social_signals(data.zone_id)
        confidence = threshold_value
        closure = api_data.get("restaurant_closure_pct", 0)
        met = confidence > 75 and closure > 80

        source_types = " + ".join(s["type"] for s in api_data.get("sources", []))
        summary = (
            f"GDELT Project (LIVE) | {api_data.get('zone', '')} | "
            f"Confidence {confidence}% · Restaurant closure {closure}% · threshold >75% confidence + >80% closure | "
            f"{'✓ Threshold met' if met else '✗ Below threshold'}"
        )
        api_data["threshold_met"] = met
        api_data["user_input_value"] = threshold_value
        api_data["confidence_pct"] = confidence
        return met, summary, api_data

    return False, f"Unknown metric_type: {mt}", {}


async def _promote_pending_policies(db: AsyncSession, now: datetime):
    result = await db.execute(select(models.Policy).filter(models.Policy.status == "PENDING"))
    pending = result.scalars().all()
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
        await db.commit()

async def activate_trigger(
    data: TriggerCreate, db: AsyncSession, background_tasks: BackgroundTasks
) -> TriggerResponse:
    result = await db.execute(select(models.GeoZone).filter(models.GeoZone.zone_id == data.zone_id))
    zone = result.scalars().first()
    if not zone:
        raise ValueError(f"Zone {data.zone_id} does not exist.")

    if data.trigger_end_time <= data.trigger_time:
        raise ValueError(
            f"trigger_end_time ({data.trigger_end_time}) must be after trigger_time ({data.trigger_time})."
        )

    passed, threshold_msg, api_data = await _fetch_and_validate(data)
    if not passed:
        raise ValueError(f"Trigger rejected: {threshold_msg}")

    event_meta_in = data.event_metadata or {}
    pipeline_response = mock_api.build_pipeline_response(
        metric_type=data.metric_type,
        flat_data=api_data,
        threshold_value=event_meta_in.get("thresholdValue", 0),
        threshold_met=passed,
        subtype=event_meta_in.get("trigger_subtype", ""),
        injected_value=event_meta_in.get("thresholdValue"),
    )

    now = datetime.now(timezone.utc)
    await _promote_pending_policies(db, now)

    metadata = dict(data.event_metadata or {})
    metadata.update(
        {
            "trigger_time": data.trigger_time,
            "trigger_end_time": data.trigger_end_time,
            "threshold_check": threshold_msg,
            "mock_api_response": api_data,
            "pipeline_response": pipeline_response,
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
    await db.commit()
    await db.refresh(event)

    result = await db.execute(select(models.RiderZone).filter(models.RiderZone.zone_id == data.zone_id))
    zone_links = result.scalars().all()
    zone_profile_ids = {link.profile_id for link in zone_links}

    if not zone_profile_ids:
        active_policies = []
    else:
        result = await db.execute(
            select(models.Policy).filter(
                models.Policy.profile_id.in_(zone_profile_ids),
                models.Policy.status == "ACTIVE",
                models.Policy.expires_at > now,
            )
        )
        active_policies = result.scalars().all()

    eligible, skipped_shift = 0, 0

    for policy in active_policies:
        res = await db.execute(select(models.RiderProfile).filter(models.RiderProfile.profile_id == policy.profile_id))
        rider = res.scalars().first()
        if not rider:
            continue
        shift_start = rider.shift_hours.get("start", "00:00") if rider.shift_hours else "00:00"
        shift_end   = rider.shift_hours.get("end",   "23:59") if rider.shift_hours else "23:59"
        overlap = _overlap_hours(
            data.trigger_time, data.trigger_end_time, shift_start, shift_end
        )
        if overlap > 0:
            eligible += 1
        else:
            skipped_shift += 1

    disruption_hours = _overlap_hours(
        data.trigger_time, data.trigger_end_time, "00:00", "23:59"
    )
    interval_count = max(1, round(disruption_hours * 2))

    res = await db.execute(select(models.CityBenchmark).filter(models.CityBenchmark.city_id == zone.city_id))
    city = res.scalars().first()
    est_new = est_ret = 0.0
    if city and float(city.baseline_active_hours) > 0:
        hourly   = float(city.baseline_weekly_income) / float(city.baseline_active_hours)
        est_new  = round(disruption_hours * hourly * 0.40, 2)
        est_ret  = round(disruption_hours * hourly * 0.65, 2)

    logger.info(
        f"[TRIGGER] Event {event.event_id} | zone {data.zone_id} | "
        f"disruption={disruption_hours}h | {interval_count} intervals | {eligible} eligible"
    )

    background_tasks.add_task(
        payout_engine.run_payouts_in_background,
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
        overlap_hours=disruption_hours,
        interval_count=interval_count,
        estimated_payout_new=est_new,
        estimated_payout_returning=est_ret,
        mock_api_data=pipeline_response,
    )
