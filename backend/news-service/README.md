# News Service

Ingests market/trading news from an external provider and serves it as a
filterable feed with bookmarking. Part of the **TalkTrading** microservices architecture.

**Fully API-agnostic** — switch providers by changing one environment variable.

---

## Prerequisites

- Python 3.12+
- Docker & Docker Compose (recommended)
- PostgreSQL 16 (if running without Docker)
- An API key from one of the supported news providers (see below)

---

## Choosing a News Provider

Set `NEWS_PROVIDER` to one of the following:

| `NEWS_PROVIDER` | Free Tier | Ticker Symbols | Best For | Signup |
|---|---|---|---|---|
| `newsapi` | 100 req/day | ❌ | Easy setup, broad news | [newsapi.org](https://newsapi.org) |
| `alphavantage` | 25 req/day | ✅ per article | Market sentiment + tickers | [alphavantage.co](https://www.alphavantage.co) |
| `finnhub` | 60 req/min | ❌ | Generous free tier | [finnhub.io](https://finnhub.io) |
| `polygon` | 5 req/min | ✅ per article | Stocks-focused, rich data | [polygon.io](https://polygon.io) |
| `gnews` | 100 req/day | ❌ | Budget option | [gnews.io](https://gnews.io) |
| `mediastack` | 500 req/mo | ❌ | Budget option, global | [mediastack.com](https://mediastack.com) |

> **Recommendation**: Use **Finnhub** to start (most generous free tier). Switch to **Alpha Vantage** or **Polygon** when you need `?symbol=AAPL` filtering to work, since those providers tag articles with ticker symbols.

---

## Running with Docker (Recommended)

```bash
cd news-service

# 1. Edit docker-compose.yml — set your provider and API key:
#    NEWS_PROVIDER: finnhub          ← pick one from the table above
#    NEWS_API_KEY: your_key_here

# 2. Start everything (Postgres + API + Ingestion Worker)
docker-compose up --build

# API is live at:  http://localhost:8002
# Swagger docs:    http://localhost:8002/docs

# 3. Manually trigger article ingestion (first run):
docker-compose run news-ingestion-worker
```

---

## Running Locally (Without Docker)

```bash
cd news-service

# 1. Create and activate virtual environment
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set environment variables (or create a .env file)
set DATABASE_URL=postgresql://user:pass@localhost:5432/news_db
set NEWS_PROVIDER=finnhub
set NEWS_API_KEY=your_key_here
set NEWS_QUERY=stock market OR crypto OR trading
set NEWS_PAGE_SIZE=50

# 4. Run the API server
uvicorn app.main:app --reload --port 8002

# API is live at:  http://localhost:8002
# Swagger docs:    http://localhost:8002/docs

# 5. Run the ingestion worker (in a separate terminal)
python -m app.ingestion
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/news_db` | PostgreSQL connection string |
| `NEWS_PROVIDER` | `newsapi` | Provider to use — see table above |
| `NEWS_API_KEY` | _(empty)_ | API key from your chosen provider. Keep it in `.env` or the environment, never in source |
| `JWT_SECRET` / `JWT_ALGORITHM` | `CHANGE_ME_IN_PRODUCTION` / `HS256` | Must match the secret the Post Service signs login tokens with (`start_all.py` passes it) |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Browser origins allowed (comma separated) |
| `NEWS_QUERY` | `stock market OR crypto OR trading OR finance` | Search query sent to the provider |
| `NEWS_PAGE_SIZE` | `50` | Articles fetched per ingestion run |
| `DEFAULT_CATEGORY` | `markets` | Fallback category when provider doesn't supply one |
| `NEWS_FEED_DEFAULT_LIMIT` | `20` | Default page size for `GET /news` |
| `NEWS_FEED_MAX_LIMIT` | `100` | Maximum allowed page size for `GET /news` |

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Liveness probe — also shows active provider |
| `GET` | `/news` | Paginated, filterable news feed |
| `GET` | `/news/{id}` | Single article by UUID |
| `GET` | `/news/bookmarks` | Your bookmarks with full article data (login required) |
| `PUT` | `/news/{id}/bookmark` | Bookmark an article for yourself (login required, saving twice is fine) |
| `DELETE` | `/news/{id}/bookmark` | Remove one of your bookmarks (login required) |

Bookmarks belong to the account in the login token (`Authorization: Bearer <JWT from the Post Service>`);
the service never accepts a user id from the request, so nobody can read or change someone else's bookmarks.

Full interactive docs: **http://localhost:8002/docs**

### Feed query parameters

```
GET /news?category=crypto&symbol=BTC&limit=20&offset=0
```

| Param | Type | Description |
|---|---|---|
| `category` | string | Filter by category (`markets`, `crypto`, `technology`, etc.) |
| `symbol` | string | Filter by ticker symbol — only works with Alpha Vantage or Polygon |
| `limit` | int | Number of results (default 20, max 100) |
| `offset` | int | Pagination offset |

---

## Ingestion Worker

Fetches articles from the configured provider and upserts them into the database.
Deduplicates on `source_url` — safe to run as frequently as needed.

```bash
# Run manually
python -m app.ingestion

# In production: set up as a Kubernetes CronJob (every 10 min)
# or a Celery beat periodic task:
#   */10 * * * * python -m app.ingestion
```

---

## Switching Providers

No code changes needed — just update the env var and restart:

```bash
# .env or docker-compose.yml
NEWS_PROVIDER=polygon
NEWS_API_KEY=your_polygon_key
```

```bash
docker-compose up --build
```

---

## Running Tests

```bash
cd news-service
pip install -r requirements.txt
pytest tests/ -v
```

Tests use in-memory SQLite — no running Postgres needed.

---

## Adding a New Provider

1. Create `app/adapters/my_provider.py` — subclass `BaseNewsAdapter`, implement `fetch()` and `normalize()`
2. Register it in `app/adapters/base.py` inside `get_adapter()`
3. Set `NEWS_PROVIDER=my_provider` — done

See any existing adapter (`finnhub.py`, `newsapi.py`) for the pattern.
