from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.models.moderation import ReportReason, ReportStatus
from app.models.reel import ReelStatus


class ReportCreate(BaseModel):
    reason: ReportReason
    description: Optional[str] = Field(None, max_length=500)


class ReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reel_id: str
    reporter_user_id: str
    reason: ReportReason
    description: Optional[str] = None
    status: ReportStatus
    created_at: datetime
    resolved_at: Optional[datetime] = None


class ModerationAction(BaseModel):
    action: str = Field(..., description="Action to take: takedown, approve, age_restrict, archive")
    reason: Optional[str] = Field(None, description="Reason or internal audit note")
    new_reel_status: ReelStatus
