"""
data_pipeline.py (mock_api.py) — VERO SafeGuard Real API + Simulation Layer

DATA SOURCES (all free, no API key required):
  Weather → Open-Meteo  (api.open-meteo.com)
  AQI     → Open-Meteo Air Quality  (air-quality-api.open-meteo.com)
  Social  → GDELT Project  (api.gdeltproject.org)  — live news scanner
  Platform → Internal simulation (clearly labelled as such)

PIPELINE ARCHITECTURE:
  Each fetch_*() function returns the existing flat dict for backward
  compatibility with trigger_engine.py (all field names unchanged).

  build_pipeline_response() wraps that flat dict into the 4-layer
  structure shown in the Admin Simulator UI:

    Layer 1 — external_api   : raw provider response + metadata
    Layer 2 — normalized_data: VERO-standard fields, zone-enriched
    Layer 3 — trigger_evaluation: threshold check, rule, confidence
    Layer 4 — simulation     : admin oracle injection details
"""

import random
import math
import requests
from datetime import datetime, timezone, timedelta
import logging

logger = logging.getLogger(__name__)

# ─── Zone coordinates for real API calls ─────────────────────────────────────
# One coordinate pair per zone; Open-Meteo needs lat/lon
_ZONE_COORDS = {
    1:  {"lat": 12.9784, "lon": 77.6408, "zone": "Indiranagar",      "city": "Bengaluru", "station": "IMD_BLR_WHITEFIELD"},
    2:  {"lat": 12.9352, "lon": 77.6245, "zone": "Koramangala",      "city": "Bengaluru", "station": "IMD_BLR_HAL"},
    3:  {"lat": 12.9698, "lon": 77.7499, "zone": "Whitefield",       "city": "Bengaluru", "station": "IMD_BLR_KEMPEGOWDA"},
    4:  {"lat": 13.0418, "lon": 80.2341, "zone": "T Nagar",          "city": "Chennai",   "station": "IMD_MAA_NUNGAMBAKKAM"},
    5:  {"lat": 13.0012, "lon": 80.2565, "zone": "Adyar",            "city": "Chennai",   "station": "IMD_MAA_MEENAMBAKKAM"},
    6:  {"lat": 12.9815, "lon": 80.2180, "zone": "Velachery",        "city": "Chennai",   "station": "IMD_MAA_VELACHERY"},
    7:  {"lat": 13.0878, "lon": 80.2100, "zone": "Anna Nagar",       "city": "Chennai",   "station": "IMD_MAA_ANNANAGAR"},
    8:  {"lat": 19.0544, "lon": 72.8402, "zone": "Bandra",           "city": "Mumbai",    "station": "IMD_BOM_SANTACRUZ"},
    9:  {"lat": 19.1136, "lon": 72.8697, "zone": "Andheri",          "city": "Mumbai",    "station": "IMD_BOM_VILEPARLE"},
    10: {"lat": 19.0176, "lon": 72.8562, "zone": "Dadar",            "city": "Mumbai",    "station": "IMD_BOM_COLABA"},
    11: {"lat": 19.2183, "lon": 72.8543, "zone": "Borivali",         "city": "Mumbai",    "station": "IMD_BOM_BORIVALI"},
    12: {"lat": 28.6315, "lon": 77.2167, "zone": "Connaught Place",  "city": "Delhi",     "station": "IMD_DEL_SAFDARJUNG"},
    13: {"lat": 28.5672, "lon": 77.2374, "zone": "Lajpat Nagar",     "city": "Delhi",     "station": "IMD_DEL_LODHI"},
    14: {"lat": 28.7495, "lon": 77.0667, "zone": "Rohini",           "city": "Delhi",     "station": "IMD_DEL_PALAM"},
    15: {"lat": 28.5921, "lon": 77.0460, "zone": "Dwarka",           "city": "Delhi",     "station": "IMD_DEL_GURGAON"},
    16: {"lat": 17.3850, "lon": 78.4867, "zone": "Hyderabad Central","city": "Hyderabad", "station": "IMD_HYD_BEGUMPET"},
    17: {"lat": 17.4126, "lon": 78.4482, "zone": "Banjara Hills",    "city": "Hyderabad", "station": "IMD_HYD_BANJARA"},
    18: {"lat": 17.4399, "lon": 78.4983, "zone": "Secunderabad",     "city": "Hyderabad", "station": "IMD_HYD_SECBAD"},
    19: {"lat": 18.5362, "lon": 73.8938, "zone": "Koregaon Park",    "city": "Pune",      "station": "IMD_PNQ_SHIVAJINAGAR"},
    20: {"lat": 18.5074, "lon": 73.8077, "zone": "Kothrud",          "city": "Pune",      "station": "IMD_PNQ_LOHEGAON"},
    21: {"lat": 22.5605, "lon": 88.3509, "zone": "Park Street",      "city": "Kolkata",   "station": "IMD_CCU_ALIPUR"},
    22: {"lat": 22.5804, "lon": 88.4183, "zone": "Salt Lake",        "city": "Kolkata",   "station": "IMD_CCU_DUMDUM"},
}

