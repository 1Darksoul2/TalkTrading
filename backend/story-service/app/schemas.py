import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Dict, List, Literal, Optional, Union
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator

from .models import Audience, MediaType


# ── Overlays: text and stickers placed on a story ───────────────────────────
# Positions are fractions of the frame (0..1) so they render the same at any size.

class _OverlayBase(BaseModel):
    x: float = Field(0.5, ge=0, le=1)
    y: float = Field(0.5, ge=0, le=1)
    scale: float = Field(1.0, ge=0.3, le=4)
    rotation: float = Field(0.0, ge=-180, le=180)


class TextOverlay(_OverlayBase):
    type: Literal["text"]
    text: str = Field(..., min_length=1, max_length=200)
    color: str = Field("#ffffff", pattern=r"^#[0-9a-fA-F]{6}$")
    background: Optional[str] = Field(None, pattern=r"^#[0-9a-fA-F]{6}$")


class MentionOverlay(_OverlayBase):
    type: Literal["mention"]
    username: str = Field(..., pattern=r"^[A-Za-z0-9_.]{1,64}$")


class HashtagOverlay(_OverlayBase):
    type: Literal["hashtag"]
    tag: str = Field(..., pattern=r"^[A-Za-z0-9_]{1,50}$")


class LinkOverlay(_OverlayBase):
    type: Literal["link"]
    url: str = Field(..., max_length=500)
    label: Optional[str] = Field(None, max_length=40)

    @field_validator("url")
    @classmethod
    def only_web_links(cls, v: str) -> str:
        parsed = urlparse(v)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("Links must start with http:// or https://")
        return v


class PollOverlay(_OverlayBase):
    type: Literal["poll"]
    question: str = Field(..., min_length=1, max_length=100)
    options: List[str] = Field(..., min_length=2, max_length=2)

    @field_validator("options")
    @classmethod
    def option_length(cls, v: List[str]) -> List[str]:
        if any(not o.strip() or len(o) > 30 for o in v):
            raise ValueError("Each poll option must be 1-30 characters")
        return v


class QuestionOverlay(_OverlayBase):
    """"Ask me a question": viewers type answers that only the owner can read."""
    type: Literal["question"]
    prompt: str = Field(..., min_length=1, max_length=100)


class SliderOverlay(_OverlayBase):
    """Emoji slider: viewers drag 0-100; they see the average after answering."""
    type: Literal["slider"]
    question: str = Field(..., min_length=1, max_length=100)
    emoji: str = Field("😍", min_length=1, max_length=8)


class QuizOverlay(_OverlayBase):
    """Quiz: 2-4 answers, one of them correct. The correct answer is only revealed after you answer."""
    type: Literal["quiz"]
    question: str = Field(..., min_length=1, max_length=100)
    options: List[str] = Field(..., min_length=2, max_length=4)
    correct: int = Field(..., ge=0, le=3)

    @field_validator("options")
    @classmethod
    def option_length(cls, v: List[str]) -> List[str]:
        if any(not o.strip() or len(o) > 30 for o in v):
            raise ValueError("Each quiz answer must be 1-30 characters")
        return v

    @model_validator(mode="after")
    def correct_in_range(self):
        if self.correct >= len(self.options):
            raise ValueError("The correct answer must be one of the options")
        return self


class CountdownOverlay(_OverlayBase):
    """Countdown to a moment; viewers can ask to be reminded when it ends."""
    type: Literal["countdown"]
    title: str = Field(..., min_length=1, max_length=40)
    ends_at: datetime

    @field_validator("ends_at")
    @classmethod
    def in_the_future(cls, v: datetime) -> datetime:
        v = v if v.tzinfo else v.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        if v <= now or v > now + timedelta(days=365):
            raise ValueError("The countdown must end in the future (within a year)")
        return v


class PostOverlay(_OverlayBase):
    """A post shared to a story. Viewers load the post themselves, so the Post Service decides who may see it."""
    type: Literal["post"]
    post_id: int = Field(..., ge=1)


Overlay = Annotated[
    Union[TextOverlay, MentionOverlay, HashtagOverlay, LinkOverlay, PollOverlay,
          QuestionOverlay, SliderOverlay, QuizOverlay, CountdownOverlay, PostOverlay],
    Field(discriminator="type"),
]

INTERACTIVE_STICKERS = {"poll", "question", "slider", "quiz", "countdown"}


# ── Users ────────────────────────────────────────────────────────────────────

class UserSummary(BaseModel):
    user_id: uuid.UUID
    username: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


# ── Story creation ──────────────────────────────────────────────────────────

class StoryCreate(BaseModel):
    """
    Posted by the client to publish a story. Normally `media_id` comes from POST /stories/media.
    `media_url` is only accepted when REQUIRE_UPLOADED_MEDIA is off (legacy clients).
    """
    user_id: Optional[uuid.UUID] = None  # ignored: the owner is always the logged-in user
    media_id: Optional[uuid.UUID] = None
    media_url: Optional[str] = Field(None, max_length=1000)
    media_type: Optional[MediaType] = None
    caption: Optional[str] = Field(None, max_length=500)
    audience: Audience = Audience.everyone
    overlays: List[Overlay] = Field(default_factory=list, max_length=10)


class UploadOut(BaseModel):
    media_id: uuid.UUID
    media_type: MediaType
    url: str
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    size_bytes: int


class PollResults(BaseModel):
    counts: List[int]
    total: int
    my_vote: Optional[int] = None


class StoryOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    media_url: str
    media_type: MediaType
    caption: Optional[str] = None
    created_at: datetime
    expires_at: datetime
    audience: str = "everyone"
    overlays: List[dict] = Field(default_factory=list)
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    # viewer-specific
    seen: bool = False
    my_reaction: Optional[str] = None
    can_reply: bool = False
    poll: Optional[PollResults] = None
    sticker: Optional[dict] = None   # viewer-specific state of a question/slider/quiz/countdown sticker
    # owner-only (None for everyone else)
    view_count: Optional[int] = None
    expired: bool = False


