from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

from app.models.post import PostVisibility, PostStatus
from app.schemas.media import MediaResponse
from app.schemas.engagement import EngagementSummary


class PostCreate(BaseModel):
    caption: Optional[str] = Field(None, max_length=5000, description="Caption of the post with #hashtags and @mentions")
    visibility: PostVisibility = Field(PostVisibility.PUBLIC, description="Visibility state")


class PostUpdate(BaseModel):
    caption: Optional[str] = Field(None, max_length=5000, description="Updated caption")
    visibility: Optional[PostVisibility] = Field(None, description="Updated visibility")
    status: Optional[PostStatus] = Field(None, description="Updated status")


class PostResponse(BaseModel):
    id: int
    author_id: int
    caption: Optional[str] = None
    visibility: PostVisibility
    status: PostStatus
    like_count: int
    comment_count: int
    save_count: int
    share_count: int
    created_at: datetime
    updated_at: datetime
    media_items: List[MediaResponse] = []

    model_config = {
        "from_attributes": True
    }


class PostDetailResponse(PostResponse):
    engagement: Optional[EngagementSummary] = None