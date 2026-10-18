from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.ad import AdCampaign, AdCreative, AdImpression, AdClick, AdStatus
from app.schemas.ad import AdCampaignCreate, AdAnalyticsResponse


class AdService:
    @staticmethod
    def create_campaign(db: Session, advertiser_id: str, campaign_in: AdCampaignCreate) -> AdCampaign:
        import uuid
        campaign_id = str(uuid.uuid4())
        campaign = AdCampaign(
            id=campaign_id,
            name=campaign_in.name,
            advertiser_id=advertiser_id,
            status=AdStatus.ACTIVE,
            start_date=campaign_in.start_date,
            end_date=campaign_in.end_date,
            budget=campaign_in.budget,
            max_impressions=campaign_in.max_impressions
        )
        db.add(campaign)

        for c in campaign_in.creatives:
            creative = AdCreative(
                id=str(uuid.uuid4()),
                campaign_id=campaign_id,
                title=c.title,
                description=c.description,
                video_url=c.video_url,
                thumbnail_url=c.thumbnail_url,
                cta_text=c.cta_text,
                cta_url=c.cta_url,
                sponsor_name=c.sponsor_name
            )
            db.add(creative)

        db.commit()
        db.refresh(campaign)
        return campaign

    @staticmethod
    def get_campaigns(db: Session, advertiser_id: str, is_admin: bool = False) -> List[AdCampaign]:
        query = db.query(AdCampaign)
        if not is_admin:
            query = query.filter(AdCampaign.advertiser_id == advertiser_id)
        return query.order_by(AdCampaign.created_at.desc()).all()

    @staticmethod
    def get_active_ad(db: Session) -> Optional[AdCreative]:
        """Fetches an active ad creative that hasn't exceeded its impression limit."""
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        creative = (
            db.query(AdCreative)
            .join(AdCampaign)
            .filter(
                AdCampaign.status == AdStatus.ACTIVE,
                AdCampaign.start_date <= now,
                AdCampaign.end_date >= now,
                AdCampaign.current_impressions < AdCampaign.max_impressions
            )
            .order_by(func.random())
            .first()
        )
        return creative

    @staticmethod
    def record_impression(db: Session, creative_id: str, user_id: Optional[str] = None, ip_hash: Optional[str] = None):
        import uuid
        creative = db.query(AdCreative).filter(AdCreative.id == creative_id).first()
        if not creative:
            return False

        imp = AdImpression(
            id=str(uuid.uuid4()),
            creative_id=creative_id,
            user_id=user_id,
            ip_hash=ip_hash
        )
        db.add(imp)
        creative.campaign.current_impressions += 1
        
        # Check capping
        if creative.campaign.current_impressions >= creative.campaign.max_impressions:
            creative.campaign.status = AdStatus.COMPLETED

        db.commit()
        return True

    @staticmethod
    def record_click(db: Session, creative_id: str, user_id: Optional[str] = None, ip_hash: Optional[str] = None):
        import uuid
        creative = db.query(AdCreative).filter(AdCreative.id == creative_id).first()
        if not creative:
            return False

        click = AdClick(
            id=str(uuid.uuid4()),
            creative_id=creative_id,
            user_id=user_id,
            ip_hash=ip_hash
        )
        db.add(click)
        creative.campaign.current_clicks += 1
        db.commit()
        return True

    @staticmethod
    def get_campaign_analytics(
        db: Session,
        campaign_id: str,
        user_id: Optional[str] = None,
        is_admin: bool = False
    ) -> Optional[AdAnalyticsResponse]:
        query = db.query(AdCampaign).filter(AdCampaign.id == campaign_id)
        if not is_admin and user_id:
            query = query.filter(AdCampaign.advertiser_id == user_id)
        campaign = query.first()
        if not campaign:
            return None

        impressions = campaign.current_impressions
        clicks = campaign.current_clicks
        ctr = (clicks / impressions * 100.0) if impressions > 0 else 0.0

        return AdAnalyticsResponse(
            campaign_id=campaign.id,
            campaign_name=campaign.name,
            total_impressions=impressions,
            total_clicks=clicks,
            ctr_percentage=round(ctr, 2)
        )
