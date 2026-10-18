from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user_id, get_optional_user_id
from app.database.database import get_db
from app.services import follow_service, profile_service

router = APIRouter(prefix="/users", tags=["Follows"])


@router.post("/{user_id}/follow", status_code=status.HTTP_201_CREATED)
def follow(
    user_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Follow a user (user_id is the integer id shown as a post's author_id)."""
    profile_service.require_by_author_id(db, user_id)  # 404 for unknown users
    follow_service.follow_user(db, current_user_id, user_id)
    return follow_service.get_stats(db, user_id, current_user_id)


@router.delete("/{user_id}/follow")
def unfollow(
    user_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    follow_service.unfollow_user(db, current_user_id, user_id)
    return follow_service.get_stats(db, user_id, current_user_id)


@router.get("/{user_id}/follow-stats")
def follow_stats(
    user_id: int,
    db: Session = Depends(get_db),
    current_user_id: Optional[int] = Depends(get_optional_user_id),
):
    """Follower / following counts plus whether the caller follows this user."""
    return follow_service.get_stats(db, user_id, current_user_id)


@router.get("/{user_id}/followers")
def followers(
    user_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    ids = follow_service.get_follower_ids(db, user_id, page, limit)
    people = profile_service.lookup(db, ids)
    return {"user_ids": ids, "users": [people[i] for i in ids if i in people]}


@router.get("/{user_id}/following")
def following(
    user_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    ids = follow_service.get_following_page(db, user_id, page, limit)
    people = profile_service.lookup(db, ids)
    return {"user_ids": ids, "users": [people[i] for i in ids if i in people]}
