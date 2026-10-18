from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.core.security import get_optional_user_id
from app.schemas.feed import FeedResponse
from app.services.feed_service import generate_feed

router = APIRouter(
    prefix="/feed",
    tags=["Feed"],
)


@router.get("/", response_model=FeedResponse, status_code=status.HTTP_200_OK)
async def read_user_feed(
    cursor_id: Optional[int] = Query(None, description="Cursor for pagination (ID of last post)"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    scope: str = Query("all", pattern="^(all|following)$", description="all = everything visible; following = you + people you follow"),
    db: Session = Depends(get_db),
    current_user_id: Optional[int] = Depends(get_optional_user_id),
):
    """Retrieve posts relevant to the user with visibility and status filtering."""
    posts, total, next_cursor, has_more = await generate_feed(
        db=db,
        current_user_id=current_user_id,
        cursor_id=cursor_id,
        page=page,
        limit=limit,
        scope=scope,
    )
    return FeedResponse(
        posts=posts,
        total=total,
        next_cursor=next_cursor,
        has_more=has_more,
    )
