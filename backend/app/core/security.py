from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from ..db.database import get_db
from ..db import models
from .config import ALGORITHM, settings
from .redis import cache_get_json, cache_set_json

bearer_scheme = HTTPBearer()

async def get_current_rider(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> models.RiderProfile:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[ALGORITHM])
        rider_id: str = payload.get("sub")
        if rider_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    cache_key = f"rider:profile:{rider_id}"
    cached_data = await cache_get_json(cache_key)
    
    if cached_data:
        # Reconstruct detached SQLAlchemy instance
        return models.RiderProfile(**cached_data)

    result = await db.execute(
        select(models.RiderProfile).filter(models.RiderProfile.profile_id == rider_id)
    )
    rider = result.scalars().first()
    if rider is None:
        raise credentials_exception
        
    # Serialize for cache
    rider_dict = {
        col.name: getattr(rider, col.name) 
        for col in rider.__table__.columns
    }
    # Handle UUID and datetime serialization
    rider_dict["profile_id"] = str(rider_dict["profile_id"])
    if rider_dict.get("created_at"):
        rider_dict["created_at"] = rider_dict["created_at"].isoformat()
    if rider_dict.get("updated_at"):
        rider_dict["updated_at"] = rider_dict["updated_at"].isoformat()
        
    await cache_set_json(cache_key, rider_dict, 300)
    return rider

def verify_admin_key(x_admin_key: str = Header(default="")) -> str:
    """
    Protects admin endpoints with a shared API key sent via X-Admin-Key header.
    The key is configured server-side via ADMIN_API_KEY env var — never exposed
    in frontend source code.
    """
    if not x_admin_key or x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing admin API key",
        )
    return x_admin_key
