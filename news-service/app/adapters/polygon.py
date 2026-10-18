"""
Adapter for Polygon.io News API
Docs: https://polygon.io/docs/stocks/get_v2_reference_news

Pricing (as of 2024):
  - Starter: Free — 5 API calls/min, 2 years history
  - Starter paid: $29/mo — unlimited calls
  - Advanced: $79/mo — real-time data
  - Business: $199/mo — WebSocket + full history

Key features:
  - Returns ticker symbols in insights[].ticker
  - Sentiment labels per ticker (positive/negative/neutral)
  - publisher info (name, homepage_url, logo_url)
  - Proper pagination via cursor

Required env vars:
  NEWS_API_KEY=<your_polygon_key>
"""
from datetime import datetime, timezone
from typing import List, Optional

import requests

from ..config import settings
from .base import BaseNewsAdapter

_BASE_URL = "https://api.polygon.io/v2/reference/news"


class PolygonAdapter(BaseNewsAdapter):
    def fetch(self, query: str, page_size: int, category: Optional[str] = None) -> List[dict]:
        resp = requests.get(
            _BASE_URL,
            params={
                "apiKey": settings.news_api_key,
                "limit": min(page_size, 1000),
                "order": "desc",
                "sort": "published_utc",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("status") not in ("OK", "ok"):
            raise RuntimeError(f"Polygon error: {data.get('error', data)}")
        return data.get("results", [])

    def normalize(self, raw: dict) -> dict:
        pub_raw = raw.get("published_utc", "")
        try:
            published_at = datetime.fromisoformat(pub_raw.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            published_at = datetime.now(timezone.utc)

        # Extract ticker symbols from insights array
        symbols = [
            insight.get("ticker", "").upper()
            for insight in raw.get("insights", [])
            if insight.get("ticker")
        ]

        publisher = raw.get("publisher", {})
        source = publisher.get("name", "unknown")

        return {
            "title": raw.get("title") or "Untitled",
            "summary": raw.get("description"),
            "source": source,
            "source_url": raw.get("article_url", ""),
            "image_url": raw.get("image_url"),
            "category": settings.default_category,
            "related_symbols": symbols,
            "published_at": published_at,
        }
