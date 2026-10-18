from typing import List, Optional
from sqlalchemy.orm import Session

from app.models.media import Media, MediaType


class MediaRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        post_id: int,
        media_type: MediaType,
        storage_key: str,
        url: str,
        thumbnail_url: Optional[str] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
        duration: Optional[float] = None,
        position: int = 0,
    ) -> Media:
        media = Media(
            post_id=post_id,
            media_type=media_type,
            storage_key=storage_key,
            url=url,
            thumbnail_url=thumbnail_url,
            width=width,
            height=height,
            duration=duration,
            position=position,
        )
        self.db.add(media)
        self.db.commit()
        self.db.refresh(media)
        return media

    def get_by_id(self, media_id: int) -> Optional[Media]:
        return self.db.query(Media).filter(Media.id == media_id).first()

    def get_by_post_id(self, post_id: int) -> List[Media]:
        return (
            self.db.query(Media)
            .filter(Media.post_id == post_id)
            .order_by(Media.position.asc())
            .all()
        )

    def delete(self, media: Media) -> bool:
        self.db.delete(media)
        self.db.commit()
        return True
