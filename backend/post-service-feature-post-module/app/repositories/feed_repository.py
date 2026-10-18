from typing import List, Optional, Tuple
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_, and_

from app.models.post import Post, PostStatus, PostVisibility


class FeedRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_feed(
        self,
        current_user_id: Optional[int] = None,
        author_ids: Optional[List[int]] = None,
        only_authors: Optional[List[int]] = None,
        cursor_id: Optional[int] = None,
        page: int = 1,
        limit: int = 10,
    ) -> Tuple[List[Post], int, Optional[int], bool]:
        # Eager load media items to prevent N+1 queries
        query = (
            self.db.query(Post)
            .options(selectinload(Post.media_items))
            .filter(Post.status == PostStatus.ACTIVE)
        )

        # Visibility filters
        visibility_conditions = [Post.visibility == PostVisibility.PUBLIC]
        if current_user_id:
            # Own private/follower posts
            visibility_conditions.append(Post.author_id == current_user_id)
        if author_ids:
            # Followers posts
            visibility_conditions.append(
                and_(Post.author_id.in_(author_ids), Post.visibility == PostVisibility.FOLLOWERS)
            )

        query = query.filter(or_(*visibility_conditions))

        if only_authors is not None:
            query = query.filter(Post.author_id.in_(only_authors))

        total = query.count()

        # Deterministic composite cursor pagination using (created_at, id)
        if cursor_id is not None:
            cursor_post = self.db.query(Post).filter(Post.id == cursor_id).first()
            if cursor_post:
                query = query.filter(
                    or_(
                        Post.created_at < cursor_post.created_at,
                        and_(
                            Post.created_at == cursor_post.created_at,
                            Post.id < cursor_post.id,
                        ),
                    )
                )

        posts = (
            query.order_by(Post.created_at.desc(), Post.id.desc())
            .limit(limit + 1)
            .all()
        )

        has_more = len(posts) > limit
        if has_more:
            posts = posts[:limit]
            next_cursor = posts[-1].id
        else:
            next_cursor = None

        return posts, total, next_cursor, has_more
