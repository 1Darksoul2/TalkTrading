from typing import List, Optional, Tuple
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_, and_, case

from app.core.visibility import viewable_filter
from app.models.post import Post, PostStatus, PostVisibility
from app.schemas.post import PostCreate, PostUpdate


class PostRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, post_id: int, include_non_active: bool = False) -> Optional[Post]:
        query = self.db.query(Post).options(selectinload(Post.media_items)).filter(Post.id == post_id)
        if not include_non_active:
            query = query.filter(Post.status == PostStatus.ACTIVE)
        return query.first()

    def create(self, post_data: PostCreate, author_id: int, commit: bool = True) -> Post:
        db_post = Post(
            author_id=author_id,
            caption=post_data.caption,
            visibility=post_data.visibility,
            status=PostStatus.ACTIVE,
        )
        self.db.add(db_post)
        if commit:
            self.db.commit()
            self.db.refresh(db_post)
        else:
            self.db.flush()
        return db_post

    def update(self, db_post: Post, post_data: PostUpdate, commit: bool = True) -> Post:
        if post_data.caption is not None:
            db_post.caption = post_data.caption
        if post_data.visibility is not None:
            db_post.visibility = post_data.visibility
        if post_data.status is not None:
            db_post.status = post_data.status

        if commit:
            self.db.commit()
            self.db.refresh(db_post)
        else:
            self.db.flush()
        return db_post

    def delete(self, db_post: Post, soft_delete: bool = True, commit: bool = True) -> bool:
        if soft_delete:
            db_post.status = PostStatus.DELETED
        else:
            self.db.delete(db_post)

        if commit:
            self.db.commit()
        else:
            self.db.flush()
        return True

    def get_all(
        self,
        author_id: Optional[int] = None,
        search: str = "",
        visibility: Optional[PostVisibility] = None,
        status: PostStatus = PostStatus.ACTIVE,
        page: int = 1,
        limit: int = 10,
        viewer_id: Optional[int] = None,
    ) -> Tuple[List[Post], int]:
        query = self.db.query(Post).options(selectinload(Post.media_items)).filter(Post.status == status)

        query = query.filter(viewable_filter(viewer_id))

        if author_id is not None:
            query = query.filter(Post.author_id == author_id)

        if visibility is not None:
            query = query.filter(Post.visibility == visibility)

        if search:
            query = query.filter(Post.caption.ilike(f"%{search}%"))

        total = query.count()
        offset = (page - 1) * limit
        posts = (
            query.order_by(Post.created_at.desc(), Post.id.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return posts, total

    def increment_counter(self, post_id: int, field_name: str, delta: int = 1, commit: bool = True):
        """Atomic increment/decrement for denormalized counters preventing negative values."""
        if field_name in ["like_count", "comment_count", "save_count", "share_count"]:
            col = getattr(Post, field_name)
            new_val = case((col + delta < 0, 0), else_=col + delta)
            self.db.query(Post).filter(Post.id == post_id).update(
                {field_name: new_val},
                synchronize_session=False,
            )
            if commit:
                self.db.commit()
            else:
                self.db.flush()
