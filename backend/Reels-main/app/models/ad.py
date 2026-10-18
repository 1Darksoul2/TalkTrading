import enum
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text,
    DateTime, ForeignKey, Enum as SQLEnum, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.db.session import Base


class AdStatus(str, enum.Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    EXPIRED = "expired"


class AdCampaign(Base):
    __tablename__ = "ad_campaigns"

    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    advertiser_id = Column(String(64), nullable=False, index=True)
    status = Column(SQLEnum(AdStatus), default=AdStatus.ACTIVE, nullable=False, index=True)
    
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    
    # Budgets & Capping
    budget = Column(Float, default=0.0, nullable=False)
    max_impressions = Column(Integer, default=100000, nullable=False)
    current_impressions = Column(Integer, default=0, nullable=False)
    current_clicks = Column(Integer, default=0, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    creatives = relationship("AdCreative", back_populates="campaign", cascade="all, delete-orphan")


class AdCreative(Base):
    __tablename__ = "ad_creatives"

    id = Column(String(36), primary_key=True, index=True)
    campaign_id = Column(String(36), ForeignKey("ad_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    video_url = Column(String(1024), nullable=False)
    thumbnail_url = Column(String(1024), nullable=True)
    cta_text = Column(String(64), default="Learn More", nullable=False)  # Shop Now, Visit Website, etc.
    cta_url = Column(String(1024), nullable=False)
    sponsor_name = Column(String(128), nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    campaign = relationship("AdCampaign", back_populates="creatives")
    impressions = relationship("AdImpression", back_populates="creative", cascade="all, delete-orphan")
    clicks = relationship("AdClick", back_populates="creative", cascade="all, delete-orphan")


class AdImpression(Base):
    __tablename__ = "ad_impressions"

    id = Column(String(36), primary_key=True, index=True)
    creative_id = Column(String(36), ForeignKey("ad_creatives.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    ip_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    creative = relationship("AdCreative", back_populates="impressions")


class AdClick(Base):
    __tablename__ = "ad_clicks"

    id = Column(String(36), primary_key=True, index=True)
    creative_id = Column(String(36), ForeignKey("ad_creatives.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    ip_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    creative = relationship("AdCreative", back_populates="clicks")
