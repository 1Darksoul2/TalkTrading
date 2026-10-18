"""
SQLAlchemy ORM models for the Chart Service.

Tables:
  - symbols     : master registry of all tracked symbols with metadata
  - quote_cache : cached real-time quote per symbol with TTL-aware staleness flag

Uses the same GUID TypeDecorator trick as news-service for SQLite/PostgreSQL
cross-compatibility.
"""
import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, Integer, DateTime, Boolean, Text
from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as pgUUID

from .database import Base


# ── Cross-DB UUID type (same pattern as news-service) ─────────────────────────
class GUID(TypeDecorator):
    """Platform-independent GUID type.
    Uses PostgreSQL's UUID when available, CHAR(32) hex string on SQLite.
    """
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(pgUUID())
        return dialect.type_descriptor(CHAR(32))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return str(value)
        if isinstance(value, uuid.UUID):
            return value.hex
        return uuid.UUID(value).hex

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        return uuid.UUID(value) if not isinstance(value, uuid.UUID) else value


# ── Symbol Registry ────────────────────────────────────────────────────────────
class Symbol(Base):
    """Master registry of all supported trading symbols."""
    __tablename__ = "symbols"

    id           = Column(GUID, primary_key=True, default=uuid.uuid4)
    symbol       = Column(String(20), unique=True, nullable=False, index=True)
    name         = Column(String(200), nullable=False)
    category     = Column(String(50), nullable=False)          # stock | crypto | forex | commodity
    exchange     = Column(String(50), nullable=True)           # NASDAQ, BINANCE, FX, etc.
    tv_symbol    = Column(String(100), nullable=False)         # TradingView format e.g. NASDAQ:AAPL
    is_active    = Column(Boolean, default=True, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow, nullable=False)


# ── Quote Cache ────────────────────────────────────────────────────────────────
class QuoteCache(Base):
    """Cached real-time quote per symbol. Refreshed every QUOTE_CACHE_TTL seconds."""
    __tablename__ = "quote_cache"

    id             = Column(GUID, primary_key=True, default=uuid.uuid4)
    symbol         = Column(String(20), unique=True, nullable=False, index=True)

    # Quote data
    price          = Column(Float, nullable=True)
    open           = Column(Float, nullable=True)
    high           = Column(Float, nullable=True)
    low            = Column(Float, nullable=True)
    prev_close     = Column(Float, nullable=True)
    change         = Column(Float, nullable=True)
    change_percent = Column(Float, nullable=True)
    volume         = Column(Integer, nullable=True)

    # Sparkline — stored as JSON string e.g. "[150.1, 151.3, ...]"
    sparkline_json = Column(Text, nullable=True)

    # Cache control
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
