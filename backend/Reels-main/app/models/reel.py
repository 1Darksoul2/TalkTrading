import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text,
    DateTime, ForeignKey, Enum as SQLEnum, Index
)
from sqlalchemy.orm import relationship
from app.db.session import Base


class ReelStatus(str, enum.Enum):
    ACTIVE = "active"
    DRAFT = "draft"
    PROCESSING = "processing"
    ARCHIVED = "archived"
    DELETED = "deleted"
    UNDER_REVIEW = "under_review"
    RESTRICTED = "restricted"


class ReelVisibility(str, enum.Enum):
    PUBLIC = "public"
    FOLLOWERS = "followers"
    PRIVATE = "private"


class Reel(Base):
    __tablename__ = "reels"

    id = Column(String(36), primary_key=True, index=True)  # UUID string
    user_id = Column(String(64), nullable=False, index=True)  # Main application user ID
    caption = Column(Text, nullable=True)
    tags = Column(String(512), nullable=True)  # Comma-separated or JSON list of hashtags
    status = Column(SQLEnum(ReelStatus), default=ReelStatus.ACTIVE, nullable=False, index=True)
    visibility = Column(SQLEnum(ReelVisibility), default=ReelVisibility.PUBLIC, nullable=False, index=True)
    
    # Flags
    allow_comments = Column(Boolean, default=True, nullable=False)
    allow_duet = Column(Boolean, default=True, nullable=False)
    allow_sharing = Column(Boolean, default=True, nullable=False)
    is_pinned = Column(Boolean, default=False, nullable=False)
    
    # Cached denormalized engagement counters for O(1) read performance
    views_count = Column(Integer, default=0, nullable=False)
    likes_count = Column(Integer, default=0, nullable=False)
    comments_count = Column(Integer, default=0, nullable=False)
    shares_count = Column(Integer, default=0, nullable=False)
    bookmarks_count = Column(Integer, default=0, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    media = relationship("ReelMedia", back_populates="reel", uselist=False, cascade="all, delete-orphan")
    audio = relationship("AudioTrack", back_populates="reels")
    audio_id = Column(String(36), ForeignKey("audio_tracks.id"), nullable=True)
    
    likes = relationship("ReelLike", back_populates="reel", cascade="all, delete-orphan")
    bookmarks = relationship("ReelBookmark", back_populates="reel", cascade="all, delete-orphan")
    shares = relationship("ReelShare", back_populates="reel", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="reel", cascade="all, delete-orphan")
    reports = relationship("ReelReport", back_populates="reel", cascade="all, delete-orphan")


class ReelMedia(Base):
    """Stores metadata and CDN/Storage URLs. No actual binary files stored here."""
    __tablename__ = "reel_media"

    id = Column(String(36), primary_key=True, index=True)
    reel_id = Column(String(36), ForeignKey("reels.id", ondelete="CASCADE"), nullable=False, unique=True)
    video_url = Column(String(1024), nullable=False)
    thumbnail_url = Column(String(1024), nullable=True)
    preview_gif_url = Column(String(1024), nullable=True)
    
    # Video properties
    duration = Column(Float, nullable=False)  # in seconds
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    aspect_ratio = Column(String(16), default="9:16", nullable=False)
    file_size_bytes = Column(Integer, nullable=True)
    mime_type = Column(String(64), default="video/mp4", nullable=False)
    video_codec = Column(String(32), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    reel = relationship("Reel", back_populates="media")


class AudioTrack(Base):
    __tablename__ = "audio_tracks"

    id = Column(String(36), primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    artist = Column(String(255), nullable=True)
    audio_url = Column(String(1024), nullable=False)
    duration = Column(Float, nullable=True)
    is_original = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    reels = relationship("Reel", back_populates="audio")
