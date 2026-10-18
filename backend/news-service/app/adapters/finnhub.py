"""
Adapter for Finnhub News API
Docs: https://finnhub.io/docs/api/market-news

Pricing (as of 2024):
  - Free:       60 API calls/minute
  - Starter:    $0/mo (generous free tier for market news)
  - Premium:    $99+/mo for real-time + more endpoints

Key features:
  - General market news + company-specific news (by ticker)
  - Returns category field directly
  - No auth complexity — single API key

Required env vars:
  NEWS_API_KEY=<your_finnhub_key>
"""
from datetime import datetime, timezone
from typing import List, Optional

import requests

from ..config import settings
from .base import BaseNewsAdapter

_BASE_URL = "https://finnhub.io/api/v1/news"

# Finnhub category values we support
_VALID_CATEGORIES = {"general", "forex", "crypto", "merger"}


class FinnhubAdapter(BaseNewsAdapter):
    def fetch(self, query: str, page_size: int, category: Optional[str] = None) -> List[dict]:
        requested_category = category if category in _VALID_CATEGORIES else "general"
        # Finnhub's /news response items don't reliably echo a per-article
        # category field back, so normalize() reads the category actually
        # requested from this instance attribute rather than trusting raw data.
        self._requested_category = requested_category
        resp = requests.get(
            _BASE_URL,
            params={
                "category": requested_category,
                "token": settings.news_api_key,
                "minId": 0,
            },
            timeout=15,
        )
        resp.raise_for_status()
        articles = resp.json()
        if not isinstance(articles, list):
            raise RuntimeError(f"Finnhub unexpected response: {articles}")
        return articles[:page_size]

    def normalize(self, raw: dict) -> dict:
        ts = raw.get("datetime", 0)
        published_at = (
            datetime.fromtimestamp(ts, tz=timezone.utc)
            if ts
            else datetime.now(timezone.utc)
        )
        category = raw.get("category") or getattr(self, "_requested_category", "general")
        if category not in _VALID_CATEGORIES:
            category = getattr(self, "_requested_category", "general")

        # Finnhub occasionally embeds related tickers in the summary/headline
        # but doesn't return them structured, so we leave symbols empty.
        return {
            "title": raw.get("headline") or "Untitled",
            "summary": raw.get("summary"),
            "source": raw.get("source", "unknown"),
            "source_url": raw.get("url", ""),
            "image_url": raw.get("image"),
            "category": category,
            "related_symbols": [],
            "published_at": published_at,
        }
