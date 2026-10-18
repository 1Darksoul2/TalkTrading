import secrets
from typing import Optional
from fastapi import Depends, HTTPException, Security, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import verify_token, TokenData
from app.core.config import settings

security_bearer = HTTPBearer(auto_error=False)


def get_current_user_optional(
    auth: Optional[HTTPAuthorizationCredentials] = Security(security_bearer)
) -> Optional[TokenData]:
    """Extracts user information strictly from verified JWT signature and claims.
    
    Header-based impersonation (e.g. X-User-Id) is strictly prohibited.
    Returns None if anonymous.
    """
    if not auth or not auth.credentials:
        return None
    token = auth.credentials
    payload = verify_token(token)
    if not payload:
        return None
    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id:
        return None
    return TokenData(
        user_id=str(user_id),
        roles=payload.get("roles", []),
        email=payload.get("email"),
        is_creator=payload.get("is_creator", False)
    )


def get_current_user(
    token_data: Optional[TokenData] = Depends(get_current_user_optional)
) -> TokenData:
    """Strict authentication dependency requiring a valid JWT."""
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing, expired, or invalid."
        )
    return token_data


def verify_service_api_key(
    x_service_api_key: Optional[str] = Header(None, alias="X-Service-API-Key")
):
    """Enforces Service-to-Service communication authorization using constant-time comparison."""
    if not x_service_api_key:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing Service-to-Service API Key."
        )
    # Timing-attack resistant constant time comparison
    if not secrets.compare_digest(x_service_api_key, settings.SERVICE_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Service-to-Service API Key."
        )
    return True
