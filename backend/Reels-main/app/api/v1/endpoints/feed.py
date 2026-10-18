from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.v1.deps import get_current_user_optional
from app.core.security import TokenData
from app.schemas.reel import FeedItemResponse
from app.schemas.common import APIResponse
from app.services.feed_service import FeedService

router = APIRouter()


@router.get("", response_model=APIResponse[List[FeedItemResponse]])
def get_feed(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=50, description="Items per page"),
    include_ads: bool = Query(True, description="Whether to include interleaved ads"),
    db: Session = Depends(get_db),
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """Paginated reel feed supporting anonymous viewers and personalized signals (likes/bookmarks)."""
    user_id = current_user.user_id if current_user else None
    items = FeedService.get_feed(
        db,
        current_user_id=user_id,
        page=page,
        page_size=page_size,
        include_ads=include_ads
    )
    return APIResponse(data=items)
