from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.bookmark import Bookmark


class BookmarkRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_bookmark(self, post_id: int, user_id: int) -> Optional[Bookmark]:
        return (
            self.db.query(Bookmark)
            .filter(
                Bookmark.user_id == user_id,
                Bookmark.post_id == post_id,
            )
            .first()
        )

    def create(self, post_id: int, user_id: int) -> Bookmark:
        bookmark = Bookmark(
            user_id=user_id,
            post_id=post_id,
        )
        self.db.add(bookmark)
        self.db.commit()
        return bookmark

    def delete(self, bookmark: Bookmark) -> bool:
        self.db.delete(bookmark)
        self.db.commit()
        return True

    def get_user_bookmarks(self, user_id: int) -> List[Bookmark]:
        return (
            self.db.query(Bookmark)
            .filter(Bookmark.user_id == user_id)
            .all()
        )
