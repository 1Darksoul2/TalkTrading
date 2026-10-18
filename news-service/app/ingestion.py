"""
News ingestion worker.

Run on a schedule — NOT part of the API process:
  - Kubernetes:  CronJob every 10 minutes
  - Celery beat: periodic task
  - Plain cron:  */10 * * * * python -m app.ingestion

This worker is fully API-agnostic:
  1. Reads NEWS_PROVIDER env var
  2. Instantiates the matching adapter from app/adapters/
  3. Fetches articles, normalises them, and upserts (dedupes on source_url)

To switch providers, change NEWS_PROVIDER and restart — no code changes needed.

Supported providers:
  newsapi        — https://newsapi.org
  alphavantage   — https://www.alphavantage.co
  finnhub        — https://finnhub.io
  polygon        — https://polygon.io
  gnews          — https://gnews.io
  mediastack     — https://mediastack.com
"""
import logging
from typing import Optional

from .config import settings
from .database import SessionLocal
from . import crud
from .adapters.base import get_adapter

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


def run(category: Optional[str] = None) -> None:
    adapter = get_adapter()
    logger.info("Starting ingestion with provider: %s (category=%s)", settings.news_provider, category or "default")

    try:
        raw_articles = adapter.fetch(settings.news_query, settings.news_page_size, category=category)
    except Exception as exc:
        logger.error("Failed to fetch from provider: %s", exc)
        return

    db = SessionLocal()
    inserted = 0
    skipped = 0
    try:
        for raw in raw_articles:
            try:
                normalized = adapter.normalize(raw)
            except (KeyError, ValueError) as exc:
                logger.warning("Skipping malformed article: %s | raw=%s", exc, raw)
                skipped += 1
                continue

            if not normalized.get("source_url"):
                logger.warning("Skipping article with no source_url: %s", normalized.get("title"))
                skipped += 1
                continue

            result = crud.upsert_article(db, normalized)
            if result:
                inserted += 1
            else:
                skipped += 1  # already exists

        logger.info(
            "Ingestion complete | provider=%s inserted=%d skipped=%d total_fetched=%d",
            settings.news_provider,
            inserted,
            skipped,
            len(raw_articles),
        )
    finally:
        db.close()


if __name__ == "__main__":
    run()
