# Professional Reel Microservice Implementation Plan

## Architecture & Technology Stack
- **Framework**: FastAPI (async ASGI framework)
- **ORM & Database**: SQLAlchemy 2.0 (mapped columns, async-compatible patterns, SQLite local dev + PostgreSQL production engine switching)
- **Validation & Serialization**: Pydantic v2 & Pydantic-Settings
- **Database Migrations**: Alembic
- **Auth & Security**: Stateless JWT verification (HMAC SHA256 & asymmetric RS256/ES256 compatibility), Service-to-Service API Key auth, Role-based and Ownership-based access control
- **Zero Mandatory Infrastructure**: In-memory rate limiting and analytics buffering with pluggable interfaces for Redis/PostgreSQL when deployed in scale.

---

## Directory Structure Design
```
Reel/
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── api.py                  # API router assembly
│   │       ├── deps.py                 # Common dependencies (DB, Auth, Pagination)
│   │       ├── endpoints/
│   │       │   ├── health.py           # Health & readiness checks
│   │       │   ├── reels.py            # Reel CRUD, media metadata
│   │       │   ├── feed.py             # Public & personalized feed pagination
│   │       │   ├── interactions.py     # Likes, shares, bookmarks
│   │       │   ├── comments.py         # Nested comments & replies
│   │       │   ├── ads.py              # Ad campaigns, slots, impressions, clicks
│   │       │   ├── moderation.py       # Reports, review, auto-filter
│   │       │   └── analytics.py        # Reel performance & engagement stats
│   ├── core/
│   │   ├── config.py                   # Pydantic Settings & environment variables
│   │   ├── security.py                 # JWT decoding, API Key verification, hashing
│   │   ├── rate_limit.py               # Token bucket / sliding window rate limiter
│   │   └── exceptions.py               # Custom exceptions & global handlers
│   ├── db/
│   │   ├── base.py                     # Declarative Base & metadata
│   │   └── session.py                  # Engine, sessionmaker, SQLite/PostgreSQL handling
│   ├── models/
│   │   ├── __init__.py
│   │   ├── reel.py                     # Reel, ReelMedia, AudioTrack models
│   │   ├── interaction.py              # Like, Bookmark, Share models
│   │   ├── comment.py                  # Comment & Reply models
│   │   ├── ad.py                       # AdCampaign, AdImpression, AdClick models
│   │   ├── moderation.py               # Report, ModerationLog models
│   │   └── analytics.py                # ReelMetric daily/event counter
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── common.py                   # Pagination, standard response wrappers
│   │   ├── reel.py                     # ReelCreate, ReelUpdate, ReelResponse
│   │   ├── interaction.py              # LikeResponse, ShareCreate, BookmarkResponse
│   │   ├── comment.py                  # CommentCreate, CommentResponse
│   │   ├── ad.py                       # Ad schemas & tracking payload
│   │   └── moderation.py               # ReportCreate, ModerationStatusUpdate
│   ├── services/
│   │   ├── reel_service.py             # Reel business logic & counters
│   │   ├── feed_service.py             # Feed ranking, blending ads into feed
│   │   ├── interaction_service.py      # Atomically manage likes/bookmarks/shares
│   │   ├── comment_service.py          # Hierarchy comment resolution
│   │   ├── ad_service.py               # Ad serving & tracking logic
│   │   └── moderation_service.py       # Content filtering & flag handling
│   └── main.py                         # FastAPI app factory, middleware, CORS, docs
├── tests/
│   ├── conftest.py                     # Test fixtures, test client, test DB
│   ├── test_health.py                  # Phase 1 verification
│   ├── test_reels.py                   # Phase 2 CRUD & Feed verification
│   ├── test_interactions.py           # Phase 2 Likes, comments, bookmarks
│   ├── test_auth.py                    # Phase 3 JWT, S2S API keys, permissions
│   ├── test_ads.py                     # Phase 4 Ad campaigns & tracking
│   ├── test_moderation.py              # Phase 5 Reporting & rate limiting
│   └── test_edge_cases.py              # Phase 7 Edge cases & error handling
├── alembic.ini
├── requirements.txt
├── requirements-dev.txt
├── .env.example
└── README.md
```

---

## 8-Phase Execution Roadmap

### Phase 1: Project Structure, Configuration, Database & Health Checks
- Setup `requirements.txt` with FastAPI, uvicorn, SQLAlchemy 2, pydantic, pydantic-settings, python-jose, passlib, etc.
- Implement `app/core/config.py` using `BaseSettings` reading from `.env` (SQLite default, PostgreSQL ready).
- Implement `app/db/session.py` with SQLite compatibility (handling `check_same_thread=False` and foreign keys pragma).
- Setup health endpoints: `/health`, `/ready` (DB ping), and `/api/v1/health` with version info.
- **Verification**: Run health check test suite and confirm 200 OK.

