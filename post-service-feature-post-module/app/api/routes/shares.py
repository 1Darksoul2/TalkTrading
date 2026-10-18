from app.core.visibility import require_viewable_post
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.security import get_current_user_id
from app.schemas.share import ShareResponse
from app.services.share_service import share_post

router = APIRouter(
    prefix="/posts",
    tags=["Shares"],
)


@router.post("/{post_id}/shares", response_model=ShareResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_viewable_post)])
def share_post_by_id(
    post_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Record a post share event and increment post share_count."""
    share = share_post(db=db, post_id=post_id, user_id=current_user_id)

    if share is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found or inactive",
        )

    return ShareResponse(
        id=share.id,
        post_id=share.post_id,
        user_id=share.user_id,
        created_at=share.created_at,
        share_count=share.post.share_count,
    )
