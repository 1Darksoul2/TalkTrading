"""
Unit tests for the News Service CRUD layer.

Uses in-memory SQLite — no running Postgres required.
ARRAY(String) columns fall back to JSON-serialised strings in SQLite.

Run with:  pytest news-service/tests/ -v
"""
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app import models, crud

SQLALCHEMY_DATABASE_URL = "sqlite://"


@pytest.fixture(scope="function")
def db():
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


def _article_data(source_url: str | None = None) -> dict:
    return {
        "title": "Test Article",
        "summary": "A test summary",
        "source": "Test Source",
        "source_url": source_url or f"https://example.com/{uuid.uuid4()}",
        "image_url": None,
        "category": "markets",
        "related_symbols": ["AAPL", "MSFT"],
        "published_at": datetime.now(timezone.utc),
    }


# ── upsert_article ─────────────────────────────────────────────────────────────

class TestUpsertArticle:
    def test_inserts_new_article(self, db):
        result = crud.upsert_article(db, _article_data())
        assert result is not None
        assert result.title == "Test Article"

    def test_deduplicates_by_source_url(self, db):
        url = "https://example.com/unique-story"
        crud.upsert_article(db, _article_data(source_url=url))
        result2 = crud.upsert_article(db, _article_data(source_url=url))
        assert result2 is None  # duplicate — returns None

    def test_different_urls_both_inserted(self, db):
        crud.upsert_article(db, _article_data())
        crud.upsert_article(db, _article_data())
        total, items = crud.get_articles(db)
        assert total == 2


# ── get_articles ───────────────────────────────────────────────────────────────

class TestGetArticles:
    def test_returns_all_articles(self, db):
        crud.upsert_article(db, _article_data())
        crud.upsert_article(db, _article_data())
        total, items = crud.get_articles(db)
        assert total == 2
        assert len(items) == 2

    def test_category_filter(self, db):
        data = _article_data()
        data["category"] = "crypto"
        crud.upsert_article(db, data)
        crud.upsert_article(db, _article_data())  # category=markets

        total, items = crud.get_articles(db, category="crypto")
        assert total == 1
        assert items[0].category == "crypto"

    def test_pagination(self, db):
        for _ in range(5):
            crud.upsert_article(db, _article_data())
        total, items = crud.get_articles(db, limit=2, offset=0)
        assert total == 5
        assert len(items) == 2

    def test_pagination_offset(self, db):
        for _ in range(5):
            crud.upsert_article(db, _article_data())
        total, items = crud.get_articles(db, limit=10, offset=3)
        assert len(items) == 2


# ── bookmarks ──────────────────────────────────────────────────────────────────

class TestBookmarks:
    def _article(self, db):
        return crud.upsert_article(db, _article_data())

    def test_create_bookmark(self, db):
        article = self._article(db)
        user_id = uuid.uuid4()
        bm = crud.create_bookmark(db, user_id, article.id)
        assert bm is not None
        assert str(bm.user_id) == str(user_id)

    def test_idempotent_bookmark(self, db):
        article = self._article(db)
        user_id = uuid.uuid4()
        bm1 = crud.create_bookmark(db, user_id, article.id)
        bm2 = crud.create_bookmark(db, user_id, article.id)
        # Second call returns the existing bookmark (same id)
        assert str(bm1.id) == str(bm2.id)

    def test_delete_bookmark(self, db):
        article = self._article(db)
        user_id = uuid.uuid4()
        crud.create_bookmark(db, user_id, article.id)
        result = crud.delete_bookmark(db, user_id, article.id)
        assert result is True

    def test_delete_nonexistent_bookmark(self, db):
        result = crud.delete_bookmark(db, uuid.uuid4(), uuid.uuid4())
        assert result is False

    def test_get_bookmarks_with_articles(self, db):
        article = self._article(db)
        user_id = uuid.uuid4()
        crud.create_bookmark(db, user_id, article.id)
        bookmarks = crud.get_bookmarks_with_articles(db, user_id)
        assert len(bookmarks) == 1
        assert bookmarks[0].article.title == "Test Article"