### Phase 2: Core Reel Management, Feed, Likes, Comments, Shares & Bookmarks
- Models: `Reel`, `ReelMedia` (URLs, aspect ratio, duration, resolution, thumbnail), `ReelLike`, `ReelBookmark`, `ReelShare`, `Comment`.
- Endpoints:
  - `POST /api/v1/reels` (register reel with external storage URLs)
  - `GET /api/v1/reels/{id}` (single reel detail)
  - `PUT /api/v1/reels/{id}`, `DELETE /api/v1/reels/{id}`
  - `GET /api/v1/feed` (cursor/page-based infinite feed with engagement signals)
  - `POST /api/v1/reels/{id}/like`, `DELETE /api/v1/reels/{id}/like`
  - `POST /api/v1/reels/{id}/bookmark`, `DELETE /api/v1/reels/{id}/bookmark`
  - `POST /api/v1/reels/{id}/share`
  - `POST /api/v1/reels/{id}/comments`, `GET /api/v1/reels/{id}/comments` (nested parent/reply support)
- Real-time counter caching/denormalization (`likes_count`, `comments_count`, `shares_count`, `views_count`).
- **Verification**: Test CRUD, feed pagination ordering, like/bookmark idempotency, and comment nesting.

### Phase 3: Auth Integration, JWT Verification & S2S Security
- Decoupled auth dependency: `get_current_user` extracts JWT claims (`sub`, `roles`, `is_creator`).
- Public vs. Authenticated access: feeds can be consumed anonymously or personalized with `current_user_optional`.
- Service-to-Service API Key authentication (`X-Service-API-Key`) for internal operations (e.g. transcoding callbacks, admin moderation).
- Reel owner verification middleware/dependency (`require_reel_owner`).
- **Verification**: Test valid/invalid/expired JWT, anonymous feed vs authenticated personal feed, S2S internal endpoints, and 403 Forbidden for unauthorized reel modifications.

### Phase 4: Advertisement Campaigns & Feed Ad Placement
- Models: `AdCampaign`, `AdCreative`, `AdImpression`, `AdClick`.
- Business logic: Frequency capping (e.g. 1 ad every N organic reels in feed), active date windows, budget/daily caps.
- Endpoints:
  - `POST /api/v1/ads/campaigns`, `GET /api/v1/ads/campaigns`
  - Feed ad blending: `/api/v1/feed` injects sponsored item with type `"ad"` and tracking tokens.
  - `POST /api/v1/ads/track/impression`, `POST /api/v1/ads/track/click`
  - `GET /api/v1/ads/analytics`
- **Verification**: Test feed ad interleaving interval, impression recording idempotency, and analytics aggregation.

### Phase 5: Moderation, Reporting, Rate Limiting & Error Handling
- Models: `ReelReport`, `ModerationStatus` (`ACTIVE`, `UNDER_REVIEW`, `TAKEDOWN`, `AGE_RESTRICTED`).
- Endpoints:
  - `POST /api/v1/reels/{id}/report`
  - `GET /api/v1/moderation/reports`, `PATCH /api/v1/moderation/reels/{id}/status`
- Text content profanity/banned keyword sanitization filter.
- In-memory rate limiting dependency (`RateLimiter`) with configurable requests-per-minute per client IP or user ID.
- Global exception handling for validation, unhandled exceptions, and DB integrity errors.
- **Verification**: Test report submission, status transition, rate limiting 429 response, and sanitized errors.

### Phase 6: PostgreSQL Support, Alembic Migrations & Indexing
- Alembic initialization (`alembic init alembic`), configure `env.py` to auto-detect SQLAlchemy models.
- Generate initial migration revision covering all models and indices:
  - B-tree indexes on `(created_at DESC)`, `(user_id)`, `(status, is_private)`.
  - Composite indexes on `(reel_id, user_id)` for likes and bookmarks.
- Multi-dialect support verification: SQLite for local run/tests and PostgreSQL dialect types.
- **Verification**: Run `alembic upgrade head` and verify clean schema creation.

### Phase 7: Automated Test Suite & Coverage
- Comprehensive pytest suite covering:
  - All REST endpoints (happy path and status codes).
  - Auth token decoding and claim parsing.
  - Feed pagination, cursor stability, ad slot injection.
  - Comment hierarchy and depth.
  - Race condition protections and edge cases (e.g. duplicate likes, missing reels).
- **Verification**: Run `pytest -v` across the entire suite with 100% passing tests.

### Phase 8: Documentation, Windows Setup & Production Deployment Guide
- Comprehensive `README.md`:
  - Quick start guide on Windows without Docker.
  - PostgreSQL production configuration and connection pooling.
  - Integration guide for main website/mobile backend developers (JWT exchange, webhooks, media upload flow).
  - Postman/OpenAPI collection instructions.
- Environment variables reference guide.
