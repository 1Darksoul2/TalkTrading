from typing import List, Optional, Tuple
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError

from app.models.save import Save
from app.models.post import Post, PostStatus


class SaveRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_save(self, post_id: int, user_id: int) -> Optional[Save]:
        return (
            self.db.query(Save)
            .filter(Save.post_id == post_id, Save.user_id == user_id)
            .first()
        )

    def create(self, post_id: int, user_id: int, commit: bool = True) -> Optional[Save]:
        save = Save(post_id=post_id, user_id=user_id)
        try:
            self.db.add(save)
            if commit:
                self.db.commit()
                self.db.refresh(save)
            else:
                self.db.flush()
            return save
        except IntegrityError:
            self.db.rollback()
            return None

    def delete(self, save: Save, commit: bool = True) -> bool:
        self.db.delete(save)
        if commit:
            self.db.commit()
        else:
            self.db.flush()
        return True

    def get_user_saved_posts(
        self,
        user_id: int,
        page: int = 1,
        limit: int = 10,
    ) -> Tuple[List[Post], int]:
        query = (
            self.db.query(Post)
            .options(selectinload(Post.media_items))
            .join(Save, Save.post_id == Post.id)
            .filter(Save.user_id == user_id, Post.status == PostStatus.ACTIVE)
        )
        total = query.count()
        offset = (page - 1) * limit
        posts = query.order_by(Save.created_at.desc()).offset(offset).limit(limit).all()
        return posts, total
