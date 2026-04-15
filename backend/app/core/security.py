from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Header, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from ..db.database import get_db
from ..db import models
from .config import SECRET_KEY, ALGORITHM, ADMIN_API_KEY

bearer_scheme = HTTPBearer()


def get_current_rider(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.RiderProfile:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        rider_id: str = payload.get("sub")
        if rider_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    rider = db.query(models.RiderProfile).filter(
        models.RiderProfile.profile_id == rider_id
    ).first()
    if rider is None:
        raise credentials_exception
    return rider


def verify_admin_key(x_admin_key: str = Header(default="")) -> str:
    """
    Protects admin endpoints with a shared API key sent via X-Admin-Key header.
    The key is configured server-side via ADMIN_API_KEY env var — never exposed
    in frontend source code.
    """
    if not x_admin_key or x_admin_key != ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid or missing admin API key",
        )
    return x_admin_key
