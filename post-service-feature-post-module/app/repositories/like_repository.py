from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.like import Like


class LikeRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_like(self, post_id: int, user_id: int) -> Optional[Like]:
        return (
            self.db.query(Like)
            .filter(Like.post_id == post_id, Like.user_id == user_id)
            .first()
        )

    def create(self, post_id: int, user_id: int, commit: bool = True) -> Optional[Like]:
        like = Like(post_id=post_id, user_id=user_id)
        try:
            self.db.add(like)
            if commit:
                self.db.commit()
                self.db.refresh(like)
            else:
                self.db.flush()
            return like
        except IntegrityError:
            self.db.rollback()
            return None

    def delete(self, like: Like, commit: bool = True) -> bool:
        self.db.delete(like)
        if commit:
            self.db.commit()
        else:
            self.db.flush()
        return True

    def count_by_post_id(self, post_id: int) -> int:
        return self.db.query(Like).filter(Like.post_id == post_id).count()
