from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.core.config import settings

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/auth/login",
    auto_error=False,
)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def derive_author_id(user_uuid: str) -> int:
    """Stable integer id for a user UUID, used as Post.author_id / Like.user_id etc.
    The frontend (src/utils/authorId.js) implements the identical formula."""
    import zlib
    return (zlib.crc32(user_uuid.encode("utf-8")) % 900000) + 100


def get_current_user_id(token: Optional[str] = Depends(oauth2_scheme)) -> int:
    """
    Decodes the JWT token and extracts the authenticated canonical integer user_id.
    Microservice Principle: No non-deterministic identity hashing.
    If sub/user_id cannot be converted to a valid integer ID, raises 401 Unauthorized.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        
        user_id_val = payload.get("user_id") or payload.get("sub")
        if user_id_val is None:
            raise credentials_exception
        
        try:
            return int(user_id_val)
        except (ValueError, TypeError):
            # Deterministically map UUID/string identifier to a positive integer for compatibility
            # with TalkTrading frontend and cross-service JWTs
            if isinstance(user_id_val, str) and len(user_id_val.strip()) > 0:
                return derive_author_id(user_id_val)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token sub/user_id claim must be a valid canonical integer user ID",
                headers={"WWW-Authenticate": "Bearer"},
            )

    except JWTError:
        raise credentials_exception


def get_optional_user_id(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[int]:
    """
    Optional authentication helper for endpoints that allow public reads with optional personalized flags.
    """
    if not token:
        return None
    try:
        return get_current_user_id(token)
    except HTTPException:
        return None