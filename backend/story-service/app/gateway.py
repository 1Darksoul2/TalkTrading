"""
Login check for the gateway (Caddy `forward_auth`).

Community and Explore identify the caller by a trusted `X-User-Id` header and expect a
gateway to set it. The gateway asks this endpoint about each request:

  - no Authorization header      -> 200, no X-User-Id   (anonymous; the gateway removes any
                                                          X-User-Id the browser sent)
  - valid login token            -> 200, X-User-Id = the account's numeric author id
  - invalid or expired token     -> 401                  (the request is refused)
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
import uuid

from .auth import _decode, derive_author_id

router = APIRouter()
_bearer = HTTPBearer(auto_error=False)


@router.get("/internal/gateway-auth", include_in_schema=False)
def gateway_auth(response: Response, credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer)):
    if credentials is None:
        return {"authenticated": False}
    try:
        user_id = uuid.UUID(_decode(credentials.credentials).get("sub", ""))
    except (JWTError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    response.headers["X-User-Id"] = str(derive_author_id(user_id))
    return {"authenticated": True}
