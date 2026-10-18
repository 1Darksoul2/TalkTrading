"""
Adapter for Alpha Vantage News & Sentiment API
Docs: https://www.alphavantage.co/documentation/#news-sentiment

Pricing (as of 2024):
  - Free:      25 requests/day
  - Premium:   $50/mo — 600 req/min
  - Enterprise: $250/mo — unlimited

Key features:
  - Returns ticker symbols and relevance scores per article
  - Sentiment labels (Bullish / Bearish / Neutral)
  - Categorised by topic (technology, earnings, etc.)

Required env vars:
  NEWS_API_KEY=<your_alphavantage_key>
"""
from datetime import datetime, timezone
from typing import List, Optional

import requests

from ..config import settings
from .base import BaseNewsAdapter

_BASE_URL = "https://www.alphavantage.co/query"

# Map Alpha Vantage topics to our internal categories
_TOPIC_MAP = {
    "earnings": "earnings",
    "ipo": "ipo",
    "mergers_and_acquisitions": "mergers",
    "financial_markets": "markets",
    "economy_fiscal": "economy",
    "economy_macro": "economy",
    "technology": "technology",
    "real_estate": "real_estate",
    "blockchain": "crypto",
}


def _parse_dt(raw: str) -> datetime:
    """Parse YYYYMMDDTHHMMSS format returned by Alpha Vantage."""
    try:
        return datetime.strptime(raw, "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return datetime.now(timezone.utc)


class AlphaVantageAdapter(BaseNewsAdapter):
    def fetch(self, query: str, page_size: int, category: Optional[str] = None) -> List[dict]:
        # Alpha Vantage uses 'tickers' or 'topics' instead of a text query.
        # Map our query to a topics filter when possible.
        resp = requests.get(
            _BASE_URL,
            params={
                "function": "NEWS_SENTIMENT",
                "apikey": settings.news_api_key,
                "limit": min(page_size, 1000),
                "sort": "LATEST",
            },
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        if "feed" not in data:
            raise RuntimeError(f"Alpha Vantage error: {data.get('Information', data)}")
        return data["feed"]

    def normalize(self, raw: dict) -> dict:
        # Extract ticker symbols from the ticker_sentiment list
        symbols = [
            ts["ticker"].upper()
            for ts in raw.get("ticker_sentiment", [])
            if ts.get("ticker")
        ]

        # Determine category from topics
        topics = raw.get("topics", [])
        category = settings.default_category
        for topic_item in topics:
            topic_key = topic_item.get("topic", "").lower().replace(" ", "_")
            if topic_key in _TOPIC_MAP:
                category = _TOPIC_MAP[topic_key]
                break

        return {
            "title": raw.get("title") or "Untitled",
            "summary": raw.get("summary"),
            "source": raw.get("source", "unknown"),
            "source_url": raw.get("url", ""),
            "image_url": raw.get("banner_image"),
            "category": category,
            "related_symbols": symbols,
            "published_at": _parse_dt(raw.get("time_published", "")),
        }
