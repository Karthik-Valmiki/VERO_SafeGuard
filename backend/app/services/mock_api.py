"""
mock_api.py — Dynamic external API simulation layer.
Produces realistic, time-varying responses that look identical to
OpenWeatherMap, IQAir/CPCB, DownDetector, and NewsAPI outputs.

Each call adds ±15 % noise so repeated requests never return identical data,
making the demo feel live without requiring real API keys.
"""

import random
import math
from datetime import datetime, timezone, timedelta

# ─── Zone baseline weather profiles ──────────────────────────────────────────
_WEATHER_PROFILES = {
    1: {"zone": "Indiranagar", "city": "Bengaluru", "station": "IMD_BLR_WHITEFIELD", "rainfall_base": 42.0, "wind_base": 28.0, "temp_base": 30},
    2: {"zone": "Koramangala", "city": "Bengaluru", "station": "IMD_BLR_HAL", "rainfall_base": 38.0, "wind_base": 25.0, "temp_base": 29},
    3: {"zone": "Whitefield", "city": "Bengaluru", "station": "IMD_BLR_KEMPEGOWDA", "rainfall_base": 35.0, "wind_base": 22.0, "temp_base": 28},
    4: {"zone": "T Nagar", "city": "Chennai", "station": "IMD_MAA_NUNGAMBAKKAM", "rainfall_base": 55.0, "wind_base": 35.0, "temp_base": 33},
    5: {"zone": "Adyar", "city": "Chennai", "station": "IMD_MAA_MEENAMBAKKAM", "rainfall_base": 72.0, "wind_base": 38.0, "temp_base": 34},
    6: {"zone": "Velachery", "city": "Chennai", "station": "IMD_MAA_VELACHERY", "rainfall_base": 68.0, "wind_base": 41.0, "temp_base": 33},
    7: {"zone": "Anna Nagar", "city": "Chennai", "station": "IMD_MAA_ANNANAGAR", "rainfall_base": 55.0, "wind_base": 43.0, "temp_base": 34},
    8: {"zone": "Bandra", "city": "Mumbai", "station": "IMD_BOM_SANTACRUZ", "rainfall_base": 88.0, "wind_base": 52.0, "temp_base": 31},
    9: {"zone": "Andheri", "city": "Mumbai", "station": "IMD_BOM_VILEPARLE", "rainfall_base": 76.0, "wind_base": 49.0, "temp_base": 31},
    10: {"zone": "Dadar", "city": "Mumbai", "station": "IMD_BOM_COLABA", "rainfall_base": 65.0, "wind_base": 40.0, "temp_base": 30},
    11: {"zone": "Borivali", "city": "Mumbai", "station": "IMD_BOM_BORIVALI", "rainfall_base": 58.0, "wind_base": 35.0, "temp_base": 30},
    12: {"zone": "Connaught Place", "city": "Delhi", "station": "IMD_DEL_SAFDARJUNG", "rainfall_base": 61.0, "wind_base": 47.0, "temp_base": 42},
    13: {"zone": "Lajpat Nagar", "city": "Delhi", "station": "IMD_DEL_LODHI", "rainfall_base": 44.0, "wind_base": 35.0, "temp_base": 43},
    14: {"zone": "Rohini", "city": "Delhi", "station": "IMD_DEL_PALAM", "rainfall_base": 40.0, "wind_base": 30.0, "temp_base": 41},
    15: {"zone": "Dwarka", "city": "Delhi", "station": "IMD_DEL_GURGAON", "rainfall_base": 35.0, "wind_base": 28.0, "temp_base": 40},
    16: {"zone": "Hyderabad Central", "city": "Hyderabad", "station": "IMD_HYD_BEGUMPET", "rainfall_base": 45.0, "wind_base": 30.0, "temp_base": 35},
    17: {"zone": "Banjara Hills", "city": "Hyderabad", "station": "IMD_HYD_BANJARA", "rainfall_base": 50.0, "wind_base": 33.0, "temp_base": 36},
    18: {"zone": "Secunderabad", "city": "Hyderabad", "station": "IMD_HYD_SECBAD", "rainfall_base": 42.0, "wind_base": 28.0, "temp_base": 35},
    19: {"zone": "Koregaon Park", "city": "Pune", "station": "IMD_PNQ_SHIVAJINAGAR", "rainfall_base": 55.0, "wind_base": 32.0, "temp_base": 32},
    20: {"zone": "Kothrud", "city": "Pune", "station": "IMD_PNQ_LOHEGAON", "rainfall_base": 48.0, "wind_base": 28.0, "temp_base": 31},
    21: {"zone": "Park Street", "city": "Kolkata", "station": "IMD_CCU_ALIPUR", "rainfall_base": 60.0, "wind_base": 38.0, "temp_base": 33},
    22: {"zone": "Salt Lake", "city": "Kolkata", "station": "IMD_CCU_DUMDUM", "rainfall_base": 55.0, "wind_base": 35.0, "temp_base": 32},
}

