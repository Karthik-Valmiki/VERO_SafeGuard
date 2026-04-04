"""
Mock external API responses for demo.
Simulates OpenWeatherMap, IQAir, DownDetector, and NewsAPI
so the trigger engine has realistic third-party data without live keys.
"""

import random
from datetime import datetime, timezone

# ── Realistic zone-level weather data ─────────────────
ZONE_WEATHER = {
    # Chennai zones
    1: {
        "zone": "Adyar",
        "city": "Chennai",
        "rainfall_mm": 72.4,
        "wind_kmh": 38.2,
        "condition": "Heavy Rain",
    },
    2: {
        "zone": "Velachery",
        "city": "Chennai",
        "rainfall_mm": 68.1,
        "wind_kmh": 41.5,
        "condition": "Hailstorm",
    },
    3: {
        "zone": "T.Nagar",
        "city": "Chennai",
        "rainfall_mm": 12.0,
        "wind_kmh": 18.0,
        "condition": "Light Rain",
    },
    4: {
        "zone": "Mylapore",
        "city": "Chennai",
        "rainfall_mm": 8.5,
        "wind_kmh": 14.0,
        "condition": "Cloudy",
    },
    5: {
        "zone": "Anna Nagar",
        "city": "Chennai",
        "rainfall_mm": 55.3,
        "wind_kmh": 43.0,
        "condition": "Heavy Rain",
    },
    # Delhi zones
    6: {
        "zone": "Connaught Place",
        "city": "Delhi",
        "rainfall_mm": 61.0,
        "wind_kmh": 47.0,
        "condition": "Thunderstorm",
    },
    7: {
        "zone": "Lajpat Nagar",
        "city": "Delhi",
        "rainfall_mm": 44.0,
        "wind_kmh": 35.0,
        "condition": "Heavy Rain",
    },
    # Mumbai zones
    8: {
        "zone": "Bandra",
        "city": "Mumbai",
        "rainfall_mm": 88.0,
        "wind_kmh": 52.0,
        "condition": "Cyclonic Rain",
    },
    9: {
        "zone": "Andheri",
        "city": "Mumbai",
        "rainfall_mm": 76.5,
        "wind_kmh": 49.0,
        "condition": "Heavy Rain",
    },
}

# ── AQI data ────────────────────────────────────────────
ZONE_AQI = {
    1: {
        "zone": "Adyar",
        "aqi": 142,
        "dominant": "PM2.5",
        "category": "Unhealthy for Sensitive",
    },
    2: {"zone": "Velachery", "aqi": 178, "dominant": "PM10", "category": "Unhealthy"},
    3: {"zone": "T.Nagar", "aqi": 95, "dominant": "PM2.5", "category": "Moderate"},
    4: {"zone": "Mylapore", "aqi": 88, "dominant": "NO2", "category": "Moderate"},
    5: {
        "zone": "Anna Nagar",
        "aqi": 210,
        "dominant": "PM2.5",
        "category": "Very Unhealthy",
    },
    6: {
        "zone": "Connaught Place",
        "aqi": 387,
        "dominant": "PM2.5",
        "category": "Hazardous",
    },
    7: {
        "zone": "Lajpat Nagar",
        "aqi": 342,
        "dominant": "PM10",
        "category": "Hazardous",
    },
    8: {"zone": "Bandra", "aqi": 156, "dominant": "PM2.5", "category": "Unhealthy"},
    9: {"zone": "Andheri", "aqi": 189, "dominant": "PM10", "category": "Unhealthy"},
}

# ── Platform uptime data ─────────────────────────────────
PLATFORM_STATUS = {
    "zomato": {
        "platform": "Zomato",
        "status": "partial_outage",
        "outage_duration_min": 67,
        "reports_last_hour": 4821,
        "affected_regions": ["Chennai", "Bengaluru"],
        "source": "downdetector.in/status/zomato",
    },
    "swiggy": {
        "platform": "Swiggy",
        "status": "operational",
        "outage_duration_min": 0,
        "reports_last_hour": 43,
        "affected_regions": [],
        "source": "downdetector.in/status/swiggy",
    },
}

