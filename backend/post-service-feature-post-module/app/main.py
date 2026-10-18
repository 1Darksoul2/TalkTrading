import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.logging import CorrelationIdMiddleware
from app.database.database import Base, engine

# Import all SQLAlchemy models for table creation
from app.models.user import User
from app.models.post import Post
from app.models.comment import Comment
from app.models.like import Like
from app.models.save import Save
from app.models.media import Media
from app.models.share import Share
from app.models.hashtag import Hashtag, post_hashtags
from app.models.mention import Mention
from app.models.follow import Follow
from app.models.notification import Notification

# Import API Routers
from app.api.routes.health import router as health_router
from app.api.routes.posts import router as posts_router
from app.api.routes.comments import router as comments_router
from app.api.routes.likes import router as likes_router
from app.api.routes.saves import router as saves_router
from app.api.routes.media import router as media_router
from app.api.routes.feed import router as feed_router
from app.api.routes.shares import router as shares_router
from app.api.routes.hashtags import router as hashtags_router
from app.api.routes.follows import router as follows_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.profiles import router as profiles_router

# Import legacy auth router for backward compatibility testing
from app.api.auth import router as auth_router

# Database tables are initialized via Alembic migrations (e.g. `alembic upgrade head`)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
Production Social Content & Post Microservice handling posts, nested comment replies,
likes, saves/bookmarks, media storage, feed generation, hashtags, mentions, and shares.
""",
    version=settings.VERSION,
    docs_url="/docs",
    openapi_url="/openapi.json",
)

# Initialize database tables automatically for SQLite and local dev
try:
    Base.metadata.create_all(bind=engine)
    from app.database.lite_migrations import ensure_user_columns
    ensure_user_columns(engine)
except Exception as e:
    import logging
    logging.getLogger(__name__).error("Database initialisation failed: %s", e)

# Correlation ID Middleware & Secure CORS Middleware
app.add_middleware(CorrelationIdMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve local uploads statically for local dev
os.makedirs(settings.LOCAL_STORAGE_DIR, exist_ok=True)
app.mount("/static/uploads", StaticFiles(directory=settings.LOCAL_STORAGE_DIR), name="uploads")

# Mount Versioned API Routes under /api/v1
v1_prefix = settings.API_V1_STR
app.include_router(health_router, prefix=v1_prefix)
app.include_router(profiles_router, prefix=v1_prefix)
app.include_router(posts_router, prefix=v1_prefix)
app.include_router(comments_router, prefix=v1_prefix)
app.include_router(likes_router, prefix=v1_prefix)
app.include_router(saves_router, prefix=v1_prefix)
app.include_router(media_router, prefix=v1_prefix)
app.include_router(feed_router, prefix=v1_prefix)
app.include_router(shares_router, prefix=v1_prefix)
app.include_router(hashtags_router, prefix=v1_prefix)
app.include_router(follows_router, prefix=v1_prefix)
app.include_router(notifications_router, prefix=v1_prefix)

# Mount Legacy Unversioned Routes for Backward Compatibility
app.include_router(health_router)
app.include_router(profiles_router)
app.include_router(posts_router)
app.include_router(comments_router)
app.include_router(likes_router)
app.include_router(saves_router)
app.include_router(media_router)
app.include_router(feed_router)
app.include_router(shares_router)
app.include_router(hashtags_router)
app.include_router(follows_router)
app.include_router(notifications_router)
app.include_router(auth_router)


@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "api_v1_docs": f"{settings.API_V1_STR}/docs",
        "docs": "/docs",
    }