# ─── AQI baseline profiles ──────────────────────────────────────────────────
_AQI_PROFILES = {
    1: {"zone": "Indiranagar", "aqi_base": 110, "dominant": "PM2.5"},
    2: {"zone": "Koramangala", "aqi_base": 120, "dominant": "PM10"},
    3: {"zone": "Whitefield", "aqi_base": 95, "dominant": "PM2.5"},
    4: {"zone": "T Nagar", "aqi_base": 130, "dominant": "PM2.5"},
    5: {"zone": "Adyar", "aqi_base": 142, "dominant": "PM2.5"},
    6: {"zone": "Velachery", "aqi_base": 178, "dominant": "PM10"},
    7: {"zone": "Anna Nagar", "aqi_base": 210, "dominant": "PM2.5"},
    8: {"zone": "Bandra", "aqi_base": 156, "dominant": "PM2.5"},
    9: {"zone": "Andheri", "aqi_base": 189, "dominant": "PM10"},
    10: {"zone": "Dadar", "aqi_base": 165, "dominant": "PM2.5"},
    11: {"zone": "Borivali", "aqi_base": 140, "dominant": "PM10"},
    12: {"zone": "Connaught Place", "aqi_base": 387, "dominant": "PM2.5"},
    13: {"zone": "Lajpat Nagar", "aqi_base": 342, "dominant": "PM10"},
    14: {"zone": "Rohini", "aqi_base": 310, "dominant": "PM2.5"},
    15: {"zone": "Dwarka", "aqi_base": 280, "dominant": "PM2.5"},
    16: {"zone": "Hyderabad Central", "aqi_base": 145, "dominant": "PM2.5"},
    17: {"zone": "Banjara Hills", "aqi_base": 160, "dominant": "PM10"},
    18: {"zone": "Secunderabad", "aqi_base": 130, "dominant": "PM2.5"},
    19: {"zone": "Koregaon Park", "aqi_base": 155, "dominant": "PM10"},
    20: {"zone": "Kothrud", "aqi_base": 135, "dominant": "PM2.5"},
    21: {"zone": "Park Street", "aqi_base": 195, "dominant": "PM2.5"},
    22: {"zone": "Salt Lake", "aqi_base": 175, "dominant": "PM10"},
}