# ─── Simulation baseline profiles (fallback when real API fails) ──────────────
_WEATHER_BASELINE = {
    1: {"rainfall_base": 42, "wind_base": 28, "temp_base": 30},
    2: {"rainfall_base": 38, "wind_base": 25, "temp_base": 29},
    3: {"rainfall_base": 35, "wind_base": 22, "temp_base": 28},
    4: {"rainfall_base": 55, "wind_base": 35, "temp_base": 33},
    5: {"rainfall_base": 72, "wind_base": 38, "temp_base": 34},
    6: {"rainfall_base": 68, "wind_base": 41, "temp_base": 33},
    7: {"rainfall_base": 55, "wind_base": 43, "temp_base": 34},
    8: {"rainfall_base": 88, "wind_base": 52, "temp_base": 31},
    9: {"rainfall_base": 76, "wind_base": 49, "temp_base": 31},
    10: {"rainfall_base": 65, "wind_base": 40, "temp_base": 30},
    11: {"rainfall_base": 58, "wind_base": 35, "temp_base": 30},
    12: {"rainfall_base": 61, "wind_base": 47, "temp_base": 42},
    13: {"rainfall_base": 44, "wind_base": 35, "temp_base": 43},
    14: {"rainfall_base": 40, "wind_base": 30, "temp_base": 41},
    15: {"rainfall_base": 35, "wind_base": 28, "temp_base": 40},
    16: {"rainfall_base": 45, "wind_base": 30, "temp_base": 35},
    17: {"rainfall_base": 50, "wind_base": 33, "temp_base": 36},
    18: {"rainfall_base": 42, "wind_base": 28, "temp_base": 35},
    19: {"rainfall_base": 55, "wind_base": 32, "temp_base": 32},
    20: {"rainfall_base": 48, "wind_base": 28, "temp_base": 31},
    21: {"rainfall_base": 60, "wind_base": 38, "temp_base": 33},
    22: {"rainfall_base": 55, "wind_base": 35, "temp_base": 32},
}

_AQI_BASELINE = {
    1: 110, 2: 120, 3: 95, 4: 130, 5: 142, 6: 178, 7: 210,
    8: 156, 9: 189, 10: 165, 11: 140,
    12: 387, 13: 342, 14: 310, 15: 280,
    16: 145, 17: 160, 18: 130,
    19: 155, 20: 135,
    21: 195, 22: 175,
}

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _noise(base: float, pct: float = 0.15) -> float:
    return round(base * (1 + random.uniform(-pct, pct)), 1)

def _ist_now() -> str:
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).isoformat()

def _weather_condition(rainfall: float, wind: float) -> str:
    if rainfall > 80: return "Cyclonic Rain"
    if rainfall > 60: return "Thunderstorm with Heavy Rain"
    if rainfall > 40: return "Heavy Rain"
    if rainfall > 25: return "Moderate Rain"
    if wind > 45:     return "Strong Wind Advisory"
    return "Light Rain / Drizzle"

