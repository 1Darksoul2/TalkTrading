from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.comment import (
    CommentCreate,
    CommentResponse,
)
from app.services.comment_service import (
    add_comment,
    get_comments,
    delete_comment,
)

router = APIRouter(
    prefix="/comments",
    tags=["Comments"],
)


@router.post("/{post_id}", response_model=CommentResponse)
def create_comment(
    post_id: int,
    comment: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = add_comment(
        db,
        post_id,
        comment.content,
        current_user,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Post not found",
        )

    return result


@router.get("/{post_id}", response_model=list[CommentResponse])
def read_comments(
    post_id: int,
    db: Session = Depends(get_db),
):
    return get_comments(
        db,
        post_id,
    )


@router.delete("/{comment_id}")
def remove_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = delete_comment(
        db,
        comment_id,
        current_user,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Comment not found",
        )

    if result == "forbidden":
        raise HTTPException(
            status_code=403,
            detail="Not allowed",
        )

    return {
        "message": "Comment deleted"
    }