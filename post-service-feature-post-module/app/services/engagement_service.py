from typing import Optional
from sqlalchemy.orm import Session

from app.schemas.engagement import EngagementSummary
from app.repositories.post_repository import PostRepository
from app.repositories.like_repository import LikeRepository
from app.repositories.save_repository import SaveRepository


def get_post_engagement(
    db: Session,
    post_id: int,
    current_user_id: Optional[int] = None,
) -> Optional[EngagementSummary]:
    post_repo = PostRepository(db)
    post = post_repo.get_by_id(post_id)

    if post is None:
        return None

    is_liked = False
    is_saved = False

    if current_user_id:
        like_repo = LikeRepository(db)
        save_repo = SaveRepository(db)
        is_liked = like_repo.get_like(post_id, current_user_id) is not None
        is_saved = save_repo.get_save(post_id, current_user_id) is not None

    return EngagementSummary(
        post_id=post.id,
        like_count=post.like_count,
        comment_count=post.comment_count,
        save_count=post.save_count,
        share_count=post.share_count,
        is_liked_by_me=is_liked,
        is_saved_by_me=is_saved,
    )
