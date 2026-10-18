import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Text, DateTime,
    ForeignKey, Enum as SQLEnum
)
from sqlalchemy.orm import relationship
from app.db.session import Base


class ReportReason(str, enum.Enum):
    SPAM = "spam"
    HARASSMENT = "harassment"
    HATE_SPEECH = "hate_speech"
    VIOLENCE = "violence"
    NUDITY = "nudity"
    COPYRIGHT = "copyright"
    MISINFORMATION = "misinformation"
    OTHER = "other"


class ReportStatus(str, enum.Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class ReelReport(Base):
    __tablename__ = "reel_reports"

    id = Column(String(36), primary_key=True, index=True)
    reel_id = Column(String(36), ForeignKey("reels.id", ondelete="CASCADE"), nullable=False, index=True)
    reporter_user_id = Column(String(64), nullable=False, index=True)
    reason = Column(SQLEnum(ReportReason), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(SQLEnum(ReportStatus), default=ReportStatus.PENDING, nullable=False, index=True)
    
    reviewed_by = Column(String(64), nullable=True)
    resolution_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    reel = relationship("Reel", back_populates="reports")


class ModerationLog(Base):
    __tablename__ = "moderation_logs"

    id = Column(String(36), primary_key=True, index=True)
    reel_id = Column(String(36), nullable=False, index=True)
    moderator_id = Column(String(64), nullable=False)
    action = Column(String(64), nullable=False)  # takedown, approve, age_restrict
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
