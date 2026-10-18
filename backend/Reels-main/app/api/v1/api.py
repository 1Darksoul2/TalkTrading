from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    reels,
    feed,
    interactions,
    comments,
    ads,
    moderation,
    media,
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(feed.router, prefix="/feed", tags=["Feed"])
api_router.include_router(reels.router, prefix="/reels", tags=["Reels"])
api_router.include_router(interactions.router, prefix="/reels", tags=["Interactions"])
api_router.include_router(comments.router, prefix="/reels", tags=["Comments"])
api_router.include_router(ads.router, prefix="/ads", tags=["Advertisements"])
api_router.include_router(moderation.router, prefix="/moderation", tags=["Moderation"])
api_router.include_router(media.router, prefix="/media", tags=["Media"])
