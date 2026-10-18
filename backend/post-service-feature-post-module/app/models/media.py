import enum
from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class MediaType(str, enum.Enum):
    IMAGE = "image"
    VIDEO = "video"


class Media(Base):
    __tablename__ = "post_media"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)

    media_type = Column(Enum(MediaType), nullable=False)
    storage_key = Column(String(500), nullable=False)
    url = Column(String(1000), nullable=False)
    thumbnail_url = Column(String(1000), nullable=True)
    
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)  # Video duration in seconds
    position = Column(Integer, default=0, nullable=False)  # Ordering position within post

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    post = relationship("Post", back_populates="media_items")
