import uuid
from typing import Optional, List

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models


# ── Articles ──────────────────────────────────────────────────────────────────

def upsert_article(db: Session, data: dict) -> Optional[models.Article]:
    """
    Insert an article if its source_url hasn't been seen before.
    Returns the new Article on insert, None if it already existed (dedup).
    """
    existing = db.query(models.Article).filter_by(source_url=data["source_url"]).first()
    if existing:
        return None

    article = models.Article(**data)
    db.add(article)
    try:
        db.commit()
        db.refresh(article)
        return article
    except IntegrityError:
        db.rollback()
        return None


def get_articles(
    db: Session,
    category: Optional[str] = None,
    symbol: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> tuple[int, List[models.Article]]:
    """
    Returns (total_count, page_of_articles).
    Filters:
      category — exact match on article.category
      symbol   — checks if the symbol is in article.related_symbols (ARRAY contains)
    """
    q = db.query(models.Article)

    if category:
        q = q.filter(models.Article.category == category)
    if symbol:
        from sqlalchemy import String
        q = q.filter(models.Article.related_symbols.cast(String).like(f'%"{symbol.upper()}"%'))

    total = q.count()
    items = q.order_by(models.Article.published_at.desc()).offset(offset).limit(limit).all()
    return total, items


def get_article_by_id(db: Session, article_id: uuid.UUID) -> Optional[models.Article]:
    return db.query(models.Article).filter_by(id=article_id).first()


# ── Bookmarks ─────────────────────────────────────────────────────────────────

def create_bookmark(db: Session, user_id: uuid.UUID, article_id: uuid.UUID) -> Optional[models.Bookmark]:
    """
    Bookmark an article for a user.
    Returns None if already bookmarked (idempotent).
    """
    existing = db.query(models.Bookmark).filter_by(user_id=user_id, article_id=article_id).first()
    if existing:
        return existing

    bookmark = models.Bookmark(user_id=user_id, article_id=article_id)
    db.add(bookmark)
    try:
        db.commit()
        db.refresh(bookmark)
        return bookmark
    except IntegrityError:
        db.rollback()
        return None


def delete_bookmark(db: Session, user_id: uuid.UUID, article_id: uuid.UUID) -> bool:
    bookmark = db.query(models.Bookmark).filter_by(user_id=user_id, article_id=article_id).first()
    if not bookmark:
        return False
    db.delete(bookmark)
    db.commit()
    return True


def get_bookmarks_with_articles(db: Session, user_id: uuid.UUID) -> List[models.Bookmark]:
    """
    Returns bookmarks joined with their articles for a user.
    Articles are accessible via bookmark.article.
    """
    return (
        db.query(models.Bookmark)
        .filter_by(user_id=user_id)
        .join(models.Article)
        .order_by(models.Bookmark.created_at.desc())
        .all()
    )
