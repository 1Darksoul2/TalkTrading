from pydantic import BaseModel
from datetime import datetime
from typing import List
from app.schemas.post import PostResponse


class HashtagResponse(BaseModel):
    id: int
    tag: str
    created_at: datetime

    model_config = {
        "from_attributes": True
    }


class HashtagPostsResponse(BaseModel):
    hashtag: str
    posts: List[PostResponse]
    total: int
