"""
Adapter for NewsAPI.org
Docs: https://newsapi.org/docs/endpoints/everything

Pricing (as of 2024):
  - Free tier:    100 requests/day, 1-month-old articles, no commercial use
  - Developer:    $449/mo — 250 req/day, 1 year history
  - Business:     $999/mo — unlimited requests

Required env vars:
  NEWS_API_KEY=<your_newsapi_key>
"""
from datetime import datetime, timezone
from typing import List, Optional

import requests

from ..config import settings
from .base import BaseNewsAdapter

_BASE_URL = "https://newsapi.org/v2/everything"


class NewsApiAdapter(BaseNewsAdapter):
    def fetch(self, query: str, page_size: int, category: Optional[str] = None) -> List[dict]:
        resp = requests.get(
            _BASE_URL,
            params={
                "q": query,
                "apiKey": settings.news_api_key,
                "sortBy": "publishedAt",
                "pageSize": min(page_size, 100),  # NewsAPI cap
                "language": "en",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") != "ok":
            raise RuntimeError(f"NewsAPI error: {data.get('message', 'unknown')}")
        return data.get("articles", [])

    def normalize(self, raw: dict) -> dict:
        published_raw = raw.get("publishedAt", "")
        published_at = (
            datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
            if published_raw
            else datetime.now(timezone.utc)
        )
        return {
            "title": raw.get("title") or "Untitled",
            "summary": raw.get("description"),
            "source": raw.get("source", {}).get("name", "unknown"),
            "source_url": raw.get("url", ""),
            "image_url": raw.get("urlToImage"),
            "category": settings.default_category,
            "related_symbols": [],   # NewsAPI doesn't tag symbols
            "published_at": published_at,
        }
