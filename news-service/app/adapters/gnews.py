"""
Adapter for GNews API
Docs: https://gnews.io/docs/v4

Pricing (as of 2024):
  - Free:    100 requests/day, 10 articles/request
  - Basic:   $9/mo — 3000 req/day, 100 articles/req
  - Standard: $49/mo — 10 000 req/day
  - Pro:     $99/mo — unlimited

Key features:
  - Simple REST, broad topic coverage
  - Topics: breaking-news, world, nation, business, technology, entertainment, sports, science, health
  - Language + country filters

Required env vars:
  NEWS_API_KEY=<your_gnews_key>
"""
from datetime import datetime, timezone
from typing import List, Optional

import requests

from ..config import settings
from .base import BaseNewsAdapter

_BASE_URL = "https://gnews.io/api/v4/search"

_TOPIC_MAP = {
    "business": "markets",
    "technology": "technology",
    "science": "science",
    "health": "health",
    "sports": "sports",
    "entertainment": "entertainment",
    "nation": "nation",
    "world": "world",
}


class GNewsAdapter(BaseNewsAdapter):
    def fetch(self, query: str, page_size: int, category: Optional[str] = None) -> List[dict]:
        resp = requests.get(
            _BASE_URL,
            params={
                "q": query,
                "token": settings.news_api_key,
                "lang": "en",
                "max": min(page_size, 100),  # GNews max per plan
                "sortby": "publishedAt",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if "articles" not in data:
            raise RuntimeError(f"GNews error: {data.get('errors', data)}")
        return data["articles"]

    def normalize(self, raw: dict) -> dict:
        pub_raw = raw.get("publishedAt", "")
        try:
            published_at = datetime.fromisoformat(pub_raw.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            published_at = datetime.now(timezone.utc)

        return {
            "title": raw.get("title") or "Untitled",
            "summary": raw.get("description"),
            "source": raw.get("source", {}).get("name", "unknown"),
            "source_url": raw.get("url", ""),
            "image_url": raw.get("image"),
            "category": settings.default_category,
            "related_symbols": [],  # GNews doesn't tag tickers
            "published_at": published_at,
        }
