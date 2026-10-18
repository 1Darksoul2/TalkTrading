import enum
from sqlalchemy import Column, Integer, Text, Enum, ForeignKey, DateTime, Index
from sqlalchemy.orm import relationship, backref
from sqlalchemy.sql import func

from app.database.database import Base


class CommentStatus(str, enum.Enum):
    ACTIVE = "active"
    HIDDEN = "hidden"
    DELETED = "deleted"
    UNDER_REVIEW = "under_review"


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, nullable=False, index=True)  # Microservice boundary: No FK to users table
    
    parent_comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    status = Column(Enum(CommentStatus), default=CommentStatus.ACTIVE, nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    post = relationship("Post", back_populates="comments")
    replies = relationship("Comment", backref=backref("parent", remote_side=[id]), cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_comments_post_created", "post_id", "created_at"),
    )