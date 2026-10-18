from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.database.database import get_db
from app.models.user import User
from app.services.like_service import (
    like_post,
    unlike_post,
    like_count,
)

router = APIRouter(
    prefix="/likes",
    tags=["Likes"],
)


@router.post("/{post_id}")
def like(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = like_post(
        db,
        post_id,
        current_user,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Post not found",
        )

    if result == "already":
        raise HTTPException(
            status_code=400,
            detail="Already liked",
        )

    return {"message": "Post liked"}


@router.delete("/{post_id}")
def unlike(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = unlike_post(
        db,
        post_id,
        current_user,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Like not found",
        )

    return {"message": "Like removed"}


@router.get("/{post_id}")
def count(
    post_id: int,
    db: Session = Depends(get_db),
):
    return {
        "likes": like_count(
            db,
            post_id,
        )
    }