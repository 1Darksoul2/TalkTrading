from sqlalchemy.orm import Session
from app.models.share import Share


class ShareRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, post_id: int, user_id: int, commit: bool = True) -> Share:
        share = Share(post_id=post_id, user_id=user_id)
        self.db.add(share)
        if commit:
            self.db.commit()
            self.db.refresh(share)
        else:
            self.db.flush()
        return share

    def count_by_post_id(self, post_id: int) -> int:
        return self.db.query(Share).filter(Share.post_id == post_id).count()
