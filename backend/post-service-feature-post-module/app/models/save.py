from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database.database import Base


class Save(Base):
    __tablename__ = "saves"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False, index=True)  # Microservice boundary
    post_id = Column(Integer, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    post = relationship("Post", back_populates="saves")

    __table_args__ = (
        UniqueConstraint("user_id", "post_id", name="uq_user_post_save"),
        Index("idx_saves_user_created", "user_id", "created_at"),
    )
