from pydantic import BaseModel
from datetime import datetime


class ShareCreate(BaseModel):
    post_id: int


class ShareResponse(BaseModel):
    id: int
    post_id: int
    user_id: int
    created_at: datetime
    share_count: int

    model_config = {
        "from_attributes": True
    }
