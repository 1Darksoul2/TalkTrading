# Professional Reel & Short-Form Video Microservice

A standalone, high-performance microservice designed for web and mobile short-form video feeds (Instagram Reels / TikTok / YouTube Shorts style).

Built with **FastAPI**, **SQLAlchemy 2.0**, and **Pydantic 2**. It is completely decoupled from any external application codebase and requires **zero external infrastructure** (no mandatory Docker or Redis required for local development).

---

## Production Security & Architecture

1. **Decoupled Video Architecture**:
   - Stores CDN/S3 video URLs and media metadata (resolution, duration, aspect ratio, bitrate, mime type).
   - Keeps your storage and media transcoding services completely separate.
2. **Infinite Feed & Pagination**:
   - Fast pagination (`page`, `page_size`, recency & pinned sorting).
   - Blends organic videos with targeted advertisement cards based on configurable frequency intervals (`AD_FREQUENCY_INTERVAL`).
   - Supports anonymous viewing or personalized user engagement lookups (`is_liked`, `is_bookmarked`).
3. **Rich Social Interactions**:
   - Like and unlike toggles with concurrency-safe atomic counter tracking and `IntegrityError` deduplication.
   - Bookmarks and multi-channel share counters (WhatsApp, Twitter, direct link).
   - Hierarchical comments and nested replies.
4. **Advertisement Management & Analytics**:
   - Ad campaigns and creatives.
   - List campaigns (`GET /api/v1/ads/campaigns`) scoped to advertiser ownership.
   - Screen impression tracking and CTA click logging with client IP hashing.
   - Campaign analytics (`GET /api/v1/ads/campaigns/{id}/analytics`) guarded by advertiser ownership or admin role.
5. **Security, Trust & Safety**:
   - Decoupled JWT verification (`sub`, `roles`, `is_creator`).
   - Explicit prohibition of header-based user impersonation (e.g. `X-User-Id` is ignored; identity is strictly cryptographic from JWT signature).
   - Service-to-Service API Key authentication (`X-Service-API-Key`) with constant-time comparison to defeat timing attacks.
   - Production secrets validator: `APP_ENV=production` strictly rejects weak or default secrets and requires PostgreSQL.
   - Community guidelines reporting, automated threshold moderation, and protected reports queue (`GET /api/v1/moderation/reports`).
   - In-memory sliding-window rate limiting to protect against abuse.
6. **Multi-Database Support & Migrations**:
   - Local development with zero-setup SQLite.
   - Production-ready PostgreSQL engine switching via `DATABASE_URL`.
   - Complete schema tracking and migration history using **Alembic**.

---

## API Endpoints Reference

All endpoints are versioned under `/api/v1`:

### Health & Readiness
| Method | Path | Auth Required | Description |
|---|---|---|---|
| `GET` | `/` | None | Service root status |
| `GET` | `/api/v1/health` | None | Basic liveness status |
| `GET` | `/api/v1/ready` | None | Readiness status including database connection ping |

### Reels
| Method | Path | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/reels` | Bearer JWT | Publish a new reel with storage URLs |
| `GET` | `/api/v1/reels/{id}` | Optional JWT | Get single reel detail (private reels require ownership) |
| `PUT` | `/api/v1/reels/{id}` | Bearer JWT | Update reel metadata (owner only) |
| `DELETE` | `/api/v1/reels/{id}` | Bearer JWT | Soft delete reel (owner or admin only) |
| `POST` | `/api/v1/reels/{id}/view` | None | Increment view counter |

### Feed
| Method | Path | Auth Required | Description |
|---|---|---|---|
| `GET` | `/api/v1/feed` | Optional JWT | Paginated feed (`page`, `page_size`, `include_ads`). Injects user's `is_liked` & `is_bookmarked` if logged in. |

### Social Interactions
| Method | Path | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/reels/{id}/like` | Bearer JWT | Toggle like / unlike |
| `POST` | `/api/v1/reels/{id}/bookmark` | Bearer JWT | Toggle bookmark / unbookmark |
| `POST` | `/api/v1/reels/{id}/share` | Optional JWT | Record share event by platform |

### Comments & Replies
| Method | Path | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/reels/{id}/comments` | Bearer JWT | Post comment or reply (set `parent_id`) |
| `GET` | `/api/v1/reels/{id}/comments` | None | Retrieve comments and nested replies |
| `DELETE` | `/api/v1/reels/comments/{id}` | Bearer JWT | Delete comment (author, reel owner, or admin) |

### Advertisements & Tracking
| Method | Path | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/ads/campaigns` | Bearer JWT | Create ad campaign and creatives |
| `GET` | `/api/v1/ads/campaigns` | Bearer JWT | List advertiser campaigns (or all if admin) |
| `POST` | `/api/v1/ads/track/impression` | None | Log ad impression on device screen |
| `POST` | `/api/v1/ads/track/click` | None | Log ad CTA click |
| `GET` | `/api/v1/ads/campaigns/{id}/analytics` | Bearer JWT | Get campaign impressions, clicks, CTR (advertiser owner or admin) |

### Moderation & Trust/Safety
| Method | Path | Auth Required | Description |
|---|---|---|---|
| `POST` | `/api/v1/moderation/reels/{id}/report` | Bearer JWT | Report reel for community violation |
| `GET` | `/api/v1/moderation/reports` | Bearer JWT (Admin/Mod) | View moderation queue reports |
| `POST` | `/api/v1/moderation/reels/{id}/action` | `X-Service-API-Key` | Service-to-service moderation action |

---

## Local Setup on Windows (Without Docker)

### 1. Prerequisites
- Python 3.10+ (Tested on Python 3.14)
- PowerShell or Windows Command Prompt

### 2. Environment Configuration
Copy the configuration template:
```powershell
cp .env.example .env
```

### 3. Install Dependencies
```powershell
pip install -r requirements.txt
```

### 4. Database Migrations
Initialize and upgrade your local database:
```powershell
python -m alembic upgrade head
```

### 5. Start the Development Server
```powershell
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- Interactive Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- Alternative ReDoc UI: [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Production Deployment (PostgreSQL)

To deploy to production with PostgreSQL:

1. Update your `.env` or set the environment variables:
   ```bash
   APP_ENV="production"
   DEBUG=false
   DATABASE_URL="postgresql+psycopg://db_user:strong_password@your-postgres-host:5432/reel_db"
   JWT_SECRET_KEY="your-production-jwt-shared-secret-at-least-32-chars-long"
   SERVICE_API_KEY="your-super-secret-s2s-key-configured-properly"
   ```
   > **Note on PostgreSQL Driver**: `psycopg[binary]>=3.2.0` is declared in `requirements.txt`. Both `postgresql+psycopg://` and standard `postgresql://` URLs are supported out of the box.
   > **Note on Security**: In production (`APP_ENV=production`), the application startup will fail immediately if `JWT_SECRET_KEY` or `SERVICE_API_KEY` are left at default values, if the secret is under 32 characters, or if SQLite is specified.

2. Run database migrations against PostgreSQL:
   ```bash
   python -m alembic upgrade head
   ```
3. Run with a production ASGI server like Gunicorn + Uvicorn workers:
   ```bash
   gunicorn -w 4 -k uvicorn.workers.UvicornWorker app.main:app --bind 0.0.0.0:8000
   ```

---

## Running Automated Tests

Run the full automated test suite anytime using pytest:
```powershell
python -m pytest -v
```
All unit, integration, concurrency, and security tests run against an isolated SQLite test database and execute in under 2 seconds.
