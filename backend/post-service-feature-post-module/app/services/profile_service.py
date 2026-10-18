from typing import Dict, Iterable, List, Optional

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.visibility import viewable_filter
from app.integrations.storage import get_storage_provider
from app.models.post import Post, PostStatus
from app.models.user import User
from app.services import follow_service
from app.services.media_service import validate_magic_bytes

AVATAR_MAX_BYTES = 5 * 1024 * 1024
AVATAR_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp"}


def summary(user: User) -> dict:
    return {
        "uuid": user.id,  # the id chat and stories identify accounts by
        "author_id": user.author_id,
        "username": user.username,
        "display_name": user.display_name or user.username,
        "bio": user.bio or "",
        "avatar_url": user.avatar_url,
    }


def get_by_author_id(db: Session, author_id: int) -> Optional[User]:
    return db.query(User).filter(User.author_id == author_id).first()


def require_by_author_id(db: Session, author_id: int) -> User:
    user = get_by_author_id(db, author_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def get_by_username(db: Session, username: str) -> User:
    user = db.query(User).filter(func.lower(User.username) == username.lower()).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return user


def profile(db: Session, user: User, viewer_id: Optional[int]) -> dict:
    stats = follow_service.get_stats(db, user.author_id, viewer_id)
    posts = (
        db.query(Post.id)
        .filter(Post.author_id == user.author_id, Post.status == PostStatus.ACTIVE, viewable_filter(viewer_id))
        .count()
    )
    return {**summary(user), **stats, "posts_count": posts, "is_me": viewer_id == user.author_id}


def lookup(db: Session, ids: Iterable[int]) -> Dict[int, dict]:
    ids = list({int(i) for i in ids})[:100]
    if not ids:
        return {}
    users = db.query(User).filter(User.author_id.in_(ids)).all()
    return {u.author_id: summary(u) for u in users}


def search(db: Session, q: str, limit: int = 20) -> List[dict]:
    term = q.strip().lstrip("@")
    if not term:
        return []
    like = "%" + term.replace("%", r"\%").replace("_", r"\_") + "%"
    users = (
        db.query(User)
        .filter(User.author_id.isnot(None))
        .filter((User.username.ilike(like, escape="\\")) | (User.display_name.ilike(like, escape="\\")))
        .order_by(User.username)
        .limit(limit)
        .all()
    )
    users.sort(key=lambda u: (not u.username.lower().startswith(term.lower()), u.username.lower()))
    return [summary(u) for u in users]


def update_me(db: Session, user: User, display_name: Optional[str], bio: Optional[str]) -> User:
    if display_name is not None:
        name = display_name.strip()
        if not name:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Display name cannot be empty")
        user.display_name = name[:64]
    if bio is not None:
        user.bio = bio.strip()[:160]
    db.commit()
    db.refresh(user)
    return user


async def set_avatar(db: Session, user: User, file: UploadFile) -> User:
    content_type = file.content_type or ""
    if content_type not in AVATAR_TYPES:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail="Avatar must be a JPG, PNG, GIF or WebP image")
    content = await file.read()
    if len(content) > AVATAR_MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Avatar must be 5MB or smaller")
    if not validate_magic_bytes(content, content_type):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File content does not match its type")
    storage = get_storage_provider()
    _, url = await storage.upload(content, f"avatar{AVATAR_TYPES[content_type]}", content_type)
    user.avatar_url = url
    db.commit()
    db.refresh(user)
    return user
