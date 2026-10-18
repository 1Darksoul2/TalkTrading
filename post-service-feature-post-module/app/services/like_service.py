from typing import Union
from sqlalchemy.orm import Session

from app.models.post import PostStatus
from app.repositories.like_repository import LikeRepository
from app.models.notification import NotificationType
from app.repositories.post_repository import PostRepository
from app.services import notification_service


def like_post(
    db: Session,
    post_id: int,
    user_id: int,
) -> Union[bool, str, None]:
    post_repo = PostRepository(db)
    post = post_repo.get_by_id(post_id)

    if post is None or post.status != PostStatus.ACTIVE:
        return None

    like_repo = LikeRepository(db)
    existing = like_repo.get_like(post_id=post_id, user_id=user_id)
    if existing:
        return "already_liked"

    try:
        # Atomic Transaction: Create like + increment counter in a single transaction boundary
        like = like_repo.create(post_id=post_id, user_id=user_id, commit=False)
        if not like:
            db.rollback()
            return "already_liked"

        post_repo.increment_counter(post_id, "like_count", delta=1, commit=False)
        db.commit()
        notification_service.notify(db, post.author_id, user_id, NotificationType.LIKE, post_id=post_id)
        return True
    except Exception:
        db.rollback()
        raise


def unlike_post(
    db: Session,
    post_id: int,
    user_id: int,
) -> Union[bool, None]:
    like_repo = LikeRepository(db)
    like = like_repo.get_like(post_id=post_id, user_id=user_id)

    if like is None:
        return None

    try:
        # Atomic Transaction: Delete like + decrement counter in a single transaction boundary
        like_repo.delete(like, commit=False)
        post_repo = PostRepository(db)
        post_repo.increment_counter(post_id, "like_count", delta=-1, commit=False)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


def get_like_count(
    db: Session,
    post_id: int,
) -> int:
    like_repo = LikeRepository(db)
    return like_repo.count_by_post_id(post_id)