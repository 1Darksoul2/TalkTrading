"""
Story Service — FastAPI application entry point.

Stories, Highlights, Close Friends, story privacy and settings, story notifications. Identity comes from
the login JWT; the social graph is read through the Post Service's public API (see graph.py).
All routes are in routes.py.
"""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from . import lite_migrations, models
from .config import settings
from .database import SessionLocal, engine
from .purge import purge_expired
from .stories_service import send_countdown_reminders
from .routes import limiter, router
from .gateway import router as gateway_router

logger = logging.getLogger(__name__)

# ── Bootstrap ──────────────────────────────────────────────────────────────
models.Base.metadata.create_all(bind=engine)
lite_migrations.run(engine)


async def _purge_loop() -> None:
    """Every minute: send due countdown reminders. Every PURGE_INTERVAL_MINUTES: reclaim storage.
    Failures are logged and retried; they never stop the service."""
    def run(full: bool) -> None:
        db = SessionLocal()
        try:
            if full:
                purge_expired(db)          # also sends reminders
            else:
                send_countdown_reminders(db)
        finally:
            db.close()

    minutes = 0
    while True:
        await asyncio.sleep(60)
        minutes += 1
        try:
            await asyncio.to_thread(run, minutes % settings.purge_interval_minutes == 0)
        except Exception:  # noqa: BLE001
            logger.exception("Story housekeeping failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_purge_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title="Story Service",
    description="Stories, Highlights, Close Friends and story privacy for TalkTrading.",
    version="2.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(router)
app.include_router(gateway_router)


@app.get("/health", tags=["ops"])
def health():
    """Liveness probe — returns 200 if the service is up."""
    return {"status": "ok", "service": "story-service"}
