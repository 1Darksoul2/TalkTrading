from typing import List, Optional
from fastapi import APIRouter, Depends, Request, status, HTTPException
from sqlalchemy.orm import Session
import hashlib
from app.db.session import get_db
from app.api.v1.deps import get_current_user, verify_service_api_key
from app.core.security import TokenData
from app.schemas.ad import (
    AdCampaignCreate, AdCampaignResponse, AdTrackPayload, AdAnalyticsResponse
)
from app.schemas.common import APIResponse
from app.services.ad_service import AdService

router = APIRouter()


@router.post("/campaigns", response_model=APIResponse[AdCampaignResponse], status_code=status.HTTP_201_CREATED)
def create_campaign(
    campaign_in: AdCampaignCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Create a new sponsored ad campaign with creatives."""
    campaign = AdService.create_campaign(db, advertiser_id=current_user.user_id, campaign_in=campaign_in)
    return APIResponse(data=AdCampaignResponse.model_validate(campaign))


@router.get("/campaigns", response_model=APIResponse[List[AdCampaignResponse]])
def get_campaigns(
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """List campaigns belonging to the authenticated advertiser or all campaigns for admin."""
    is_admin = "admin" in current_user.roles
    campaigns = AdService.get_campaigns(db, advertiser_id=current_user.user_id, is_admin=is_admin)
    return APIResponse(data=[AdCampaignResponse.model_validate(c) for c in campaigns])


@router.post("/track/impression", response_model=APIResponse[dict])
def track_impression(
    payload: AdTrackPayload,
    request: Request,
    db: Session = Depends(get_db)
):
    """Record an ad impression when rendered on client screen."""
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]
    
    success = AdService.record_impression(
        db,
        creative_id=payload.creative_id,
        user_id=payload.user_id,
        ip_hash=ip_hash
    )
    if not success:
        raise HTTPException(status_code=404, detail="Ad creative not found")
    return APIResponse(message="Impression logged")


@router.post("/track/click", response_model=APIResponse[dict])
def track_click(
    payload: AdTrackPayload,
    request: Request,
    db: Session = Depends(get_db)
):
    """Record an ad click when user taps CTA link."""
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]
    
    success = AdService.record_click(
        db,
        creative_id=payload.creative_id,
        user_id=payload.user_id,
        ip_hash=ip_hash
    )
    if not success:
        raise HTTPException(status_code=404, detail="Ad creative not found")
    return APIResponse(message="Click logged")


@router.get("/campaigns/{campaign_id}/analytics", response_model=APIResponse[AdAnalyticsResponse])
def get_campaign_analytics(
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Retrieve performance metrics (impressions, clicks, CTR) for an ad campaign."""
    analytics = AdService.get_campaign_analytics(
        db,
        campaign_id=campaign_id,
        user_id=current_user.user_id,
        is_admin="admin" in current_user.roles
    )
    if not analytics:
        raise HTTPException(status_code=404, detail="Campaign not found or access denied")
    return APIResponse(data=analytics)
