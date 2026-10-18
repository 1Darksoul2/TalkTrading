from sqlalchemy import Boolean, Column, DateTime, Index, Integer, String
from sqlalchemy.sql import func

from app.database.database import Base


class NotificationType:
    FOLLOW = "follow"
    LIKE = "like"
    COMMENT = "comment"
    MENTION = "mention"


class Notification(Base):
    """Something `actor_id` did that `user_id` should hear about (ids are the integer author ids)."""

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    actor_id = Column(Integer, nullable=False)
    type = Column(String(16), nullable=False)
    post_id = Column(Integer, nullable=True)
    comment_id = Column(Integer, nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (Index("idx_notifications_user_read", "user_id", "is_read", "id"),)
