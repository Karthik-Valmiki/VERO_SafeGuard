import json
import redis.asyncio as redis
from .config import settings

# Global Redis client instance
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

async def get_redis():
    """FastAPI dependency to get the redis client."""
    return redis_client

async def cache_get(key: str) -> str | None:
    """Get a raw string from cache."""
    try:
        return await redis_client.get(key)
    except Exception:
        return None

async def cache_set(key: str, value: str, ttl: int) -> None:
    """Set a raw string in cache with TTL."""
    try:
        await redis_client.setex(key, ttl, value)
    except Exception:
        pass

async def cache_delete(*keys: str) -> None:
    """Delete one or more keys from cache."""
    if not keys:
        return
    try:
        await redis_client.delete(*keys)
    except Exception:
        pass

async def cache_get_json(key: str) -> dict | None:
    """Get and deserialize JSON from cache."""
    val = await cache_get(key)
    if val:
        try:
            return json.loads(val)
        except json.JSONDecodeError:
            return None
    return None

async def cache_set_json(key: str, data: dict, ttl: int) -> None:
    """Serialize and set JSON in cache with TTL."""
    try:
        val = json.dumps(data)
        await cache_set(key, val, ttl)
    except Exception:
        pass
