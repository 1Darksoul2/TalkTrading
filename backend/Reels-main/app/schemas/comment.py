from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)
    parent_id: Optional[str] = Field(None, description="Set for replies to an existing comment")


class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    reel_id: str
    user_id: str
    parent_id: Optional[str] = None
    content: str
    is_pinned: bool
    likes_count: int
    replies_count: int
    created_at: datetime
    updated_at: datetime
    replies: Optional[List["CommentResponse"]] = []