# ── Social disruption signals ───────────────────────
SOCIAL_SIGNALS = {
    1: {
        "zone": "Adyar",
        "city": "Chennai",
        "event": "Chennai Bandh",
        "confidence_pct": 91,
        "sources": [
            {
                "type": "government_notice",
                "title": "Chennai Corporation: Bandh declared Thursday",
                "weight": 35,
            },
            {
                "type": "news_article",
                "title": "Hindu: All-party bandh call for Thursday",
                "weight": 25,
            },
            {
                "type": "twitter_trending",
                "title": "#ChennaiShutdown trending — 18k tweets",
                "weight": 20,
            },
            {
                "type": "news_article",
                "title": "Times of India: Shops to remain shut",
                "weight": 11,
            },
        ],
        "restaurant_closure_pct": 87,
        "pre_armed": True,
    },
    6: {
        "zone": "Connaught Place",
        "city": "Delhi",
        "event": "Delhi Bandh",
        "confidence_pct": 83,
        "sources": [
            {
                "type": "news_article",
                "title": "NDTV: Delhi bandh called by trade unions",
                "weight": 25,
            },
            {
                "type": "twitter_trending",
                "title": "#DelhiBandh trending — 9k tweets",
                "weight": 20,
            },
            {
                "type": "news_article",
                "title": "Indian Express: Markets to stay closed",
                "weight": 25,
            },
            {
                "type": "news_article",
                "title": "Hindustan Times: Bandh impact expected",
                "weight": 13,
            },
        ],
        "restaurant_closure_pct": 74,
        "pre_armed": True,
    },
}


def fetch_weather(zone_id: int) -> dict:
    """Simulates OpenWeatherMap + Tomorrow.io response for a zone."""
    base = ZONE_WEATHER.get(
        zone_id,
        {
            "zone": f"Zone-{zone_id}",
            "city": "Unknown",
            "rainfall_mm": round(random.uniform(50, 90), 1),
            "wind_kmh": round(random.uniform(38, 55), 1),
            "condition": "Heavy Rain",
        },
    )

    temperature = (
        random.randint(38, 45) if zone_id in [6, 7] else random.randint(25, 35)
    )

    return {
        "source": "openweathermap.org + tomorrow.io",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "zone_id": zone_id,
        **base,
        "temperature": temperature,
        "sustained_hours": round(random.uniform(1.0, 3.0), 1),
    }


def fetch_aqi(zone_id: int) -> dict:
    """Simulates IQAir / CPCB response for a zone."""
    base = ZONE_AQI.get(
        zone_id,
        {
            "zone": f"Zone-{zone_id}",
            "aqi": random.randint(300, 420),
            "dominant": "PM2.5",
            "category": "Hazardous",
        },
    )
    return {
        "source": "iqair.com + cpcb.nic.in",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "zone_id": zone_id,
        **base,
        "sustained_hours": round(random.uniform(2.0, 4.0), 1),
    }


def fetch_platform_status(platform: str) -> dict:
    """Simulates DownDetector + custom health-ping response."""
    key = platform.lower()
    base = PLATFORM_STATUS.get(
        key,
        {
            "platform": platform,
            "status": "partial_outage",
            "outage_duration_min": 52,
            "reports_last_hour": 2100,
            "affected_regions": ["Unknown"],
            "source": "downdetector.in",
        },
    )
    return {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        **base,
    }


def fetch_social_signals(zone_id: int) -> dict:
    """Simulates NewsAPI.org + Twitter/X trending response."""
    base = SOCIAL_SIGNALS.get(
        zone_id,
        {
            "zone": f"Zone-{zone_id}",
            "city": "Unknown",
            "event": "Civic Disruption",
            "confidence_pct": random.randint(76, 92),
            "sources": [
                {
                    "type": "news_article",
                    "title": "Local bandh announced",
                    "weight": 25,
                },
                {
                    "type": "twitter_trending",
                    "title": "Shutdown trending",
                    "weight": 20,
                },
                {
                    "type": "government_notice",
                    "title": "Official notice issued",
                    "weight": 35,
                },
            ],
            "restaurant_closure_pct": random.randint(75, 90),
            "pre_armed": True,
        },
    )
    return {
        "source": "newsapi.org + twitter/x trending",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "zone_id": zone_id,
        **base,
    }
