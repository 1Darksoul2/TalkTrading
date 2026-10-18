from app.core.visibility import require_viewable_post
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.security import get_current_user_id
from app.services.like_service import (
    like_post,
    unlike_post,
    get_like_count,
)

router = APIRouter(
    prefix="/posts",
    tags=["Likes"],
)


@router.post("/{post_id}/likes", dependencies=[Depends(require_viewable_post)])
def add_like(
    post_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Like a post. Database enforces UNIQUE(user_id, post_id)."""
    result = like_post(db=db, post_id=post_id, user_id=current_user_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found or inactive",
        )

    if result == "already_liked":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Post already liked by this user",
        )

    return {"message": "Post liked successfully"}


@router.delete("/{post_id}/likes", dependencies=[Depends(require_viewable_post)])
def remove_like(
    post_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Unlike a post. Idempotent operation."""
    result = unlike_post(db=db, post_id=post_id, user_id=current_user_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Like relationship not found for this post",
        )

    return {"message": "Like removed successfully"}


@router.get("/{post_id}/likes/count", dependencies=[Depends(require_viewable_post)])
def read_like_count(
    post_id: int,
    db: Session = Depends(get_db),
):
    """Get total like count for a post."""
    return {"post_id": post_id, "like_count": get_like_count(db=db, post_id=post_id)}
