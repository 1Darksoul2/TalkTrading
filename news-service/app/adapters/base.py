"""
Abstract base class that every news provider adapter must implement.

To add a new provider:
  1. Create a new file in this package (e.g. my_provider.py)
  2. Subclass BaseNewsAdapter and implement fetch() and normalize()
  3. Register the class in get_adapter() below

The ingestion worker calls:
  adapter = get_adapter()
  raw_items = adapter.fetch(query, page_size)
  articles  = [adapter.normalize(r) for r in raw_items]
"""
from abc import ABC, abstractmethod
from typing import List, Optional


class BaseNewsAdapter(ABC):
    """
    Each adapter must:
    - fetch()     → return a list of provider-specific raw article dicts
    - normalize() → convert one raw dict into the canonical article dict
                    expected by crud.upsert_article()

    Canonical article dict shape:
    {
        "title":           str,
        "summary":         str | None,
        "source":          str,
        "source_url":      str,          # unique dedup key
        "image_url":       str | None,
        "category":        str,          # e.g. "markets"
        "related_symbols": list[str],    # e.g. ["AAPL", "BTC"]
        "published_at":    datetime,     # timezone-aware
    }
    """

    @abstractmethod
    def fetch(self, query: str, page_size: int, category: Optional[str] = None) -> List[dict]:
        """
        Hit the provider's API and return a list of raw article dicts.
        `category`, when given and supported by the provider, scopes the
        fetch to that category (e.g. Finnhub's general/forex/crypto/merger).
        Adapters that don't support server-side category scoping ignore it.
        """

    @abstractmethod
    def normalize(self, raw: dict) -> dict:
        """Convert a raw provider dict to the canonical article dict."""


# ── Adapter registry ──────────────────────────────────────────────────────────

def get_adapter() -> BaseNewsAdapter:
    """
    Reads NEWS_PROVIDER from config and returns the matching adapter.
    Raises ValueError if the provider name is unknown.
    """
    from ..config import settings

    provider = settings.news_provider.lower().strip()

    if provider == "newsapi":
        from .newsapi import NewsApiAdapter
        return NewsApiAdapter()
    elif provider == "alphavantage":
        from .alphavantage import AlphaVantageAdapter
        return AlphaVantageAdapter()
    elif provider == "finnhub":
        from .finnhub import FinnhubAdapter
        return FinnhubAdapter()
    elif provider == "polygon":
        from .polygon import PolygonAdapter
        return PolygonAdapter()
    elif provider == "gnews":
        from .gnews import GNewsAdapter
        return GNewsAdapter()
    elif provider == "mediastack":
        from .mediastack import MediastackAdapter
        return MediastackAdapter()
    else:
        raise ValueError(
            f"Unknown NEWS_PROVIDER='{provider}'. "
            f"Supported: newsapi, alphavantage, finnhub, polygon, gnews, mediastack"
        )
