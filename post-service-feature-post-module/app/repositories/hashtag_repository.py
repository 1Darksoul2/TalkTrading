from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.hashtag import Hashtag, post_hashtags
from app.models.post import Post, PostStatus, PostVisibility


class HashtagRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_or_create(self, tag: str) -> Hashtag:
        clean_tag = tag.lower().strip("#")
        existing = self.db.query(Hashtag).filter(Hashtag.tag == clean_tag).first()
        if existing:
            return existing

        hashtag = Hashtag(tag=clean_tag)
        try:
            self.db.add(hashtag)
            self.db.commit()
            self.db.refresh(hashtag)
            return hashtag
        except IntegrityError:
            self.db.rollback()
            return self.db.query(Hashtag).filter(Hashtag.tag == clean_tag).first()

    def link_post_to_hashtags(self, post: Post, tags: List[str]):
        hashtags = [self.get_or_create(tag) for tag in set(tags)]
        post.hashtags = hashtags
        self.db.commit()

    def get_posts_by_hashtag(self, tag: str, page: int = 1, limit: int = 10) -> Tuple[List[Post], int]:
        clean_tag = tag.lower().strip("#")
        hashtag = self.db.query(Hashtag).filter(Hashtag.tag == clean_tag).first()
        if not hashtag:
            return [], 0

        query = (
            self.db.query(Post)
            .join(post_hashtags, post_hashtags.c.post_id == Post.id)
            .filter(
                post_hashtags.c.hashtag_id == hashtag.id,
                Post.status == PostStatus.ACTIVE,
                Post.visibility == PostVisibility.PUBLIC,
            )
        )
        total = query.count()
        offset = (page - 1) * limit
        posts = query.order_by(Post.created_at.desc()).offset(offset).limit(limit).all()
        return posts, total
