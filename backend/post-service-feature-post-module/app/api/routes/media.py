from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.security import get_current_user_id
from app.schemas.media import MediaResponse
from app.services.media_service import add_media_to_post, delete_media

router = APIRouter(
    tags=["Media"],
)


@router.post("/posts/{post_id}/media", response_model=MediaResponse, status_code=status.HTTP_201_CREATED)
async def upload_post_media(
    post_id: int,
    file: UploadFile = File(...),
    position: int = Form(0),
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Upload and attach image/video media item to a post. Restricted to post author."""
    result = await add_media_to_post(
        db=db,
        post_id=post_id,
        file=file,
        current_user_id=current_user_id,
        position=position,
    )

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Post with ID {post_id} not found",
        )

    if result == "forbidden":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to attach media to this post",
        )

    return result


@router.delete("/media/{media_id}")
async def remove_post_media(
    media_id: int,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Delete a media item from storage and database. Restricted to post author."""
    result = await delete_media(db=db, media_id=media_id, current_user_id=current_user_id)

    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Media item with ID {media_id} not found",
        )

    if result == "forbidden":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to delete this media item",
        )

    return {"message": "Media item deleted successfully"}
