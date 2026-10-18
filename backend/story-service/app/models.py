import enum
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import (
    JSON, Boolean, CHAR, Column, DateTime, Enum, Float, ForeignKey, Index, Integer, String,
    TypeDecorator, UniqueConstraint,
)
from sqlalchemy.sql import expression
from sqlalchemy.dialects.postgresql import UUID as pgUUID
from sqlalchemy.orm import relationship


class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID type, otherwise uses CHAR(32), storing as stringified hex values.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(pgUUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(32))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if not isinstance(value, uuid.UUID):
                return "%.32x" % uuid.UUID(value).int
            else:
                return "%.32x" % value.int

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                value = uuid.UUID(value)
            return value

from .database import Base
from .config import settings


def _utcnow() -> datetime:
    """Timezone-aware UTC timestamp (replaces deprecated datetime.utcnow())."""
    return datetime.now(timezone.utc)


class MediaType(str, enum.Enum):
    image = "image"
    video = "video"


class Audience(str, enum.Enum):
    everyone = "everyone"
    close_friends = "close_friends"


class Story(Base):
    __tablename__ = "stories"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), nullable=False, index=True)
    media_url = Column(String, nullable=False)
    media_type = Column(Enum(MediaType), nullable=False)
    caption = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    view_count = Column(Integer, default=0, nullable=False)

    # Added for the full experience (see lite_migrations for existing databases)
    audience = Column(String(16), nullable=False, default=Audience.everyone.value, server_default="everyone")
    overlays = Column(JSON, nullable=True)            # validated sticker/text list, see schemas.Overlay
    media_id = Column(GUID(), nullable=True)           # uploaded asset (None for legacy external URLs)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)            # seconds, videos only
    link_clicks = Column(Integer, nullable=False, default=0, server_default="0")

    views = relationship("StoryView", back_populates="story", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.expires_at:
            self.expires_at = _utcnow() + timedelta(hours=settings.story_duration_hours)


class StoryView(Base):
    __tablename__ = "story_views"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    story_id = Column(GUID(), ForeignKey("stories.id", ondelete="CASCADE"), nullable=False)
    viewer_id = Column(GUID(), nullable=False)
    viewed_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    story = relationship("Story", back_populates="views")

    __table_args__ = (Index("idx_story_views_story_viewer", "story_id", "viewer_id"),)


class StoryMedia(Base):
    """An uploaded, validated file. Attached to a story when it is published; unattached uploads expire."""

    __tablename__ = "story_media"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    owner_id = Column(GUID(), nullable=False, index=True)
    storage_key = Column(String(80), nullable=False, unique=True)  # file name inside media_dir
    media_type = Column(Enum(MediaType), nullable=False)
    mime_type = Column(String(40), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)
    attached = Column(Boolean, nullable=False, default=False, server_default=expression.false())
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)


