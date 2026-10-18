from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.reel import Reel, ReelStatus, ReelVisibility
from app.models.interaction import ReelLike, ReelBookmark
from app.schemas.reel import ReelResponse, FeedItemResponse
from app.schemas.ad import AdCreativeResponse
from app.services.ad_service import AdService
from app.core.config import settings


class FeedService:
    @staticmethod
    def get_feed(
        db: Session,
        current_user_id: Optional[str] = None,
        page: int = 1,
        page_size: int = 10,
        include_ads: bool = True
    ) -> List[FeedItemResponse]:
        skip = (page - 1) * page_size
        
        # Query active public reels ordered by recency and pinned status
        query = (
            db.query(Reel)
            .filter(
                Reel.status == ReelStatus.ACTIVE,
                Reel.visibility == ReelVisibility.PUBLIC
            )
            .order_by(Reel.is_pinned.desc(), Reel.created_at.desc())
        )

        reels = query.offset(skip).limit(page_size).all()
        
        # User engagement lookups for personalized feed
        liked_reel_ids = set()
        bookmarked_reel_ids = set()
        if current_user_id and reels:
            reel_ids = [r.id for r in reels]
            liked_reel_ids = {
                like.reel_id for like in db.query(ReelLike.reel_id).filter(
                    ReelLike.reel_id.in_(reel_ids),
                    ReelLike.user_id == current_user_id
                ).all()
            }
            bookmarked_reel_ids = {
                bm.reel_id for bm in db.query(ReelBookmark.reel_id).filter(
                    ReelBookmark.reel_id.in_(reel_ids),
                    ReelBookmark.user_id == current_user_id
                ).all()
            }

        feed_items: List[FeedItemResponse] = []
        ad_interval = settings.AD_FREQUENCY_INTERVAL

        for i, reel in enumerate(reels, start=1):
            reel_response = ReelResponse.model_validate(reel)
            reel_response.is_liked = reel.id in liked_reel_ids
            reel_response.is_bookmarked = reel.id in bookmarked_reel_ids

            feed_items.append(FeedItemResponse(type="organic", reel=reel_response))

            # Ad slot placement check (e.g. 1 ad every 4 organic items)
            if include_ads and i % ad_interval == 0:
                ad_creative = AdService.get_active_ad(db)
                if ad_creative:
                    ad_resp = AdCreativeResponse.model_validate(ad_creative).model_dump()
                    feed_items.append(FeedItemResponse(type="ad", ad=ad_resp))

        return feed_items
