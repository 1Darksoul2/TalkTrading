import enum
from sqlalchemy import Column, Integer, String, Text, Enum, DateTime, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class PostVisibility(str, enum.Enum):
    PUBLIC = "public"
    FOLLOWERS = "followers"
    PRIVATE = "private"


class PostStatus(str, enum.Enum):
    ACTIVE = "active"
    HIDDEN = "hidden"
    DELETED = "deleted"
    UNDER_REVIEW = "under_review"


class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, nullable=False, index=True)  # Microservice boundary: No FK to users table
    
    caption = Column(Text, nullable=True)
    visibility = Column(Enum(PostVisibility), default=PostVisibility.PUBLIC, nullable=False, index=True)
    status = Column(Enum(PostStatus), default=PostStatus.ACTIVE, nullable=False, index=True)
    
    # Denormalized engagement counters for O(1) reads
    like_count = Column(Integer, default=0, nullable=False)
    comment_count = Column(Integer, default=0, nullable=False)
    save_count = Column(Integer, default=0, nullable=False)
    share_count = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships within Post Service domain
    media_items = relationship("Media", back_populates="post", cascade="all, delete-orphan", order_by="Media.position")
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")
    saves = relationship("Save", back_populates="post", cascade="all, delete-orphan")
    shares = relationship("Share", back_populates="post", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_posts_author_created", "author_id", "created_at"),
        Index("idx_posts_visibility_status", "visibility", "status"),
    )