from pydantic import BaseModel, Field
from typing import List, Optional
from app.schemas.post import PostResponse


class FeedResponse(BaseModel):
    posts: List[PostResponse]
    total: int
    next_cursor: Optional[int] = None
    has_more: bool
