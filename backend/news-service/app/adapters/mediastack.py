"""
Adapter for Mediastack News API
Docs: https://mediastack.com/documentation

Pricing (as of 2024):
  - Free:    500 requests/month (HTTP only)
  - Basic:   $9.99/mo — 10 000 req/mo, HTTPS
  - Standard: $39.99/mo — 100 000 req/mo
  - Professional: $99.99/mo — unlimited

Key features:
  - Broad global coverage, 7 500+ news sources
  - Category + country + language filters
  - No ticker symbol tagging

Required env vars:
  NEWS_API_KEY=<your_mediastack_key>

Note: Free tier uses HTTP only. Upgrade to Basic+ for HTTPS.
"""
from datetime import datetime, timezone
from typing import List, Optional

import requests

from ..config import settings
from .base import BaseNewsAdapter

# NOTE: Free tier is HTTP. Change to https for paid plans.
_BASE_URL = "http://api.mediastack.com/v1/news"

_CATEGORY_MAP = {
    "business": "markets",
    "technology": "technology",
    "science": "science",
    "health": "health",
    "sports": "sports",
    "entertainment": "entertainment",
    "general": "markets",
}


class MediastackAdapter(BaseNewsAdapter):
    def fetch(self, query: str, page_size: int, category: Optional[str] = None) -> List[dict]:
        resp = requests.get(
            _BASE_URL,
            params={
                "access_key": settings.news_api_key,
                "keywords": query,
                "languages": "en",
                "limit": min(page_size, 100),
                "sort": "published_desc",
                "categories": "business,technology,general",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise RuntimeError(f"Mediastack error: {data['error']}")
        return data.get("data", [])

    def normalize(self, raw: dict) -> dict:
        pub_raw = raw.get("published_at", "")
        try:
            published_at = datetime.fromisoformat(pub_raw.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            published_at = datetime.now(timezone.utc)

        cat_raw = raw.get("category", "general").lower()
        category = _CATEGORY_MAP.get(cat_raw, settings.default_category)

        return {
            "title": raw.get("title") or "Untitled",
            "summary": raw.get("description"),
            "source": raw.get("source", "unknown"),
            "source_url": raw.get("url", ""),
            "image_url": raw.get("image"),
            "category": category,
            "related_symbols": [],
            "published_at": published_at,
        }
