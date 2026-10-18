import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, AnyHttpUrl


# ── Article ───────────────────────────────────────────────────────────────────

class ArticleOut(BaseModel):
    id: uuid.UUID
    title: str
    summary: Optional[str]
    source: str
    source_url: str
    image_url: Optional[str]
    category: str
    related_symbols: List[str]
    published_at: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


class ArticleList(BaseModel):
    """Paginated list wrapper."""
    total: int
    limit: int
    offset: int
    items: List[ArticleOut]


# ── Bookmark ──────────────────────────────────────────────────────────────────

class BookmarkOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    article_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


class BookmarkWithArticle(BaseModel):
    """Full article data embedded in the bookmark — for GET /news/bookmarks."""
    bookmark_id: uuid.UUID
    bookmarked_at: datetime
    article: ArticleOut
