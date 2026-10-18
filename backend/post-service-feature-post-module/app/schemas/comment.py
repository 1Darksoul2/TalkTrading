from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

from app.models.comment import CommentStatus


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000, description="Comment content")
    parent_comment_id: Optional[int] = Field(None, description="ID of the parent comment if replying")


class CommentUpdate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000, description="Updated comment content")


class CommentResponse(BaseModel):
    id: int
    post_id: int
    author_id: int
    parent_comment_id: Optional[int] = None
    content: str
    status: CommentStatus
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class CommentTreeResponse(CommentResponse):
    replies: List["CommentTreeResponse"] = []

    model_config = {
        "from_attributes": True
    }