from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class LikeResponse(BaseModel):
    reel_id: str
    liked: bool
    likes_count: int


class BookmarkResponse(BaseModel):
    reel_id: str
    bookmarked: bool
    bookmarks_count: int


class ShareCreate(BaseModel):
    platform: str = Field("direct", description="Target sharing platform: whatsapp, twitter, direct, copy_link")


class ShareResponse(BaseModel):
    reel_id: str
    shares_count: int
    platform: str
