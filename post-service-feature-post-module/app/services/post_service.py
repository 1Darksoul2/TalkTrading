import re
from typing import List, Optional, Tuple, Union
from sqlalchemy.orm import Session

from app.models.post import Post, PostStatus, PostVisibility
from app.schemas.post import PostCreate, PostUpdate
from app.repositories.post_repository import PostRepository
from app.repositories.hashtag_repository import HashtagRepository
from app.services import mention_service


def extract_hashtags(text: str) -> List[str]:
    if not text:
        return []
    return re.findall(r"#(\w+)", text)


def create_post(db: Session, post_data: PostCreate, author_id: int) -> Post:
    repo = PostRepository(db)
    post = repo.create(post_data=post_data, author_id=author_id)

    # Extract and store hashtags if caption present
    if post_data.caption:
        tags = extract_hashtags(post_data.caption)
        if tags:
            hashtag_repo = HashtagRepository(db)
            hashtag_repo.link_post_to_hashtags(post, tags)

    mention_service.sync_mentions(db, post_data.caption, author_id, post_id=post.id)
    return post


def get_post_by_id(db: Session, post_id: int) -> Optional[Post]:
    repo = PostRepository(db)
    return repo.get_by_id(post_id)


def get_all_posts(
    db: Session,
    author_id: Optional[int] = None,
    search: str = "",
    visibility: Optional[PostVisibility] = None,
    page: int = 1,
    limit: int = 10,
    viewer_id: Optional[int] = None,
) -> Tuple[List[Post], int]:
    repo = PostRepository(db)
    return repo.get_all(
        author_id=author_id,
        search=search,
        visibility=visibility,
        page=page,
        limit=limit,
        viewer_id=viewer_id,
    )


def update_post(
    db: Session,
    post_id: int,
    post_data: PostUpdate,
    current_user_id: int,
) -> Union[Post, str, None]:
    repo = PostRepository(db)
    post = repo.get_by_id(post_id, include_non_active=True)

    if post is None or post.status == PostStatus.DELETED:
        return None

    if post.author_id != current_user_id:
        return "forbidden"

    updated = repo.update(post, post_data)

    # Re-extract hashtags if caption updated
    if post_data.caption is not None:
        tags = extract_hashtags(post_data.caption)
        hashtag_repo = HashtagRepository(db)
        hashtag_repo.link_post_to_hashtags(updated, tags)
        mention_service.sync_mentions(db, post_data.caption, current_user_id, post_id=updated.id)

    return updated


def delete_post(
    db: Session,
    post_id: int,
    current_user_id: int,
) -> Union[bool, str, None]:
    repo = PostRepository(db)
    post = repo.get_by_id(post_id, include_non_active=True)

    if post is None or post.status == PostStatus.DELETED:
        return None

    if post.author_id != current_user_id:
        return "forbidden"

    return repo.delete(post, soft_delete=True)