from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.v1.deps import get_current_user
from app.core.security import TokenData
from app.schemas.comment import CommentCreate, CommentResponse
from app.schemas.common import APIResponse
from app.services.comment_service import CommentService

router = APIRouter()


@router.post("/{reel_id}/comments", response_model=APIResponse[CommentResponse], status_code=status.HTTP_201_CREATED)
def add_comment(
    reel_id: str,
    comment_in: CommentCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Post a comment or reply to a comment on a reel."""
    comment = CommentService.add_comment(
        db,
        reel_id=reel_id,
        user_id=current_user.user_id,
        comment_in=comment_in
    )
    return APIResponse(data=CommentResponse.model_validate(comment))


@router.get("/{reel_id}/comments", response_model=APIResponse[List[CommentResponse]])
def get_comments(
    reel_id: str,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Retrieve comments and nested replies for a reel."""
    comments = CommentService.get_comments(db, reel_id=reel_id, skip=skip, limit=limit)
    return APIResponse(data=[CommentResponse.model_validate(c) for c in comments])


@router.delete("/comments/{comment_id}", response_model=APIResponse[dict])
def delete_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Delete a comment (comment author, reel author, or admin)."""
    is_admin = "admin" in current_user.roles
    CommentService.delete_comment(db, comment_id=comment_id, user_id=current_user.user_id, is_admin=is_admin)
    return APIResponse(message="Comment deleted successfully")
