from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database.database import get_db
from app.schemas.hashtag import HashtagPostsResponse
from app.services.hashtag_service import get_posts_by_hashtag

router = APIRouter(
    prefix="/hashtags",
    tags=["Hashtags"],
)


@router.get("/{hashtag}/posts", response_model=HashtagPostsResponse, status_code=status.HTTP_200_OK)
def list_posts_for_hashtag(
    hashtag: str,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Retrieve public active posts indexed under a hashtag."""
    posts, total = get_posts_by_hashtag(db=db, tag=hashtag, page=page, limit=limit)
    return HashtagPostsResponse(
        hashtag=hashtag.strip("#"),
        posts=posts,
        total=total,
    )
