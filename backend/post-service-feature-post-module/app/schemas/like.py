from pydantic import BaseModel


class LikeResponse(BaseModel):
    message: str