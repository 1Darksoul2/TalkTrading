import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column, String, DateTime, ForeignKey, UniqueConstraint, Index, JSON, CHAR, TypeDecorator
)
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


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Article(Base):
    """
    A normalised news article stored after ingestion.
    `source_url` is the deduplication key — the same URL won't be inserted twice
    regardless of which provider returned it.
    """
    __tablename__ = "articles"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    title = Column(String, nullable=False)
    summary = Column(String, nullable=True)
    source = Column(String, nullable=False)          # e.g. "Reuters", "CoinDesk"
    source_url = Column(String, nullable=False, unique=True)  # dedup key
    image_url = Column(String, nullable=True)
    category = Column(String, nullable=False, default="markets", index=True)
    # Ticker symbols mentioned in the article, e.g. ["AAPL", "TSLA"]
    related_symbols = Column(JSON, nullable=False, default=list)
    published_at = Column(DateTime(timezone=True), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    bookmarks = relationship("Bookmark", back_populates="article", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_articles_category_published", "category", "published_at"),
    )


class Bookmark(Base):
    """A user's saved article."""
    __tablename__ = "bookmarks"

    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID(), nullable=False, index=True)
    article_id = Column(GUID(), ForeignKey("articles.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    article = relationship("Article", back_populates="bookmarks")

    __table_args__ = (
        UniqueConstraint("user_id", "article_id", name="uq_bookmark_user_article"),
    )
