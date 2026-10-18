"""
News Service — FastAPI application entry point.

Endpoints:
  GET  /health                         — liveness probe
  GET  /news                           — paginated, filterable article feed
  GET  /news/bookmarks                 — your bookmarked articles (login required)
  GET  /news/{id}                      — single article by UUID
  PUT  /news/{id}/bookmark             — bookmark an article (login required, idempotent)
  DELETE /news/{id}/bookmark           — remove a bookmark (login required)
"""
import uuid
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import models, schemas, crud, ingestion
from .auth import get_current_user_id
from .config import settings
from .database import engine, get_db

# ── Bootstrap ──────────────────────────────────────────────────────────────────
models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(_app):
    """Fetch news at start-up so the feed is not empty on first visit."""
    try:
        ingestion.run()
    except Exception as e:
        print(f"Startup ingestion notice: {e}")
    yield


app = FastAPI(
    lifespan=lifespan,
    title="News Service",
    description=(
        "Ingests and serves market/trading news for TalkTrading. "
        "Provider-agnostic: switch NEWS_PROVIDER env var to change source."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_methods=["GET", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── Health ─────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["ops"])
def health():
    """Liveness probe — returns 200 if the service is up."""
    return {
        "status": "ok",
        "service": "news-service",
        "provider": settings.news_provider,
    }


# ── News Feed ──────────────────────────────────────────────────────────────────

@app.get("/news", response_model=schemas.ArticleList, tags=["news"])
def get_news_feed(
    category: Optional[str] = Query(None, description="Filter by category, e.g. 'markets', 'crypto'"),
    symbol: Optional[str] = Query(None, description="Filter by ticker symbol, e.g. 'AAPL'"),
    limit: int = Query(settings.news_feed_default_limit, ge=1, le=settings.news_feed_max_limit),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Paginated news feed.  Filter by category and/or ticker symbol.
    Returns most-recent articles first.
    """
    total, items = crud.get_articles(db, category=category, symbol=symbol, limit=limit, offset=offset)
    if total == 0 and not category and not symbol:
        try:
            ingestion.run()
            total, items = crud.get_articles(db, category=category, symbol=symbol, limit=limit, offset=offset)
        except Exception as e:
            print(f"Auto-ingestion notice: {e}")
    return schemas.ArticleList(total=total, limit=limit, offset=offset, items=items)



# ── Bookmarks (list route before /{id} to avoid routing conflict) ──────────────

@app.get("/news/bookmarks", response_model=List[schemas.BookmarkWithArticle], tags=["bookmarks"])
def get_my_bookmarks(user_id: uuid.UUID = Depends(get_current_user_id), db: Session = Depends(get_db)):
    """Your bookmarked articles, most recently saved first."""
    return [
        schemas.BookmarkWithArticle(bookmark_id=bm.id, bookmarked_at=bm.created_at, article=bm.article)
        for bm in crud.get_bookmarks_with_articles(db, user_id)
    ]


# ── Single Article ─────────────────────────────────────────────────────────────

@app.get("/news/{article_id}", response_model=schemas.ArticleOut, tags=["news"])
def get_article(article_id: uuid.UUID, db: Session = Depends(get_db)):
    """Fetch a single article by its UUID."""
    article = crud.get_article_by_id(db, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


# ── Bookmark ───────────────────────────────────────────────────────────────────

@app.put("/news/{article_id}/bookmark", response_model=schemas.BookmarkOut, tags=["bookmarks"])
def bookmark_article(
    article_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Bookmark an article for yourself. Saving twice returns the existing bookmark."""
    if not crud.get_article_by_id(db, article_id):
        raise HTTPException(status_code=404, detail="Article not found")
    bookmark = crud.create_bookmark(db, user_id, article_id)
    if not bookmark:  # lost a race with a parallel save of the same article
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already bookmarked")
    return bookmark


@app.delete("/news/{article_id}/bookmark", status_code=204, tags=["bookmarks"])
def unbookmark_article(
    article_id: uuid.UUID,
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    """Remove one of your bookmarks. 404 if you had not saved it."""
    if not crud.delete_bookmark(db, user_id, article_id):
        raise HTTPException(status_code=404, detail="Bookmark not found")
