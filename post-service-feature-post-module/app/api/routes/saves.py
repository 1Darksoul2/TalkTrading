from typing import List
from app.core.visibility import require_viewable_post
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.security import get_current_user_id
from app.schemas.post import PostResponse
from app.services.save_service import (
    save_post,
    unsave_post,
    get_user_saved_posts,
)

router = APIRouter(
    tags=["Saves & Bookmarks"],
)


@router.post("/posts/{post_id}/save", dependencies=[Depends(require_viewable_post)])
def add_save(
    post_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Save/Bookmark a post. Database enforces UNIQUE(user_id, post_id)."""
    result = save_post(db=db, post_id=post_id, user_id=current_user_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found or inactive",
        )

    if result == "already_saved":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Post already saved by this user",
        )

    return {"message": "Post saved successfully"}


@router.delete("/posts/{post_id}/save")
def remove_save(
    post_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Remove a post from saved posts."""
    result = unsave_post(db=db, post_id=post_id, user_id=current_user_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Save relationship not found for this post",
        )

    return {"message": "Post removed from saved successfully"}


@router.get("/users/me/saved-posts", response_model=List[PostResponse])
def list_saved_posts(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """List saved posts for the authenticated user."""
    posts, _ = get_user_saved_posts(db=db, user_id=current_user_id, page=page, limit=limit)
    return posts
