from typing import List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.post import Post
from app.repositories.feed_repository import FeedRepository
from app.services.follow_service import get_following_ids


async def generate_feed(
    db: Session,
    current_user_id: Optional[int] = None,
    cursor_id: Optional[int] = None,
    page: int = 1,
    limit: int = 10,
    scope: str = "all",
) -> Tuple[List[Post], int, Optional[int], bool]:
    """scope="all": every post the viewer may see. scope="following": only the
    viewer's own posts and posts from accounts they follow (Instagram-style home
    feed); anonymous viewers have no following feed."""
    feed_repo = FeedRepository(db)

    author_ids = get_following_ids(db, current_user_id) if current_user_id else []

    only_authors = None
    if scope == "following":
        only_authors = ([current_user_id] if current_user_id else []) + author_ids

    return feed_repo.get_feed(
        current_user_id=current_user_id,
        author_ids=author_ids,
        only_authors=only_authors,
        cursor_id=cursor_id,
        page=page,
        limit=limit,
    )