class StoryReply(Base):
    __tablename__ = "story_replies"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    story_id = Column(GUID(), ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(GUID(), nullable=False)
    text = Column(String(1000), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)


class StoryReaction(Base):
    """One reaction per viewer per story; reacting again replaces the emoji."""

    __tablename__ = "story_reactions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    story_id = Column(GUID(), ForeignKey("stories.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(GUID(), nullable=False)
    emoji = Column(String(16), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("story_id", "user_id", name="uq_story_reaction"),)


class StoryPollVote(Base):
    __tablename__ = "story_poll_votes"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    story_id = Column(GUID(), ForeignKey("stories.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(GUID(), nullable=False)
    option = Column(Integer, nullable=False)  # index into the poll sticker's options
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("story_id", "user_id", name="uq_story_poll_vote"),)


class StoryStickerResponse(Base):
    """An answer to a question / slider / quiz sticker. Sliders and quizzes allow one answer per person."""

    __tablename__ = "story_sticker_responses"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    story_id = Column(GUID(), ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID(), nullable=False)
    kind = Column(String(10), nullable=False)        # question | slider | quiz
    value = Column(String(300), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    __table_args__ = (Index("idx_sticker_story_user", "story_id", "user_id"),)


class StoryCountdownReminder(Base):
    """Someone asked to be told when a story's countdown ends."""

    __tablename__ = "story_countdown_reminders"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    story_id = Column(GUID(), ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID(), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False, index=True)
    notified = Column(Boolean, nullable=False, default=False, server_default=expression.false())
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("story_id", "user_id", name="uq_countdown_reminder"),)


class StoryMention(Base):
    """Someone @mentioned in a story. Mentioned people can open that story whatever its audience."""

    __tablename__ = "story_mentions"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    story_id = Column(GUID(), ForeignKey("stories.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(GUID(), nullable=False, index=True)

    __table_args__ = (UniqueConstraint("story_id", "user_id", name="uq_story_mention"),)


class StoryReport(Base):
    __tablename__ = "story_reports"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    story_id = Column(GUID(), nullable=False, index=True)
    reporter_id = Column(GUID(), nullable=False)
    reason = Column(String(32), nullable=False)
    details = Column(String(500), nullable=True)
    status = Column(String(16), nullable=False, default="open", server_default="open")
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("story_id", "reporter_id", name="uq_story_report_once"),)


class CloseFriend(Base):
    """owner_id's Close Friends list. Close-friends stories are visible only to these accounts."""

    __tablename__ = "close_friends"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    owner_id = Column(GUID(), nullable=False, index=True)
    friend_id = Column(GUID(), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("owner_id", "friend_id", name="uq_close_friend"),)


class StoryHidden(Base):
    """owner_id hides their stories from hidden_id."""

    __tablename__ = "story_hidden"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    owner_id = Column(GUID(), nullable=False, index=True)
    hidden_id = Column(GUID(), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("owner_id", "hidden_id", name="uq_story_hidden"),)


class StoryMute(Base):
    """viewer_id muted owner_id's stories: they move to the end of the tray (and never auto-play)."""

    __tablename__ = "story_mutes"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    viewer_id = Column(GUID(), nullable=False, index=True)
    owner_id = Column(GUID(), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("viewer_id", "owner_id", name="uq_story_mute"),)


class StorySettings(Base):
    """Per-account story preferences. One row per user, created lazily with defaults."""

    __tablename__ = "story_settings"

    owner_id = Column(GUID(), primary_key=True)
    who_can_see = Column(String(10), nullable=False, default="everyone", server_default="everyone")   # everyone|followers
    allow_replies = Column(String(10), nullable=False, default="everyone", server_default="everyone")  # everyone|following|off
    allow_mentions = Column(String(10), nullable=False, default="everyone", server_default="everyone")  # everyone|following|none
    save_to_archive = Column(Boolean, nullable=False, default=True, server_default=expression.true())
    notify_replies = Column(Boolean, nullable=False, default=True, server_default=expression.true())
    notify_reactions = Column(Boolean, nullable=False, default=True, server_default=expression.true())
    notify_mentions = Column(Boolean, nullable=False, default=True, server_default=expression.true())
    notify_poll_votes = Column(Boolean, nullable=False, default=True, server_default=expression.true())


class StoryNotification(Base):
    """In-app notification about a story event, owned by this service (the bell merges it with Post's)."""

    __tablename__ = "story_notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(GUID(), nullable=False)
    actor_id = Column(GUID(), nullable=False)
    type = Column(String(20), nullable=False)  # story_reply|story_reaction|story_mention|story_poll_vote
    story_id = Column(GUID(), nullable=True)
    text = Column(String(200), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False, server_default=expression.false())
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    __table_args__ = (Index("idx_story_notifications_user", "user_id", "is_read", "id"),)


class Highlight(Base):
    __tablename__ = "highlights"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    owner_id = Column(GUID(), nullable=False, index=True)
    title = Column(String(30), nullable=False)
    cover_story_id = Column(GUID(), nullable=True)
    position = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    items = relationship("HighlightItem", back_populates="highlight", cascade="all, delete-orphan",
                         order_by="HighlightItem.position")


class HighlightItem(Base):
    __tablename__ = "highlight_items"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    highlight_id = Column(GUID(), ForeignKey("highlights.id", ondelete="CASCADE"), nullable=False, index=True)
    story_id = Column(GUID(), ForeignKey("stories.id", ondelete="CASCADE"), nullable=False, index=True)
    position = Column(Integer, nullable=False, default=0)

    highlight = relationship("Highlight", back_populates="items")

    __table_args__ = (UniqueConstraint("highlight_id", "story_id", name="uq_highlight_story"),)
