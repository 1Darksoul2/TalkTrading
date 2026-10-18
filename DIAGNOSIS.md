# TalkTrading — Project Diagnosis

**Date**: 2026-09-25
**Method**: Direct code inspection + 4 independent deep-dive passes (read every service's source, ran every real test suite, checked every `.env`, traced every frontend page to its actual data source). Nothing below is taken from the project's own `README.md` / `PROJECT_DOCUMENTATION.md` on faith — those documents were treated as *claims* and checked against the code. Where they were wrong, that's called out explicitly.

**Scope found on disk**: 5 Python/FastAPI microservices, **1 undocumented Java/Spring Boot microservice**, 1 React frontend, and no working central identity system tying any of them together.

---

## 0. Executive Summary

| Component | Port | Real / Mock | Wired to frontend? | Tests | Verdict |
|---|---|---|---|---|---|
| News Service | 8000 | Real API (Finnhub) + real DB, no live ingestion scheduler | ✅ Yes (with mock fallback) | 12/12 pass | Ready as a read API; ingestion must be triggered manually |
| Story Service | 8001 | Real S3 code, **no AWS credentials configured** | ✅ Yes (with mock fallback) | 10/10 pass | Code is real, environment isn't — uploads will fail as configured |
| Chart Service | 8002 | Real live scraped data (TradingView/Yahoo, **not** Finnhub despite `.env`) | ✅ Yes | 12/12 pass | Works, but is quietly scraping public endpoints, not using its own configured API key |
| E2EE Chat Service | 8003 | Real X3DH/AES-256-GCM crypto, real WebSocket | ✅ Yes, deeply integrated | 27/27 pass | Most mature service in the project — but only supports 2 hardcoded demo users |
| Post Service | 8004 | Real CRUD, real JWT auth, real (local-disk) media | ✅ Yes, deeply integrated | 28/28 pass | Most complete service; has dead code and a stub S3 path |
| **Community Service (Java)** | 8080 | **Fully built, fully tested — completely disconnected** | ❌ **No** — frontend uses hardcoded mock data | Real test suite exists (not run) | Orphaned. Never appears in README, docs, or `start_all.py` |
| Frontend (React) | 5173 | Mixed — 6 of 8 pages call real APIs, 2 are 100% mock | — | **Zero automated tests** | Functional shell; Explore & Communities pages are placeholders wearing real UI |

**The single biggest architectural gap**: there is **no shared authentication system**. Only Post Service has a real login/register flow, and its JWTs are cryptographically incompatible with E2EE Service's JWTs (different secrets, different `sub` formats — one expects an email-derived int, the other a UUID). News, Chart, and Story services have no auth at all or have it explicitly disabled. Every "user" in this system today is a hardcoded demo constant (Alice/Bob in E2EE, `alex_quant`/id 101 in Post Service).

---

## 1. News Service (`news-service/`, port 8000)

**What it does**: Serves a paginated news feed from `news.db`, with bookmarking. Provider-agnostic ingestion adapters exist for 6 providers (newsapi, alphavantage, finnhub, polygon, gnews, mediastack).

**Verified real**:
- `NEWS_PROVIDER` really does switch adapters (`app/adapters/*.py`, one file per provider) — this is genuine, working code, not a stub.
- `.env` has a live-format Finnhub key (`NEWS_API_KEY=da6nbc1r...`), not a placeholder.
- Tests: **12/12 pass** (`venv\Scripts\python.exe -m pytest -q`, 0.99s).
- No auth on any route — fully open API, by design (news is public content).

**Gaps**:
- **Ingestion never runs automatically.** `app/ingestion.py` is explicitly documented in its own docstring as "NOT part of the API process" — it's meant to run as a cron/Celery job every ~10 min. Nothing in `start_all.py` or anywhere else schedules it. In practice, `news.db` only has whatever was seeded/ingested manually at some point in the past — the feed is effectively static unless someone remembers to run ingestion by hand.
- SQLite-only array-filtering workaround (`related_symbols` filtered with `LIKE` pattern matching instead of a real array containment query) — fine for dev, will need a real query rewrite on Postgres.

**Fix priority**: Medium. Add a scheduled task (cron, APScheduler, or a Docker sidecar) that calls `ingestion.run()` periodically, or the feed will silently go stale in any real deployment.

---

## 2. Story Service (`story-service/`, port 8001)

**What it does**: 24-hour ephemeral stories with view tracking, meant to upload media directly to S3 via presigned URLs.

**Verified real**:
- The S3 presign code is genuine (`app/main.py`, real `boto3.client(...).generate_presigned_url(...)` call) — not mocked.
- 24-hour TTL is enforced at query time (`app/crud.py`: `filter(expires_at > now)`) so expired stories never appear in feeds even without any cleanup job running.
- A separate `app/worker.py` does real hard-deletion + publishes a `story.expired` event — but like news ingestion, it explicitly says it's "NOT part of the API process" and nothing schedules it.
- Tests: **10/10 pass** (1.10s).

**Gaps**:
- **No AWS credentials configured anywhere.** `story-service/.env` has no `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or bucket name — only `DATABASE_URL`, `AUTH_ENABLED=false`, `STORY_DURATION_HOURS=24`. The presign endpoint will fail (or silently rely on an undocumented IAM role that doesn't exist in this dev environment) the moment anyone actually tries to upload story media through it.
- `AUTH_ENABLED=false` — auth is explicitly turned off, not just absent.
- Expired-story hard-deletion never actually runs (worker unscheduled) — `stories.db` will grow forever with soft-expired rows.

**Fix priority**: High if story creation is a feature you actually want working end-to-end — right now the "Post Story" flow in the frontend (`HomeFeed.jsx`) requires the caller to already have a hosted `media_url`; there's no working upload path behind it at all in this environment.

---

## 3. Chart Service (`chart-service/`, port 8002)

**What it does**: Serves symbol quotes, sparklines, and OHLCV candles for the Market pages.

**Verified real (and a real discrepancy found)**:
- `.env` comment literally says *"Market data provider (currently only 'finnhub' supported)"* and sets `CHART_PROVIDER=tradingview`, with a live-format `CHART_API_KEY`. **That key is never referenced anywhere in the code** — grepped all of `app/*.py` and `app/providers/*.py`, zero hits. It's dead config.
- The actual data source (`app/providers/tradingview.py`) makes real unauthenticated HTTP calls to `scanner.tradingview.com` (quotes) and Yahoo Finance's public chart API (sparklines) — i.e., it's scraping two public endpoints, not calling Finnhub at all, despite what both the `.env` comment and `PROJECT_DOCUMENTATION.md` claim.
- Tests: **12/12 pass** (1.69s).
- No auth on any route.

**Gaps**:
- Relying on scraped public endpoints (TradingView scanner, Yahoo Finance) rather than a real paid/authenticated data provider means this will break without warning if either site changes its response shape or starts blocking the request pattern — there's no SLA here.
- No local `venv` committed for this service (tests only ran because a compatible system Python 3.10 happened to be installed) — fragile for anyone else setting this up fresh.

**Fix priority**: Medium. Either wire the already-paid-for Finnhub key into a real Finnhub provider implementation, or explicitly document that this service scrapes public endpoints and accept the fragility.

---

## 4. E2EE Chat / Identity Service (`E2E-main/`, port 8003)

**What it does**: Cryptographic backbone for end-to-end encrypted direct messages — device registry, X3DH prekey distribution, encrypted message envelope storage, real-time WebSocket delivery.

**This is the most thoroughly engineered service in the project.**

**Verified real**:
- WebSocket endpoint is real and gated by device registration (`app/api/v1/chat.py`).
- Two-path JWT verification is real: symmetric HS256 user tokens, or asymmetric Ed25519 service-to-service tokens verified against a hardcoded public key (`app/security/authentication.py`).
- Tests: **27/27 pass** (1.06s) — matches the doc's claim exactly, this is the one place `PROJECT_DOCUMENTATION.md`'s numbers checked out precisely.
- Redis rate limiting degrades gracefully (fails open) if Redis isn't running — it's optional, not a hard dependency, contrary to how critical the docs make it sound.
- Currently defaults to SQLite (`sqlite+aiosqlite:///e2e.db`); Postgres is supported via Alembic migrations but is not what's actually running.
- X3DH crypto math, AES-256-GCM, AAD device-binding, session state persistence across page refresh — all genuinely implemented on both the Python and JS (`x3dhCrypto.js`) sides, and the two sides are verified to interoperate (see `test_live_e2e.mjs`, a manual integration script).

**Real bug found**: one test (`test_two_users_two_devices_full_messaging_flow`) throws a `PytestUnhandledThreadExceptionWarning` — `RuntimeError: Event loop is closed` from an aiosqlite background thread. The test still passes, but this indicates a real connection-cleanup issue under threaded SQLite usage that could surface as flakiness under load.

**Gaps**:
- **There is no way to get a real user JWT from this service.** It only *verifies* tokens — there's no `/login` or `/register` endpoint anywhere in `E2E-main`. The only two working identities are the hardcoded Alice/Bob demo constants baked into `E2EContext.jsx` on the frontend, with tokens set to expire in the year 2027.
- No real user directory — "who can I chat with" is hardcoded to exactly 2 people.

**Fix priority**: This service doesn't need backend fixes so much as it needs a real identity provider in front of it (see Section 9, Cross-Cutting Issues).

---

## 5. Post Service (`post-service-feature-post-module/`, port 8004)

**What it does**: Posts, nested comments, likes, saves, shares, media upload, hashtags, feed generation. This is the most feature-complete service and the only one with a real login system.

**Verified real**:
- Full JWT auth is actually enforced on every mutating endpoint, with real ownership checks (403 if you don't own the resource).
- **This is the only service in the entire project with a genuine password-based login flow** (`app/api/auth.py`: `/auth/register`, `/auth/login`, bcrypt via `passlib`, JWT issuance via `python-jose`).
- Media upload is real — local-disk storage with actual path-traversal containment checks on both upload and delete (good defensive coding). The root-level `uploads/` folder has 2 real uploaded images in it, confirming this path has been exercised for real, not just in tests.
- Tests: **28/28 pass** (11.23s) — broadest test suite of any service (14 test files covering everything including a dedicated `test_media_security.py`).

**Gaps found**:
- **Dead code with a broken import**: `app/api/posts.py`, `comments.py`, `likes.py`, `bookmarks.py`, `users.py` (top-level, distinct from the live `app/api/routes/*.py`) import a function `get_current_user` that **does not exist** in `app/core/security.py` (which only has `get_current_user_id`/`get_optional_user_id`). These files aren't wired into `main.py` so they're currently harmless, but they're landmines for the next person who tries to import them, and they read as an incomplete refactor.
- **Mentions are parsed but never saved.** `extract_mentions()` runs on every post/comment, but the extracted mentions are never written to the `Mention` table — a fully-modeled feature that silently does nothing.
- **The advertised "S3 readiness" is a non-functional stub.** `S3StorageProvider.upload()`/`.delete()` don't call AWS at all — they just synthesize a URL string and return `True`. Only `LocalStorageProvider` actually works.
- **A contradictory legacy local-auth router is still live.** The service's own README frames auth as owned by a separate service, yet `app/api/auth.py` implements a full independent login system and is mounted in `main.py`. This is architecturally inconsistent with the rest of the platform (see Section 9).
- Every router is double-mounted (`/api/v1/...` and unprefixed "for backward compatibility") — larger attack surface for no documented reason.
- Startup calls `Base.metadata.create_all()` wrapped in a silent `try/except: pass` — any real DB connectivity failure at boot would be swallowed silently.
- `SECRET_KEY` in `.env` is the literal placeholder `super_secret_jwt_key_change_in_production`, unchanged.

**Fix priority**: Low-to-medium for cleanup (dead code, mentions, S3 stub); **high** for the auth architecture question, because right now this service's login system is an island — see Section 9.

---

## 6. Community Service (`community-main/`) — Java/Spring Boot — **completely undocumented, completely disconnected**

This is the single biggest surprise in the codebase. It does not appear anywhere in `README.md`, `PROJECT_DOCUMENTATION.md`, or `start_all.py`. It was found only by walking the filesystem.

**What it actually is**: A real, fully-built Spring Boot 3.3.4 / Java 23 microservice implementing almost exactly what the frontend's Communities page needs — Reddit-style communities with join/roles, trading-domain posts (entry/target/stop-loss/symbol/timeframe fields), nested comments, likes, upvote/downvote, user profiles with follow/followers, search, and media upload. It is layered properly (controller / service / repository / entity / dto / mapper), has 11 controllers covering a full REST surface, uses Postgres in prod / H2 in-memory for dev, has Docker packaging, OpenAPI/Swagger docs, and **its own real test suite** (8 controller integration tests + 8 service unit tests + storage/util tests).

**Its CORS config even pre-lists `http://localhost:5173`** — the actual frontend dev port — which is strong evidence this was built specifically for this project and then never merged into the orchestration layer.

**Why it's disconnected**:
- Not in `start_all.py` or `start.bat` — nobody starts it.
- No `communityService.js` in the frontend's `src/services/` folder (every *other* real backend — news, story, chart, E2EE, post — has one; this is the only missing one).
- `Communities.jsx` imports `mockCommunities` directly and has **zero** fetch/API calls anywhere in the file — the entire Communities page is a static mock, wearing a UI that looks live.
- Auth is via a custom `X-User-Id` header-injection filter, not real security — matches the "no shared auth" pattern seen everywhere else, but is at least consistent internally.
- Never built (`no target/` directory) in this checkout, though the code shows no structural signs of being unfinished — this looks like "built once, then orphaned," not "half-written."

**Fix priority**: This is the highest-leverage fix in the whole project. A fully-functional backend already exists for a feature the frontend currently fakes — it just needs:
1. A launch entry in `start_all.py` (requires JDK 23 + Maven in the environment — the one real new prerequisite this introduces to an otherwise pure Python/Node stack)
2. A new `src/services/communityService.js` mirroring the existing 5 service files' pattern
3. `Communities.jsx` rewritten to call it instead of `mockCommunities`
4. A decision on H2 (zero-setup) vs Postgres (docker-compose already defines it) for local dev

Estimated effort: roughly a day for someone familiar with the codebase — the backend work is already done.

---

## 7. Frontend (`talktrading-frontend/`, React 18 + Vite, port 5173)

**Page-by-page reality check** (traced every page's actual imports/fetch calls, not what it looks like in the UI):

| Page | Real backend calls | Mock fallback | Verdict |
|---|---|---|---|
| **HomeFeed** | `postService` (feed, like, save, comment, share, create post) + `storyService` (feed, create, view) | Yes, on failure | Real, well-integrated |
| **UserProfile** | `postService` (fetchPosts, fetchSavedPosts, createPostWithMedia) | Yes | Real |
| **Chats** | `e2eService` — full X3DH crypto flow, WebSocket | No mock — genuinely live-or-nothing | Real, most sophisticated page in the app |
| **MarketCharts / StockChart** | `chartService` (symbols, quotes, sparklines) | Best-effort catch, degrades quietly | Real |
| **MarketNews** | `newsService.fetchNewsFeed` with a health-check gate | Yes, falls back to `mockNews` if service is down | Real |
| **Communities** | **None.** `useState(mockCommunities)` — zero fetch calls in the file | 100% mock | **Fake** — see Section 6 |
| **ExploreSearch** | **None.** Imports `mockUsers`, `mockPosts`, `mockNews` directly | 100% mock | **Fake** |
| **Settings & Activity** | None by design — local-only UI state (localStorage), built in this session as a frontend-only mockup | N/A | Intentionally frontend-only (see note below) |

Two smaller tells confirm the above: `src/components/communities/` and `src/components/explore/` are **both empty directories** — every other feature (home, chats, market, news, profile) has a populated component subfolder; these two never got built out beyond the single page file.

**Other frontend findings**:
- **Zero automated tests.** `package.json` has no `test` script and no test framework (no Vitest/Jest) installed. The only things resembling tests are two ad-hoc Node scripts at the project root (`test_live_e2e.mjs`, `check_db_envelopes.mjs`) that require a live backend running — these are manual integration smoke tests, not a CI-able suite.
- The Settings & Activity page (added in this same session) is a fully interactive, well-built UI with working toggles/selects/lists — but it is **explicitly frontend-only**: state lives in `localStorage` via `SettingsStateContext`, nothing calls any backend. This was flagged to the user already; noting it here for completeness of the diagnosis.
- `E2EContext.jsx` hardcodes exactly two identities (`DEMO_USERS.alice` / `DEMO_USERS.bob`) with tokens valid until 2027 — there's no real login screen anywhere in the frontend, for any service.

---

## 8. Repository Hygiene Issues (not features, but worth fixing)

- **Not a git repository.** The whole project (`files (2)/`) has no `.git` — there's no version history, no way to diff changes, no branch/rollback safety net. This should be the very first fix regardless of anything else.
- **A 132 MB unnamed `.zip`** file sits at the project root (`.zip`, literally that filename) — unclear contents, unclear purpose, bloats the folder.
- **`talktrading-frontend.zip` (20 MB)** is a stale duplicate snapshot of the frontend sitting alongside the live `talktrading-frontend/` folder — likely to cause confusion about which copy is authoritative.
- **Duplicate `.db` files at the project root** (`chart.db`, `news.db`, `post.db`, `stories.db`, `test_chart.db`) shadow the real per-service databases that `start_all.py` actually uses (each service's `DATABASE_URL` is relative to its own `cwd`, e.g. `chart-service/chart.db`). The root-level copies are almost certainly stale leftovers and a source of "why isn't my change showing up" confusion.
- Every Python service's `.env` and `.env.example` carry the same unchanged placeholder secrets (`SECRET_KEY=...change_in_production`, etc.) — fine for local dev, a real risk if anyone ever deploys from this checkout as-is without rotating them.

---

## 9. Cross-Cutting Issue: No Shared Identity System

This is the single most important structural finding, spanning every service above, so it gets its own section instead of being buried five times.

**Current state, service by service**:
- **News, Chart**: no authentication at all — fully open.
- **Story**: authentication code exists but is explicitly disabled (`AUTH_ENABLED=false`).
- **E2EE**: only *verifies* JWTs; has no login/register endpoint and no password storage anywhere.
- **Post Service**: the *only* service with a real login/register flow (bcrypt + JWT).
- **Community (Java, disconnected)**: uses a trust-the-header `X-User-Id` scheme, no real security.
- **Frontend**: has no login screen. Every "logged in user" is a hardcoded demo constant — `alex_quant` (id 101) for posts, Alice/Bob (fixed UUIDs, tokens good until 2027) for chat.

**Why this matters beyond "it's incomplete"**: even the one real login system (Post Service) **cannot actually authenticate a user to the rest of the platform**. Its JWTs are signed with a different secret than E2EE Service expects, and encode the user identity differently — Post Service puts the user's *email* in a JWT `sub` claim which it internally maps to an integer primary key, while E2EE Service expects `sub` to be a parseable UUID. A token from Post Service's `/auth/login` would be rejected by E2EE Service outright. There is no SSO, no shared user table, no service that both issues real credentials *and* is trusted by the other four backends.

**What's needed to fix this properly** (this is the prerequisite for almost every other "make it real" task on this list):
1. Pick one identity model — most likely a dedicated auth/user service (or promote Post Service's auth into that role) issuing UUID-subject JWTs.
2. Standardize every service on one `JWT_SECRET_KEY` (or move to asymmetric verification everywhere, which E2EE already half-does for service-to-service calls).
3. Build a real login screen in the frontend, replacing `DEMO_USERS` and the hardcoded `author_id: 101` pattern.
4. Decide whether News/Chart truly want to stay fully open (plausible — they're public read data) versus Story/Post/E2EE/Community, which clearly need real per-user identity.

---

## 10. Prioritized Punch List

**P0 — Foundational, blocks everything else**
1. Initialize git version control for the whole project.
2. Design and implement one shared authentication system (Section 9) — nothing involving real multi-user behavior (real chat contacts, real post ownership across users, real community membership) works correctly until this exists.

**P1 — High-value, backend already exists**
3. Wire up Community Service: add to `start_all.py`, write `communityService.js`, replace `mockCommunities` in `Communities.jsx`. Backend work is done; this is almost entirely frontend + orchestration.
4. Configure real AWS credentials for Story Service (or swap to local-disk storage like Post Service does) — the presign code is real but currently has nothing to authenticate with.
5. Schedule News ingestion (`ingestion.run()`) and Story expiry cleanup (`worker.py`) as real recurring jobs — both exist and work but currently never run automatically.

**P2 — Cleanup, correctness**
6. Remove dead code in Post Service (`app/api/posts.py` etc. with the broken `get_current_user` import) or finish wiring it.
7. Either persist parsed `Mention` records in Post Service or remove the half-built feature.
8. Fix or clearly document Chart Service's dead `CHART_API_KEY`/provider mismatch — decide between real Finnhub integration and the current TradingView/Yahoo scraping approach.
9. Resolve Post Service's contradictory legacy `/auth` router once the shared-auth decision (P0.2) is made.
10. Delete stray root-level files: the 132 MB unnamed `.zip`, `talktrading-frontend.zip`, and the duplicate root-level `.db` files.

**P3 — Quality of life**
11. Add a real frontend test framework (Vitest is the natural fit for Vite) — currently zero automated frontend tests exist.
12. Build out `ExploreSearch.jsx` against real data once P1/P0 make that meaningful (it depends on Post Service search + eventually Community Service search).
13. Investigate the `PytestUnhandledThreadExceptionWarning` in E2E-main's multi-device test — likely a real aiosqlite connection-cleanup bug worth fixing before it causes flakiness under load.
14. Rotate every placeholder `SECRET_KEY`/JWT secret before any real deployment.

---

## Appendix: How this document was produced

Four parallel deep-dive investigations were run directly against the source code (not documentation): one on Post Service, one on the undocumented Java Community Service, one verifying News/Story/Chart/E2EE claims and running their real test suites, and direct manual inspection of the entire frontend (`src/pages`, `src/services`, `src/data`, `src/context`) tracing every page to its actual data source. Every test-pass number cited above was obtained by actually executing `pytest` in each service's own environment, not copied from existing documentation.