# ─── Social disruption signals (pre-configured high-confidence zones) ────────
_SOCIAL_SIGNALS = {
    5: {
        "zone": "Adyar", "city": "Chennai", "event": "Chennai Bandh",
        "base_confidence": 91,
        "sources": [
            {"type": "government_notice", "title": "Chennai Corporation: Bandh declared Thursday", "weight": 35},
            {"type": "news_article", "title": "The Hindu: All-party bandh call for Thursday", "weight": 25},
            {"type": "twitter_trending", "title": "#ChennaiShutdown trending — 18k tweets", "weight": 20},
            {"type": "news_article", "title": "Times of India: Shops to remain shut", "weight": 11},
        ],
        "restaurant_closure_base": 87,
    },
    12: {
        "zone": "Connaught Place", "city": "Delhi", "event": "Delhi Bandh",
        "base_confidence": 83,
        "sources": [
            {"type": "news_article", "title": "NDTV: Delhi bandh called by trade unions", "weight": 25},
            {"type": "twitter_trending", "title": "#DelhiBandh trending — 12k tweets", "weight": 20},
            {"type": "news_article", "title": "Indian Express: Markets to stay closed", "weight": 25},
            {"type": "government_notice", "title": "Delhi Police advisory issued", "weight": 13},
        ],
        "restaurant_closure_base": 82,
    },
    8: {
        "zone": "Bandra", "city": "Mumbai", "event": "Mumbai Bandh",
        "base_confidence": 78,
        "sources": [
            {"type": "news_article", "title": "Mid-Day: Trade union bandh tomorrow", "weight": 25},
            {"type": "twitter_trending", "title": "#MumbaiBandh trending — 8k tweets", "weight": 18},
            {"type": "news_article", "title": "TOI: Commercial establishments to close", "weight": 22},
        ],
        "restaurant_closure_base": 81,
    },
}


def _noise(base: float, pct: float = 0.15) -> float:
    """Add ±pct random noise to a base value."""
    return round(base * (1 + random.uniform(-pct, pct)), 1)


def _ist_now() -> str:
    """Current IST timestamp as ISO string."""
    ist = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(ist).isoformat()


def _aqi_category(aqi: int) -> str:
    if aqi <= 50: return "Good"
    if aqi <= 100: return "Moderate"
    if aqi <= 150: return "Unhealthy for Sensitive Groups"
    if aqi <= 200: return "Unhealthy"
    if aqi <= 300: return "Very Unhealthy"
    return "Hazardous"


def _weather_condition(rainfall: float, wind: float) -> str:
    if rainfall > 80: return "Cyclonic Rain"
    if rainfall > 60: return "Thunderstorm with Heavy Rain"
    if rainfall > 40: return "Heavy Rain"
    if rainfall > 25: return "Moderate Rain"
    if wind > 45: return "Strong Wind Advisory"
    return "Light Rain"


# ─── Public API functions ────────────────────────────────────────────────────

def fetch_weather(zone_id: int) -> dict:
    """
    Simulates OpenWeatherMap + Tomorrow.io response for a zone.
    Adds ±15% noise on each call so responses vary.
    """
    profile = _WEATHER_PROFILES.get(zone_id, {
        "zone": f"Zone-{zone_id}", "city": "Unknown",
        "station": f"IMD_GEN_{zone_id}",
        "rainfall_base": 55.0, "wind_base": 35.0, "temp_base": 32,
    })

    rainfall = _noise(profile["rainfall_base"])
    wind = _noise(profile["wind_base"])
    temp = round(profile["temp_base"] + random.uniform(-2, 3))
    humidity = random.randint(65, 95)
    sustained = round(random.uniform(1.0, 3.5), 1)

    return {
        "source": "openweathermap.org + tomorrow.io",
        "station_id": profile["station"],
        "fetched_at": _ist_now(),
        "zone_id": zone_id,
        "zone": profile["zone"],
        "city": profile["city"],
        "rainfall_mm": rainfall,
        "wind_kmh": wind,
        "temperature": temp,
        "humidity_pct": humidity,
        "condition": _weather_condition(rainfall, wind),
        "sustained_hours": sustained,
        "pressure_hpa": random.randint(998, 1015),
        "visibility_km": round(random.uniform(1.5, 8.0), 1),
        "data_confidence": round(random.uniform(0.88, 0.97), 2),
    }


