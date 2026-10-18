from typing import List, Optional
from app.core.visibility import can_view, require_viewable_post
from app.services.post_service import get_post_by_id
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.security import get_current_user_id, get_optional_user_id
from app.schemas.comment import (
    CommentCreate,
    CommentUpdate,
    CommentResponse,
    CommentTreeResponse,
)
from app.services.comment_service import (
    add_comment,
    get_comments_for_post,
    get_comment_by_id,
    update_comment,
    delete_comment,
)

router = APIRouter(
    tags=["Comments"],
)


@router.post("/posts/{post_id}/comments", response_model=CommentResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_viewable_post)])
def create_comment_for_post(
    post_id: int,
    comment: CommentCreate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Add a comment or nested reply (via parent_comment_id) to a post."""
    result = add_comment(db=db, post_id=post_id, comment_data=comment, author_id=current_user_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found or inactive",
        )

    if result == "invalid_parent":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid parent comment ID or parent comment belongs to a different post",
        )

    return result


@router.get("/posts/{post_id}/comments", response_model=List[CommentTreeResponse], dependencies=[Depends(require_viewable_post)])
def list_comments_for_post(
    post_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """List top-level comments and nested reply trees for a post."""
    return get_comments_for_post(db=db, post_id=post_id, page=page, limit=limit)


@router.get("/comments/{comment_id}", response_model=CommentResponse)
def read_comment_by_id(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user_id: Optional[int] = Depends(get_optional_user_id),
):
    """Get comment details by ID."""
    comment = get_comment_by_id(db=db, comment_id=comment_id)
    post = get_post_by_id(db, comment.post_id) if comment is not None else None
    # A comment on a post the caller cannot see is hidden exactly like a missing one.
    if comment is None or (post is not None and not can_view(post, current_user_id, db)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Comment with ID {comment_id} not found",
        )
    return comment


@router.put("/comments/{comment_id}", response_model=CommentResponse)
def edit_comment_content(
    comment_id: int,
    comment: CommentUpdate,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Update comment content. Restricted to comment author."""
    result = update_comment(db=db, comment_id=comment_id, comment_data=comment, current_user_id=current_user_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Comment with ID {comment_id} not found",
        )

    if result == "forbidden":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to modify this comment",
        )

    return result


@router.delete("/comments/{comment_id}")
def remove_comment_by_id(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Delete a comment. Restricted to comment author."""
    result = delete_comment(db=db, comment_id=comment_id, current_user_id=current_user_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Comment with ID {comment_id} not found",
        )

    if result == "forbidden":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this comment",
        )

    return {"message": "Comment deleted successfully"}
