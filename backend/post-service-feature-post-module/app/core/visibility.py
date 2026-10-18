from typing import Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core.security import get_optional_user_id
from app.database.database import get_db
from app.models.follow import Follow
from app.models.post import Post, PostVisibility


def can_view(post: Post, viewer_id: Optional[int], db: Session) -> bool:
    """Public posts: everyone. Followers-only: the author and their followers.
    Private: the author only."""
    if post.visibility == PostVisibility.PUBLIC:
        return True
    if viewer_id is None:
        return False
    if post.author_id == viewer_id:
        return True
    if post.visibility == PostVisibility.FOLLOWERS:
        return (
            db.query(Follow.id)
            .filter(Follow.follower_id == viewer_id, Follow.following_id == post.author_id)
            .first()
            is not None
        )
    return False


def viewable_filter(viewer_id: Optional[int]):
    """SQLAlchemy condition equivalent of can_view(), for list/search queries."""
    conditions = [Post.visibility == PostVisibility.PUBLIC]
    if viewer_id is not None:
        conditions.append(Post.author_id == viewer_id)
        followed = select(Follow.following_id).where(Follow.follower_id == viewer_id)
        conditions.append(and_(Post.visibility == PostVisibility.FOLLOWERS, Post.author_id.in_(followed)))
    return or_(*conditions)


def require_viewable_post(
    post_id: int,
    db: Session = Depends(get_db),
    viewer_id: Optional[int] = Depends(get_optional_user_id),
) -> None:
    """Route dependency: hide posts the caller may not see behind a 404.

    A missing post is left to the route's own 404 handling, so existing
    responses for unknown ids are unchanged. 404 (not 403) is used for hidden
    posts so their existence is not revealed.
    """
    from app.repositories.post_repository import PostRepository  # lazy: repository imports this module

    post = PostRepository(db).get_by_id(post_id)
    if post is not None and not can_view(post, viewer_id, db):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found",
        )