class TrayItem(BaseModel):
    user: UserSummary
    story_count: int
    has_unseen: bool
    latest_at: datetime
    is_me: bool = False
    muted: bool = False
    close_friends: bool = False  # at least one of the visible stories is for Close Friends only


# ── Interactions ─────────────────────────────────────────────────────────────

class StoryViewerOut(BaseModel):
    viewer_id: uuid.UUID
    viewed_at: datetime
    user: Optional[UserSummary] = None
    reaction: Optional[str] = None
    replied: bool = False


class ReplyCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=1000)

    @field_validator("text")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Reply cannot be blank")
        return v.strip()


class ReplyOut(BaseModel):
    id: uuid.UUID
    story_id: uuid.UUID
    sender_id: uuid.UUID
    text: str
    created_at: datetime
    user: Optional[UserSummary] = None


# A short, fixed palette keeps reactions meaningful and prevents arbitrary-text abuse.
ALLOWED_REACTIONS = ["❤️", "😂", "😮", "😢", "👏", "🔥", "📈", "📉", "🚀", "💯"]


class ReactionSet(BaseModel):
    emoji: str

    @field_validator("emoji")
    @classmethod
    def known_emoji(cls, v: str) -> str:
        if v not in ALLOWED_REACTIONS:
            raise ValueError("Unsupported reaction")
        return v


class PollVoteCreate(BaseModel):
    option: int = Field(..., ge=0, le=1)


class QuestionAnswer(BaseModel):
    text: str = Field(..., min_length=1, max_length=300)

    @field_validator("text")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Answer cannot be blank")
        return v.strip()


class SliderAnswer(BaseModel):
    value: int = Field(..., ge=0, le=100)


class QuizAnswer(BaseModel):
    option: int = Field(..., ge=0, le=3)


class StickerResponseOut(BaseModel):
    user: Optional[UserSummary] = None
    value: str
    created_at: datetime


class ReportCreate(BaseModel):
    reason: Literal["spam", "nudity", "violence", "harassment", "scam", "false_information", "other"]
    details: Optional[str] = Field(None, max_length=500)


class StoryAnalytics(BaseModel):
    story_id: uuid.UUID
    views: int
    unique_viewers: int
    replies: int
    reactions: Dict[str, int]
    link_clicks: int
    poll: Optional[PollResults] = None
    sticker: Optional[dict] = None
    expires_at: datetime


# ── Highlights ───────────────────────────────────────────────────────────────

class HighlightCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=30)
    story_ids: List[uuid.UUID] = Field(..., min_length=1, max_length=100)
    cover_story_id: Optional[uuid.UUID] = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Title cannot be blank")
        return v.strip()


class HighlightUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=30)
    story_ids: Optional[List[uuid.UUID]] = Field(None, min_length=1, max_length=100)  # full ordered list
    cover_story_id: Optional[uuid.UUID] = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Title cannot be blank")
        return v.strip() if v else v


class HighlightOut(BaseModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    title: str
    cover_url: Optional[str] = None
    story_count: int
    position: int
    created_at: datetime


class HighlightDetail(HighlightOut):
    stories: List[StoryOut] = Field(default_factory=list)


class HighlightOrder(BaseModel):
    ids: List[uuid.UUID] = Field(..., min_length=1, max_length=100)


# ── Lists and settings ───────────────────────────────────────────────────────

class UserRef(BaseModel):
    user_id: uuid.UUID


class UserListItem(BaseModel):
    user: UserSummary
    added_at: datetime


class StorySettingsOut(BaseModel):
    who_can_see: Literal["everyone", "followers"] = "everyone"
    allow_replies: Literal["everyone", "following", "off"] = "everyone"
    allow_mentions: Literal["everyone", "following", "none"] = "everyone"
    save_to_archive: bool = True
    notify_replies: bool = True
    notify_reactions: bool = True
    notify_mentions: bool = True
    notify_poll_votes: bool = True


class StorySettingsUpdate(BaseModel):
    who_can_see: Optional[Literal["everyone", "followers"]] = None
    allow_replies: Optional[Literal["everyone", "following", "off"]] = None
    allow_mentions: Optional[Literal["everyone", "following", "none"]] = None
    save_to_archive: Optional[bool] = None
    notify_replies: Optional[bool] = None
    notify_reactions: Optional[bool] = None
    notify_mentions: Optional[bool] = None
    notify_poll_votes: Optional[bool] = None


class NotificationOut(BaseModel):
    id: int
    type: str
    story_id: Optional[uuid.UUID] = None
    text: Optional[str] = None
    is_read: bool
    created_at: datetime
    actor: Optional[UserSummary] = None


class NotificationList(BaseModel):
    unread_count: int
    notifications: List[NotificationOut]


# ── Legacy / S3 presign ─────────────────────────────────────────────────────

class StoryViewCreate(BaseModel):
    viewer_id: Optional[uuid.UUID] = None  # ignored: the viewer is always the logged-in user


class PresignRequest(BaseModel):
    """Client asks for a presigned URL before uploading to S3."""
    user_id: Optional[uuid.UUID] = None  # ignored: the owner is always the logged-in user
    filename: str        # e.g. "story.mp4" — used to derive S3 key
    content_type: str    # e.g. "video/mp4" or "image/jpeg"


class PresignResponse(BaseModel):
    upload_url: str      # PUT this URL with the raw file bytes
    media_url: str       # Store this in StoryCreate.media_url after upload
    expires_in: int      # seconds until presigned URL expires
