from typing import List

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.follow import Follow
from app.models.notification import NotificationType
from app.services import notification_service


def is_following(db: Session, follower_id: int, following_id: int) -> bool:
    return (
        db.query(Follow.id)
        .filter(Follow.follower_id == follower_id, Follow.following_id == following_id)
        .first()
        is not None
    )


def follow_user(db: Session, follower_id: int, target_id: int) -> None:
    if follower_id == target_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot follow yourself")
    if is_following(db, follower_id, target_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already following this user")
    db.add(Follow(follower_id=follower_id, following_id=target_id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already following this user")
    notification_service.notify(db, target_id, follower_id, NotificationType.FOLLOW)


def unfollow_user(db: Session, follower_id: int, target_id: int) -> None:
    row = (
        db.query(Follow)
        .filter(Follow.follower_id == follower_id, Follow.following_id == target_id)
        .first()
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="You are not following this user")
    db.delete(row)
    db.commit()


def get_following_ids(db: Session, user_id: int) -> List[int]:
    rows = db.query(Follow.following_id).filter(Follow.follower_id == user_id).all()
    return [r[0] for r in rows]


def get_follower_ids(db: Session, user_id: int, page: int = 1, limit: int = 50) -> List[int]:
    rows = (
        db.query(Follow.follower_id)
        .filter(Follow.following_id == user_id)
        .order_by(Follow.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return [r[0] for r in rows]


def get_following_page(db: Session, user_id: int, page: int = 1, limit: int = 50) -> List[int]:
    rows = (
        db.query(Follow.following_id)
        .filter(Follow.follower_id == user_id)
        .order_by(Follow.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    return [r[0] for r in rows]


def get_stats(db: Session, user_id: int, viewer_id=None) -> dict:
    followers = db.query(Follow.id).filter(Follow.following_id == user_id).count()
    following = db.query(Follow.id).filter(Follow.follower_id == user_id).count()
    return {
        "user_id": user_id,
        "followers_count": followers,
        "following_count": following,
        "is_following": bool(viewer_id) and is_following(db, viewer_id, user_id),
        "follows_you": bool(viewer_id) and is_following(db, user_id, viewer_id),
    }
