from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.models.ad import AdStatus


class AdCreativeBase(BaseModel):
    title: str
    description: Optional[str] = None
    video_url: str
    thumbnail_url: Optional[str] = None
    cta_text: str = "Learn More"
    cta_url: str
    sponsor_name: str


class AdCreativeCreate(AdCreativeBase):
    pass


class AdCreativeResponse(AdCreativeBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    campaign_id: str
    created_at: datetime


class AdCampaignCreate(BaseModel):
    name: str
    start_date: datetime
    end_date: datetime
    budget: float = 0.0
    max_impressions: int = 50000
    creatives: List[AdCreativeCreate]


class AdCampaignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    advertiser_id: str
    status: AdStatus
    start_date: datetime
    end_date: datetime
    budget: float
    max_impressions: int
    current_impressions: int
    current_clicks: int
    created_at: datetime
    creatives: List[AdCreativeResponse] = []


class AdTrackPayload(BaseModel):
    creative_id: str
    user_id: Optional[str] = None


class AdAnalyticsResponse(BaseModel):
    campaign_id: str
    campaign_name: str
    total_impressions: int
    total_clicks: int
    ctr_percentage: float
