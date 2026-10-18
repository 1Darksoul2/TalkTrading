from sqlalchemy import Column, Integer, DateTime, UniqueConstraint, Index
from sqlalchemy.sql import func

from app.database.database import Base


class Follow(Base):
    """follower_id follows following_id. Both are the integer ids derived from
    the user's UUID (the same ids stored as Post.author_id / Like.user_id)."""

    __tablename__ = "follows"

    id = Column(Integer, primary_key=True, index=True)
    follower_id = Column(Integer, nullable=False, index=True)
    following_id = Column(Integer, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("follower_id", "following_id", name="uq_follower_following"),
        Index("idx_follows_following_follower", "following_id", "follower_id"),
    )
