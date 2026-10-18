from pydantic import BaseModel
from typing import Optional


class EngagementSummary(BaseModel):
    post_id: int
    like_count: int
    comment_count: int
    save_count: int
    share_count: int
    is_liked_by_me: Optional[bool] = False
    is_saved_by_me: Optional[bool] = False