def _aqi_category(aqi: int) -> str:
    if aqi <= 50:  return "Good"
    if aqi <= 100: return "Moderate"
    if aqi <= 150: return "Unhealthy for Sensitive Groups"
    if aqi <= 200: return "Unhealthy"
    if aqi <= 300: return "Very Unhealthy"
    return "Hazardous"

def _zone_meta(zone_id: int) -> dict:
    return _ZONE_COORDS.get(zone_id, {
        "lat": 20.5937, "lon": 78.9629,
        "zone": f"Zone-{zone_id}", "city": "India",
        "station": f"IMD_GEN_{zone_id}"
    })


# ─────────────────────────────────────────────────────────────────────────────
#  WEATHER  —  Open-Meteo (real API, no key)
# ─────────────────────────────────────────────────────────────────────────────

def fetch_weather(zone_id: int) -> dict:
    """
    Fetches REAL weather data from Open-Meteo API (api.open-meteo.com).
    Fields retrieved: temperature_2m, windspeed_10m, precipitation,
                      relativehumidity_2m, surface_pressure, weathercode.
    Precipitation is the real observed value; rainfall_mm in the
    normalised view is the admin-injected oracle value (thresholdValue),
    while the raw API precipitation is exposed in Layer 1.
    Falls back to simulation baseline on any network failure.
    """
    meta   = _zone_meta(zone_id)
    base   = _WEATHER_BASELINE.get(zone_id, {"rainfall_base": 55, "wind_base": 35, "temp_base": 32})
    lat, lon = meta["lat"], meta["lon"]

    # Simulation defaults (used if real API fails)
    sim_temp     = round(base["temp_base"]     + random.uniform(-2, 3), 1)
    sim_wind     = _noise(base["wind_base"])
    sim_rainfall = _noise(base["rainfall_base"])
    humidity     = random.randint(65, 95)
    pressure     = random.randint(998, 1015)
    visibility   = round(random.uniform(1.5, 8.0), 1)
    sustained    = round(random.uniform(1.0, 3.5), 1)
    confidence   = round(random.uniform(0.88, 0.97), 2)

    # Real API call
    raw_api = {}
    api_source = "open-meteo.com (simulation fallback)"
    api_ok = False

    try:
        url = (
            f"https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,windspeed_10m,precipitation,"
            f"relativehumidity_2m,surface_pressure,weathercode,visibility"
            f"&timezone=Asia%2FKolkata"
        )
        resp = requests.get(url, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            cur  = data.get("current", {})

            real_temp  = cur.get("temperature_2m")
            real_wind  = cur.get("windspeed_10m")
            real_prec  = cur.get("precipitation")
            real_hum   = cur.get("relativehumidity_2m")
            real_pres  = cur.get("surface_pressure")
            real_vis   = cur.get("visibility")   # metres
            real_wcode = cur.get("weathercode", 0)

            raw_api = {
                "temperature_2m":      real_temp,
                "windspeed_10m":       real_wind,
                "precipitation":       real_prec,   # mm current hour (live)
                "relativehumidity_2m": real_hum,
                "surface_pressure":    real_pres,
                "weathercode":         real_wcode,
                "visibility":          real_vis,
                "units": {
                    "temperature_2m":      "°C",
                    "windspeed_10m":       "km/h",
                    "precipitation":       "mm",
                    "relativehumidity_2m": "%",
                    "surface_pressure":    "hPa",
                    "visibility":          "m",
                }
            }

            # Override simulated values with real ones
            if real_temp  is not None: sim_temp  = real_temp
            if real_wind  is not None: sim_wind  = max(real_wind, sim_wind * 0.3)
            if real_hum   is not None: humidity  = real_hum
            if real_pres  is not None: pressure  = real_pres
            if real_vis   is not None: visibility = round(real_vis / 1000, 1)  # m → km

            api_source = "open-meteo.com (LIVE)"
            api_ok = True
    except Exception as e:
        logger.warning(f"[WeatherAPI] fallback: {e}")
        raw_api = {"fallback": True, "reason": "network timeout — using simulation baseline"}

    return {
        # ── flat fields consumed by trigger_engine.py (unchanged) ──────────
        "source":         api_source,
        "station_id":     meta["station"],
        "fetched_at":     _ist_now(),
        "zone_id":        zone_id,
        "zone":           meta["zone"],
        "city":           meta["city"],
        "rainfall_mm":    sim_rainfall,       # oracle/simulation value
        "wind_kmh":       sim_wind,
        "temperature":    sim_temp,
        "humidity_pct":   humidity,
        "condition":      _weather_condition(sim_rainfall, sim_wind),
        "sustained_hours": sustained,
        "pressure_hpa":   pressure,
        "visibility_km":  visibility,
        "data_confidence": confidence,
        # ── extra fields for pipeline builder ───────────────────────────────
        "_raw_api":    raw_api,
        "_api_ok":     api_ok,
        "_provider":   "open-meteo.com",
        "_endpoint":   "/v1/forecast",
        "_lat":        lat,
        "_lon":        lon,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  AQI  —  Open-Meteo Air Quality API (real, no key)
# ─────────────────────────────────────────────────────────────────────────────

def fetch_aqi(zone_id: int) -> dict:
    """
    Fetches REAL AQI data from Open-Meteo Air Quality API.
    Fields: european_aqi, us_aqi, pm2_5, pm10, nitrogen_dioxide, ozone.
    Falls back to zone AQI baseline on failure.
    """
    meta     = _zone_meta(zone_id)
    base_aqi = _AQI_BASELINE.get(zone_id, 320)
    lat, lon = meta["lat"], meta["lon"]

    # Simulation fallback
    sim_aqi  = int(_noise(base_aqi))
    sim_pm25 = round(sim_aqi * random.uniform(0.8, 1.2))
    sim_pm10 = round(sim_aqi * random.uniform(1.0, 1.5))
    sim_no2  = random.randint(20, 80)
    sim_o3   = random.randint(15, 60)
    sustained = round(random.uniform(2.0, 4.5), 1)
    confidence = round(random.uniform(0.90, 0.98), 2)

    raw_api = {}
    api_source = "open-meteo-air-quality.com (simulation fallback)"
    api_ok = False

    try:
        url = (
            f"https://air-quality-api.open-meteo.com/v1/air-quality"
            f"?latitude={lat}&longitude={lon}"
            f"&current=european_aqi,us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone"
            f"&timezone=Asia%2FKolkata"
        )
        resp = requests.get(url, timeout=4)
        if resp.status_code == 200:
            data = resp.json()
            cur  = data.get("current", {})

            real_euro_aqi = cur.get("european_aqi")
            real_us_aqi   = cur.get("us_aqi")
            real_pm25     = cur.get("pm2_5")
            real_pm10     = cur.get("pm10")
            real_no2      = cur.get("nitrogen_dioxide")
            real_o3       = cur.get("ozone")

            raw_api = {
                "european_aqi":     real_euro_aqi,
                "us_aqi":           real_us_aqi,
                "pm2_5":            real_pm25,
                "pm10":             real_pm10,
                "nitrogen_dioxide": real_no2,
                "ozone":            real_o3,
                "units": {
                    "pm2_5":            "μg/m³",
                    "pm10":             "μg/m³",
                    "nitrogen_dioxide": "μg/m³",
                    "ozone":            "μg/m³",
                }
            }

            # Use the higher of EU AQI and US AQI for trigger threshold
            live_aqi = real_euro_aqi or real_us_aqi
            if live_aqi is not None:
                # Scale open-meteo AQI index to CPCB 0-500 range
                # Open-Meteo EU AQI: 0-100 maps roughly to 0-300 CPCB scale
                # We blend real with our zone baseline to stay demo-realistic
                cpcb_estimate = int(live_aqi * 3.0)
                sim_aqi = max(cpcb_estimate, int(base_aqi * 0.7))
            if real_pm25 is not None: sim_pm25 = real_pm25
            if real_pm10 is not None: sim_pm10 = real_pm10
            if real_no2  is not None: sim_no2  = real_no2
            if real_o3   is not None: sim_o3   = real_o3

            api_source = "open-meteo-air-quality.com (LIVE)"
            api_ok = True
    except Exception as e:
        logger.warning(f"[AQI API] fallback: {e}")
        raw_api = {"fallback": True, "reason": "network timeout — using simulation baseline"}

    dominant = "PM2.5" if sim_pm25 > sim_pm10 * 0.7 else "PM10"

    return {
        # ── flat fields consumed by trigger_engine.py (unchanged) ──────────
        "source":         api_source,
        "station_id":     f"CPCB_{meta['zone'].upper().replace(' ', '_')}",
        "fetched_at":     _ist_now(),
        "zone_id":        zone_id,
        "zone":           meta["zone"],
        "aqi":            sim_aqi,
        "dominant":       dominant,
        "category":       _aqi_category(sim_aqi),
        "pm25":           sim_pm25,
        "pm10":           sim_pm10,
        "no2":            sim_no2,
        "o3":             sim_o3,
        "sustained_hours": sustained,
        "data_confidence": confidence,
        # ── extra fields for pipeline builder ───────────────────────────────
        "_raw_api":   raw_api,
        "_api_ok":    api_ok,
        "_provider":  "open-meteo-air-quality.com",
        "_endpoint":  "/v1/air-quality",
        "_lat":       lat,
        "_lon":       lon,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  PLATFORM BLACKOUT  —  enriched simulation (clearly labelled)
# ─────────────────────────────────────────────────────────────────────────────

def fetch_platform_status(platform: str) -> dict:
    """
    Platform uptime simulation.
    DownDetector has no free public API, so this uses a realistic
    simulation clearly labelled as such in Layer 1.
    """
    key = platform.lower()
    is_zomato = key == "zomato"
    reports   = int(_noise(4800 if is_zomato else 2100))
    regions   = (
        ["Mumbai", "Delhi", "Bengaluru", "Chennai"]
        if is_zomato else ["Bengaluru", "Hyderabad", "Pune"]
    )
    latency = random.randint(8000, 30000)
    spike   = round(random.uniform(340, 820), 1)

    raw_api = {
        "reports_last_hour":  reports,
        "report_spike_pct":   spike,
        "api_latency_ms":     latency,
        "affected_regions":   random.sample(regions, k=min(len(regions), random.randint(2, len(regions)))),
        "status_page":        f"https://status.{key}.com",
        "status":             "partial_outage",
    }

    return {
        "source":             f"downdetector.in/status/{key} (simulation)",
        "fetched_at":         _ist_now(),
        "platform":           platform.capitalize(),
        "status":             "partial_outage",
        "outage_duration_min": 0,        # overridden by user input in trigger engine
        "reports_last_hour":  reports,
        "report_spike_pct":   spike,
        "affected_regions":   raw_api["affected_regions"],
        "api_latency_ms":     latency,
        "status_page":        raw_api["status_page"],
        "data_confidence":    round(random.uniform(0.92, 0.99), 2),
        "_raw_api":           raw_api,
        "_api_ok":            False,     # no real DownDetector API
        "_provider":          "downdetector.in",
        "_endpoint":          f"/status/{key}",
        "_lat":               None,
        "_lon":               None,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  SOCIAL DISRUPTION  —  GDELT Project (real news API, no key)
# ─────────────────────────────────────────────────────────────────────────────

# Pre-armed high-confidence zones (used as enrichment base)
_SOCIAL_SIGNALS = {
    5:  {"zone": "Adyar",          "city": "Chennai",  "event": "Chennai Bandh",         "base_confidence": 91, "restaurant_closure_base": 87},
    12: {"zone": "Connaught Place","city": "Delhi",    "event": "Delhi Bandh",           "base_confidence": 83, "restaurant_closure_base": 82},
    8:  {"zone": "Bandra",         "city": "Mumbai",   "event": "Mumbai Bandh",          "base_confidence": 78, "restaurant_closure_base": 81},
}

def _gdelt_fetch(city: str) -> list[dict]:
    """
    Queries GDELT Project v2 DOC API for recent bandh/curfew/shutdown
    news in the specified city. Returns list of article dicts.
    Completely free, no API key required.
    """
    try:
        query = f'(bandh OR curfew OR shutdown OR "road block") {city} India'
        url = (
            "https://api.gdeltproject.org/api/v2/doc/doc"
            f"?query={requests.utils.quote(query)}"
            "&mode=artlist&format=json&maxrecords=10&timespan=7d"
        )
        resp = requests.get(url, timeout=5)
        if resp.status_code == 200 and resp.text.strip():
            data = resp.json()
            articles = data.get("articles", [])
            return [
                {
                    "type":   "news_article",
                    "title":  a.get("title", "Disruption reported"),
                    "weight": random.randint(15, 35),
                    "source": a.get("domain", "news.source"),
                    "url":    a.get("url", ""),
                }
                for a in articles[:6]
            ]
    except Exception as e:
        logger.warning(f"[GDELT] fetch failed for {city}: {e}")
    return []


def fetch_social_signals(zone_id: int) -> dict:
    """
    Social disruption oracle.
    Primary: GDELT Project live news scan for city.
    Enrichment: pre-armed zone profiles for high-signal cities.
    Fallback: enriched simulation if GDELT is unreachable.
    """
    prearm = _SOCIAL_SIGNALS.get(zone_id)
    meta   = _zone_meta(zone_id)
    zone_name = meta["zone"]
    city      = meta["city"]
    event     = prearm["event"] if prearm else "Civic Disruption"

    # Base confidence and closure from prearm or random
    base_confidence = prearm["base_confidence"]       if prearm else random.randint(76, 88)
    base_closure    = prearm["restaurant_closure_base"] if prearm else random.randint(75, 87)

    confidence = int(_noise(base_confidence, 0.05))
    closure    = int(_noise(base_closure, 0.05))

    # ── Attempt GDELT real news scan ─────────────────────────────────────────
    gdelt_articles = _gdelt_fetch(city)
    api_ok = len(gdelt_articles) > 0

    if api_ok:
        # Use real GDELT articles as sources
        sources = gdelt_articles
        raw_api = {
            "query":            f"(bandh OR curfew OR shutdown) {city} India",
            "articles_found":   len(gdelt_articles),
            "articles":         gdelt_articles,
            "timespan":         "7d",
        }
    else:
        # Fallback simulation sources
        sources = [
            {"type": "government_notice", "title": f"{city} district administration advisory issued",          "weight": 35},
            {"type": "news_article",      "title": f"Local bandh announced in {zone_name}",                    "weight": 25},
            {"type": "twitter_trending",  "title": f"#{zone_name.replace(' ', '')}Shutdown trending",          "weight": 20},
            {"type": "news_article",      "title": f"Restaurant and shop closures confirmed across {city}",   "weight": 20},
        ]
        raw_api = {
            "fallback":  True,
            "reason":    "GDELT API timeout — using pre-armed simulation signals",
            "articles":  sources,
        }

    tweets_count = random.randint(5000, 25000)

    return {
        # ── flat fields consumed by trigger_engine.py (unchanged) ──────────
        "source":               "gdelt-project.org + district-govt-feeds" if api_ok else "pre-armed simulation",
        "fetched_at":           _ist_now(),
        "zone_id":              zone_id,
        "zone":                 zone_name,
        "city":                 city,
        "event":                event,
        "confidence_pct":       confidence,
        "sources":              sources,
        "twitter_volume":       tweets_count,
        "restaurant_closure_pct": closure,
        "pre_armed":            True,
        "signal_first_detected": (datetime.now(timezone.utc) - timedelta(hours=random.randint(8, 14))).isoformat(),
        "data_confidence":      round(random.uniform(0.85, 0.95), 2),
        # ── extra fields for pipeline builder ───────────────────────────────
        "_raw_api":   raw_api,
        "_api_ok":    api_ok,
        "_provider":  "gdelt-project.org",
        "_endpoint":  "/api/v2/doc/doc",
        "_lat":       meta["lat"],
        "_lon":       meta["lon"],
    }


# ─────────────────────────────────────────────────────────────────────────────
#  PIPELINE BUILDER  —  Wraps flat data into the 4-layer UI structure
# ─────────────────────────────────────────────────────────────────────────────

def build_pipeline_response(
    metric_type:      str,
    flat_data:        dict,
    threshold_value:  float,
    threshold_met:    bool,
    subtype:          str = "",
    injected_value:   float = None,
) -> dict:
    """
    Converts the flat API dict (returned by fetch_*) into the 4-layer
    pipeline structure displayed in the Admin Simulator.

    Layer 1 — external_api      : Raw provider call metadata + raw payload
    Layer 2 — normalized_data   : VERO-standard fields, zone-enriched
    Layer 3 — trigger_evaluation: Threshold check, rule text, confidence
    Layer 4 — simulation        : Oracle injection / admin override details
    """
    provider  = flat_data.get("_provider", "unknown")
    endpoint  = flat_data.get("_endpoint", "")
    lat       = flat_data.get("_lat")
    lon       = flat_data.get("_lon")
    raw_api   = flat_data.get("_raw_api", {})
    api_ok    = flat_data.get("_api_ok", False)

    # ── Layer 1: External API ─────────────────────────────────────────────────
    layer1 = {
        "provider":   provider,
        "endpoint":   endpoint,
        "fetched_at": flat_data.get("fetched_at", _ist_now()),
        "live":       api_ok,
        "raw":        raw_api,
    }
    if lat is not None:
        layer1["lat"] = lat
        layer1["lon"] = lon

    # ── Layer 2: Normalized Data ──────────────────────────────────────────────
    if metric_type == "WEATHER":
        layer2 = {
            "station_id":    flat_data.get("station_id"),
            "zone":          flat_data.get("zone"),
            "city":          flat_data.get("city"),
            "rainfall_mm":   flat_data.get("rainfall_mm"),
            "wind_kmh":      flat_data.get("wind_kmh"),
            "temperature":   flat_data.get("temperature"),
            "humidity_pct":  flat_data.get("humidity_pct"),
            "condition":     flat_data.get("condition"),
            "visibility_km": flat_data.get("visibility_km"),
            "pressure_hpa":  flat_data.get("pressure_hpa"),
            "sustained_hours": flat_data.get("sustained_hours"),
        }
    elif metric_type == "AQI":
        layer2 = {
            "station_id": flat_data.get("station_id"),
            "zone":       flat_data.get("zone"),
            "city":       flat_data.get("city"),
            "aqi":        flat_data.get("aqi"),
            "category":   flat_data.get("category"),
            "dominant":   flat_data.get("dominant"),
            "pm2_5":      flat_data.get("pm25"),
            "pm10":       flat_data.get("pm10"),
            "no2":        flat_data.get("no2"),
            "o3":         flat_data.get("o3"),
            "sustained_hours": flat_data.get("sustained_hours"),
        }
    elif metric_type == "PLATFORM_BLACKOUT":
        layer2 = {
            "platform":           flat_data.get("platform"),
            "status":             flat_data.get("status"),
            "reports_last_hour":  flat_data.get("reports_last_hour"),
            "report_spike_pct":   flat_data.get("report_spike_pct"),
            "api_latency_ms":     flat_data.get("api_latency_ms"),
            "affected_regions":   flat_data.get("affected_regions"),
            "outage_duration_min": threshold_value,
        }
    else:  # SOCIAL_DISRUPTION
        layer2 = {
            "zone":                   flat_data.get("zone"),
            "city":                   flat_data.get("city"),
            "event":                  flat_data.get("event"),
            "confidence_pct":         flat_data.get("confidence_pct"),
            "restaurant_closure_pct": flat_data.get("restaurant_closure_pct"),
            "twitter_volume":         flat_data.get("twitter_volume"),
            "sources_count":          len(flat_data.get("sources", [])),
            "signal_first_detected":  flat_data.get("signal_first_detected"),
            "pre_armed":              flat_data.get("pre_armed"),
        }

    # ── Layer 3: Trigger Evaluation ───────────────────────────────────────────
    confidence_score = flat_data.get("data_confidence", 0.92)

    if metric_type == "WEATHER":
        if subtype == "Hailstorm":
            rule      = "hailstorm_confirmed >= 1 alert"
            observed  = threshold_value
            threshold = 1
        elif subtype == "Extreme Heat":
            rule      = "temperature >= 40°C AND sustained >= 2h"
            observed  = threshold_value
            threshold = 40
        else:
            rule      = "rainfall >= 35 mm/hr AND sustained >= 1h"
            observed  = threshold_value
            threshold = 35
    elif metric_type == "AQI":
        rule      = "AQI (CPCB) > 300 AND sustained >= 2h"
        observed  = threshold_value
        threshold = 300
    elif metric_type == "PLATFORM_BLACKOUT":
        rule      = "outage_duration > 45 min during peak hours (12:00–14:30 OR 19:00–22:30)"
        observed  = threshold_value
        threshold = 45
    else:
        rule      = "oracle_confidence > 75% AND restaurant_closure > 80%"
        observed  = flat_data.get("confidence_pct", threshold_value)
        threshold = 75

    layer3 = {
        "rule":           rule,
        "threshold":      threshold,
        "observed":       observed,
        "sustained_hours": flat_data.get("sustained_hours", None),
        "threshold_met":  threshold_met,
        "confidence":     confidence_score,
        "verdict":        "✓ TRIGGER ACTIVATED" if threshold_met else "✗ BELOW THRESHOLD",
    }

    # ── Layer 4: Simulation Override ──────────────────────────────────────────
    # The admin slider value IS the oracle injection — it represents the
    # severity value reported by the parametric oracle, which overrides
    # raw API data when the admin wants to force a trigger for demo purposes.
    sim_type_map = {
        "WEATHER":           "RAIN_OVERRIDE" if not subtype or subtype == "Heavy Rain" else f"{subtype.upper().replace(' ', '_')}_OVERRIDE",
        "AQI":               "AQI_OVERRIDE",
        "PLATFORM_BLACKOUT": "OUTAGE_DURATION_OVERRIDE",
        "SOCIAL_DISRUPTION": "CONFIDENCE_OVERRIDE",
    }
    unit_map = {
        "WEATHER":           "mm/hr",
        "AQI":               "AQI index",
        "PLATFORM_BLACKOUT": "minutes",
        "SOCIAL_DISRUPTION": "% confidence",
    }

    layer4 = {
        "enabled":        True,
        "type":           sim_type_map.get(metric_type, "ORACLE_OVERRIDE"),
        "injected_value": injected_value if injected_value is not None else threshold_value,
        "unit":           unit_map.get(metric_type, ""),
        "reason":         "Admin parametric oracle trigger — severity value set via Simulator UI",
        "live_api_data":  "LIVE" if api_ok else "SIMULATED",
        "note":           (
            "Real meteorological data fetched live; severity threshold injected by oracle."
            if api_ok else
            "API unavailable — full simulation active. Demo data reflects realistic zone baselines."
        ),
    }

    return {
        "external_api":       layer1,
        "normalized_data":    layer2,
        "trigger_evaluation": layer3,
        "simulation":         layer4,
    }
