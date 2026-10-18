from typing import List, Tuple
from sqlalchemy.orm import Session

from app.models.post import Post
from app.repositories.hashtag_repository import HashtagRepository


def get_posts_by_hashtag(
    db: Session,
    tag: str,
    page: int = 1,
    limit: int = 10,
) -> Tuple[List[Post], int]:
    repo = HashtagRepository(db)
    return repo.get_posts_by_hashtag(tag=tag, page=page, limit=limit)
