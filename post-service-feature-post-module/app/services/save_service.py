from typing import List, Tuple, Union
from sqlalchemy.orm import Session

from app.models.post import Post, PostStatus
from app.repositories.save_repository import SaveRepository
from app.repositories.post_repository import PostRepository


def save_post(
    db: Session,
    post_id: int,
    user_id: int,
) -> Union[bool, str, None]:
    post_repo = PostRepository(db)
    post = post_repo.get_by_id(post_id)

    if post is None or post.status != PostStatus.ACTIVE:
        return None

    save_repo = SaveRepository(db)
    existing = save_repo.get_save(post_id=post_id, user_id=user_id)
    if existing:
        return "already_saved"

    try:
        # Atomic Transaction: Create save + increment counter in a single transaction boundary
        save = save_repo.create(post_id=post_id, user_id=user_id, commit=False)
        if not save:
            db.rollback()
            return "already_saved"

        post_repo.increment_counter(post_id, "save_count", delta=1, commit=False)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


def unsave_post(
    db: Session,
    post_id: int,
    user_id: int,
) -> Union[bool, None]:
    save_repo = SaveRepository(db)
    save = save_repo.get_save(post_id=post_id, user_id=user_id)

    if save is None:
        return None

    try:
        # Atomic Transaction: Delete save + decrement counter in a single transaction boundary
        save_repo.delete(save, commit=False)
        post_repo = PostRepository(db)
        post_repo.increment_counter(post_id, "save_count", delta=-1, commit=False)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


def get_user_saved_posts(
    db: Session,
    user_id: int,
    page: int = 1,
    limit: int = 10,
) -> Tuple[List[Post], int]:
    save_repo = SaveRepository(db)
    return save_repo.get_user_saved_posts(user_id=user_id, page=page, limit=limit)
