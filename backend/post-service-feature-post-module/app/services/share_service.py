from typing import Union
from sqlalchemy.orm import Session

from app.models.share import Share
from app.models.post import PostStatus
from app.repositories.share_repository import ShareRepository
from app.repositories.post_repository import PostRepository


def share_post(
    db: Session,
    post_id: int,
    user_id: int,
) -> Union[Share, None]:
    post_repo = PostRepository(db)
    post = post_repo.get_by_id(post_id)

    if post is None or post.status != PostStatus.ACTIVE:
        return None

    share_repo = ShareRepository(db)
    try:
        # Atomic Transaction: Create share + increment counter in single transaction boundary
        share = share_repo.create(post_id=post_id, user_id=user_id, commit=False)
        post_repo.increment_counter(post_id, "share_count", delta=1, commit=False)
        db.commit()
        db.refresh(share)
        return share
    except Exception:
        db.rollback()
        raise
