from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base


class ReelLike(Base):
    __tablename__ = "reel_likes"

    id = Column(String(36), primary_key=True, index=True)
    reel_id = Column(String(36), ForeignKey("reels.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("reel_id", "user_id", name="uq_reel_user_like"),
    )

    reel = relationship("Reel", back_populates="likes")


class ReelBookmark(Base):
    __tablename__ = "reel_bookmarks"

    id = Column(String(36), primary_key=True, index=True)
    reel_id = Column(String(36), ForeignKey("reels.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("reel_id", "user_id", name="uq_reel_user_bookmark"),
    )

    reel = relationship("Reel", back_populates="bookmarks")


class ReelShare(Base):
    __tablename__ = "reel_shares"

    id = Column(String(36), primary_key=True, index=True)
    reel_id = Column(String(36), ForeignKey("reels.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), nullable=True, index=True)  # Anonymous shares allowed
    platform = Column(String(64), default="direct", nullable=False)  # whatsapp, twitter, copy_link
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    reel = relationship("Reel", back_populates="shares")
