from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict
from app.models.reel import ReelStatus, ReelVisibility


class ReelMediaBase(BaseModel):
    video_url: str
    thumbnail_url: Optional[str] = None
    preview_gif_url: Optional[str] = None
    duration: float = Field(..., gt=0, le=180, description="Video duration in seconds (up to 3 min)")
    width: Optional[int] = 1080
    height: Optional[int] = 1920
    aspect_ratio: str = "9:16"
    file_size_bytes: Optional[int] = None
    mime_type: str = "video/mp4"
    video_codec: Optional[str] = "h264"


class ReelMediaCreate(ReelMediaBase):
    pass


class ReelMediaResponse(ReelMediaBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime


class AudioTrackBase(BaseModel):
    title: str
    artist: Optional[str] = None
    audio_url: str
    duration: Optional[float] = None
    is_original: bool = False


class AudioTrackCreate(AudioTrackBase):
    pass


class AudioTrackResponse(AudioTrackBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_at: datetime


class ReelCreate(BaseModel):
    caption: Optional[str] = Field(None, max_length=2200)
    tags: Optional[List[str]] = Field(default_factory=list)
    visibility: ReelVisibility = ReelVisibility.PUBLIC
    allow_comments: bool = True
    allow_duet: bool = True
    allow_sharing: bool = True
    media: ReelMediaCreate
    audio: Optional[AudioTrackCreate] = None


class ReelUpdate(BaseModel):
    caption: Optional[str] = Field(None, max_length=2200)
    tags: Optional[List[str]] = None
    visibility: Optional[ReelVisibility] = None
    allow_comments: Optional[bool] = None
    allow_duet: Optional[bool] = None
    allow_sharing: Optional[bool] = None
    is_pinned: Optional[bool] = None


class ReelResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    caption: Optional[str] = None
    tags: Optional[str] = None
    status: ReelStatus
    visibility: ReelVisibility
    allow_comments: bool
    allow_duet: bool
    allow_sharing: bool
    is_pinned: bool
    views_count: int
    likes_count: int
    comments_count: int
    shares_count: int
    bookmarks_count: int
    created_at: datetime
    updated_at: datetime
    media: Optional[ReelMediaResponse] = None
    audio: Optional[AudioTrackResponse] = None

    # User personalized flags (populated if authenticated)
    is_liked: Optional[bool] = False
    is_bookmarked: Optional[bool] = False


class FeedItemResponse(BaseModel):
    type: str = "organic"  # 'organic' or 'ad'
    reel: Optional[ReelResponse] = None
    ad: Optional[dict] = None