def fetch_aqi(zone_id: int) -> dict:
    """
    Simulates IQAir / CPCB response for a zone.
    Adds ±15% noise on each call.
    """
    profile = _AQI_PROFILES.get(zone_id, {
        "zone": f"Zone-{zone_id}", "aqi_base": 320, "dominant": "PM2.5",
    })

    aqi = int(_noise(profile["aqi_base"]))
    sustained = round(random.uniform(2.0, 4.5), 1)
    pm25 = round(aqi * random.uniform(0.8, 1.2))
    pm10 = round(aqi * random.uniform(1.0, 1.5))

    return {
        "source": "iqair.com + cpcb.nic.in",
        "station_id": f"CPCB_{profile['zone'].upper().replace(' ', '_')}",
        "fetched_at": _ist_now(),
        "zone_id": zone_id,
        "zone": profile["zone"],
        "aqi": aqi,
        "dominant": profile["dominant"],
        "category": _aqi_category(aqi),
        "pm25": pm25,
        "pm10": pm10,
        "no2": random.randint(20, 80),
        "o3": random.randint(15, 60),
        "sustained_hours": sustained,
        "data_confidence": round(random.uniform(0.90, 0.98), 2),
    }


def fetch_platform_status(platform: str) -> dict:
    """
    Simulates DownDetector + custom health-ping response.
    Adds noise to report counts.
    """
    key = platform.lower()
    is_zomato = key == "zomato"

    reports = int(_noise(4800 if is_zomato else 2100))
    regions = (
        ["Mumbai", "Delhi", "Bengaluru", "Chennai"]
        if is_zomato
        else ["Bengaluru", "Hyderabad", "Pune"]
    )

    return {
        "source": f"downdetector.in/status/{key}",
        "fetched_at": _ist_now(),
        "platform": platform.capitalize(),
        "status": "partial_outage",
        "outage_duration_min": 0,  # overridden by user input in trigger engine
        "reports_last_hour": reports,
        "report_spike_pct": round(random.uniform(340, 820), 1),
        "affected_regions": random.sample(regions, k=min(len(regions), random.randint(2, len(regions)))),
        "api_latency_ms": random.randint(8000, 30000),
        "status_page": f"https://status.{key}.com",
        "data_confidence": round(random.uniform(0.92, 0.99), 2),
    }


def fetch_social_signals(zone_id: int) -> dict:
    """
    Simulates NewsAPI.org + Twitter/X trending response.
    Pre-configured zones (5, 12, 8) have high confidence.
    Others get moderate random confidence.
    """
    if zone_id in _SOCIAL_SIGNALS:
        profile = _SOCIAL_SIGNALS[zone_id]
        confidence = int(_noise(profile["base_confidence"], 0.05))
        closure = int(_noise(profile["restaurant_closure_base"], 0.05))
        sources = profile["sources"]
        event = profile["event"]
        zone_name = profile["zone"]
        city = profile["city"]
    else:
        zone_name = f"Zone-{zone_id}"
        city = "Unknown"
        event = "Civic Disruption"
        confidence = random.randint(76, 92)
        closure = random.randint(75, 90)
        sources = [
            {"type": "news_article", "title": f"Local bandh announced in {zone_name}", "weight": 25},
            {"type": "twitter_trending", "title": f"#{zone_name.replace(' ', '')}Shutdown trending", "weight": 20},
            {"type": "government_notice", "title": "District administration advisory issued", "weight": 35},
        ]

    tweets_count = random.randint(5000, 25000)

    return {
        "source": "newsapi.org + twitter/x trending",
        "fetched_at": _ist_now(),
        "zone_id": zone_id,
        "zone": zone_name,
        "city": city,
        "event": event,
        "confidence_pct": confidence,
        "sources": sources,
        "twitter_volume": tweets_count,
        "restaurant_closure_pct": closure,
        "pre_armed": True,
        "signal_first_detected": (datetime.now(timezone.utc) - timedelta(hours=random.randint(8, 14))).isoformat(),
        "data_confidence": round(random.uniform(0.85, 0.95), 2),
    }
