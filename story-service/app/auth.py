"""
JWT authentication helpers for the Story Service.

This module verifies JWTs issued by the TalkTrading login (the Post Service signs them).
Two modes:
  - AUTH_ENABLED=true  → verifies the Bearer token on every protected route
  - AUTH_ENABLED=false → returns a placeholder user_id (dev / testing mode)
"""
import uuid
import zlib
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from .config import settings

_bearer = HTTPBearer(auto_error=False)

_DEV_USER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


@dataclass(frozen=True)
class Principal:
    """The logged-in user. `token` is forwarded to the Post Service's public API to read the social graph."""
    user_id: uuid.UUID
    token: Optional[str] = None


def derive_author_id(user_id: uuid.UUID) -> int:
    """The Post Service's integer id for an account (same formula as the Post Service and the frontend)."""
    return (zlib.crc32(str(user_id).encode("utf-8")) % 900000) + 100


def _decode(token: str) -> dict:
    return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])


def get_principal(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Principal:
    """
    FastAPI dependency. Returns the authenticated user.
    If AUTH_ENABLED=false (local experiments only), everyone is one shared dev user.
    """
    if not settings.auth_enabled:
        return Principal(_DEV_USER_ID, credentials.credentials if credentials else None)

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    try:
        payload = _decode(credentials.credentials)
        return Principal(uuid.UUID(payload.get("sub", "")), credentials.credentials)
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def get_current_user_id(principal: Principal = Depends(get_principal)) -> uuid.UUID:
    """Just the user id, for endpoints that do not need the token."""
    return principal.user_id
