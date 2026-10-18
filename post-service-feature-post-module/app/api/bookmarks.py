from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.bookmark_service import (
    add_bookmark,
    remove_bookmark,
    my_bookmarks,
)

router = APIRouter(
    prefix="/bookmarks",
    tags=["Bookmarks"],
)


@router.post("/{post_id}")
def bookmark(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = add_bookmark(
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
            detail="Already bookmarked",
        )

    return {
        "message": "Bookmarked"
    }


@router.delete("/{post_id}")
def remove(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = remove_bookmark(
        db,
        post_id,
        current_user,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Bookmark not found",
        )

    return {
        "message": "Bookmark removed"
    }


@router.get("/")
def get_my_bookmarks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return my_bookmarks(
        db,
        current_user,
    )