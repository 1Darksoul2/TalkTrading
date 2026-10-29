# Pre-integration review: `Reels-main` and `explore`

**Date:** 2026-10-18
**Scope:** the two folders added to the project: `Reels-main/` (new Reels service, Python/FastAPI) and `explore/` (Java/Spring Boot).
**Method:** full source read, the services' own test suites, a probe script that attacks each suspected problem through the real app, and a live run of the new `explore` against our real Post Service, side by side with the Explore we run today. Everything ran on copies in a scratch folder; neither original folder was modified.

---

## 1. Verdict

| Service | Own tests | Ready to integrate? |
|---|---|---|
| **Reels** (`Reels-main`) | 36 / 36 pass | **Not yet.** It is well structured and its login check fits our tokens, but 8 high-severity problems (privacy holes, anyone can run ads and pin to the top of everyone's feed, unsafe links) must be fixed first, and it has no way to upload a video in our setup. |
| **Explore v2** (`explore`) | 70 / 70 pass | **Do not replace `Explore-main` with it.** It is an older copy with some new improvements on top: it reverts three fixes our app depends on. Against our real Post Service it returns **0 posts** (today's version returns 10), **no images**, and the browser **blocks** it. Its own test report only passed because every test ran with the Post Service switched off. |

Neither service is broken in the sense of crashing: both start and their own tests pass. The problems are in how they behave with real users and with our other services, which their tests do not cover.

---

## 2. Reels service (`Reels-main`)

### 2.1 What it is
A FastAPI service for short videos: publish a reel (by giving the URL of a video stored elsewhere), feed with ads every 4 reels, likes, bookmarks, shares, threaded comments, reports and moderation, ad campaigns with impression/click tracking. SQLite locally, PostgreSQL for production, Alembic migrations.

### 2.2 What is good
- **Login is compatible with ours.** It verifies a signed JWT and takes the user from `sub`, exactly what our Post Service issues. Confirmed: a token shaped like ours (user UUID, no roles) was accepted. It never trusts an `X-User-Id` header.
- Clean layout (endpoints / services / models / schemas), consistent error format, constant-time API-key check, refuses default secrets and SQLite when `APP_ENV=production`.
- Likes and bookmarks are protected against double-counting by unique constraints.
- The Alembic migration matches the models exactly (`alembic check`: no differences).
- 36 tests, all passing.

### 2.3 Problems found (each confirmed by running it, unless marked)

**High: must fix before integrating**

| # | Problem | What I saw | Where |
|---|---|---|---|
| R1 | **Followers-only reels are public.** Only `private` is checked; `followers` is treated like `public`. | Anonymous request for a followers-only reel → 200 with full content. | `reel_service.get_reel_by_id` |
| R2 | **Private reels can be liked, commented on, and their comments read by anyone.** Interactions and comments only check the reel is active, never who may see it. | Stranger liked (200) and commented (201) on a private reel; an anonymous request read the owner's private comment. | `interaction_service`, `comment_service` |
| R3 | **Any user can pin their reel to the top of everyone's feed.** `is_pinned` is editable by the owner, and the global feed sorts pinned reels first. | A normal user's pinned reel became item #1 for everyone. | `ReelUpdate.is_pinned`, `feed_service` |
| R4 | **Any user can run ads, with no review and no payment, shown to everyone, with any link.** New campaigns start `active`; `budget` is never used; `cta_url` is not checked. | A normal user's ad with a `javascript:` link appeared in the public feed. | `ad_service.create_campaign`, `schemas/ad.py` |
| R5 | **Ad impressions and clicks can be faked by anyone.** No login, `user_id` is taken from the request body, no de-duplication. A rival can use up a campaign's impressions in seconds. | 5 anonymous calls with a forged user id used up a 5-impression campaign. | `endpoints/ads.py` track routes |
| R6 | **Any URL accepted for video, thumbnail and audio**, including `javascript:` and tracking pixels on other sites. `ALLOWED_MEDIA_DOMAINS` exists in the settings but is never used. | `javascript:alert(...)` accepted as `video_url`. | `schemas/reel.py`, `config.py` |
| R7 | **Six accounts can take any reel out of the feed with no human review.** Reports auto-switch a reel to `under_review`. The docs say 5 reports; because of an off-by-one (the new report is not counted yet), it is 6. Brand-new accounts count. | Reel left the feed after report #6. | `moderation_service.report_reel` |
| R8 | **Deleted replies are still shown.** The replies list does not filter deleted comments. | A deleted reply's text came back in the comment tree. | `models/comment.py` `replies`, `comment_service.get_comments` |

**Medium**

| # | Problem | Detail |
|---|---|---|
| R9 | Reels under review / restricted still open by direct link (200), only hidden from the feed. | `get_reel_by_id` only excludes `deleted` |
| R10 | Private reel answers **403** ("this reel is private") instead of 404, so it reveals the reel exists. | `get_reel_by_id` |
| R11 | View counts can be inflated: no login, no de-duplication (50 calls = 50 views). Counters (`views`, `comments`, `replies`) are updated read-modify-write, so parallel requests lose updates on PostgreSQL. | `increment_view`, `comment_service` |
| R12 | **Default CORS allows any website** (`["*"]`, and `.env.example` also lists `"*"`), with credentials enabled. | Confirmed: `https://evil.example` was allowed. |
| R13 | `/api/v1/ready` returns **HTTP 200 when the database is down**, and puts the raw database error (host, user) in the response. Health checks cannot detect an outage. | Confirmed with a simulated DB failure. |
| R14 | Rate limit is one global 120 requests/minute per IP, applied to every route including health checks; memory is never released; all users behind one proxy share one limit. | 121st call → 429. |
| R15 | Tags have no length/count limit but are stored in a 512-character column. SQLite stores the overflow silently; **PostgreSQL will throw (500)**. (SQLite part confirmed; PostgreSQL by reading the schema.) | `ReelCreate.tags`, `Reel.tags` |
| R16 | No validation of ad dates (end before start), negative `max_impressions`, or empty creatives list. *(read, not run)* | `schemas/ad.py` |
| R17 | Reports on your own reel are allowed; the 6-report threshold uses fresh accounts. *(read)* | `moderation_service` |

**Low / housekeeping**
- `generic_exception_handler` is written but never registered (unexpected errors use FastAPI's default).
- `passlib[bcrypt]` is listed but unused; it is also known to clash with the bcrypt 5 that gets installed.
- Every requirement uses `>=` with no lock file. Today this installed FastAPI 0.143 / Starlette 1.7 and tests pass, but builds are not reproducible. Pin versions.
- Tables are created both by `create_all()` at import and by Alembic; use one (Alembic).
- Unbounded reply nesting; replies are loaded recursively, one query per level.

### 2.4 Integration gaps with TalkTrading
1. **No video upload.** Reels only stores URLs to videos already hosted elsewhere (S3/CDN with presigned uploads). We have no such storage. Something must accept the upload, check the file is really a video, check its length and size, and serve it: either a small upload endpoint here (the Story Service already does exactly this with Pillow/`filetype`/`mutagen` and signed URLs) or real object storage.
2. **No follow graph.** "Followers" visibility can only work if Reels asks the Post Service who follows whom (the Story Service already does this with the viewer's token: `graph.PostGraph`). Same for a "Following" reels feed.
3. **No usernames/avatars.** Reels returns only the author's UUID; the frontend would look names up through the Post Service, as it already does for stories.
4. **Notifications** (likes/comments on your reel) do not exist; they would need to go through our existing notification path.
5. **Ports/config:** needs `JWT_SECRET_KEY` = the Post Service `SECRET_KEY`, a port (e.g. 8005), `BACKEND_CORS_ORIGINS=["http://localhost:5173","http://127.0.0.1:5173"]`, and a launcher entry.
6. **Admin/moderator roles** come from a `roles` claim our login tokens do not have, so nobody can open the moderation queue from the app; only the service API key works.

---

## 3. Explore v2 (`explore`)

### 3.1 What it is
Not a new service: an updated copy of the Explore service we already run from `Explore-main`. A file-by-file comparison shows:

**Improvements in v2 (worth keeping)**
- `FlexibleInstantDeserializer`: robust timestamp parsing (with/without timezone, epoch), with tests.
- Extra error handlers: malformed JSON → 400, unknown route → 404, wrong method → 405 (today some of these return 500).
- Datasource, Flyway and Hibernate settings overridable by environment variables; `.env.example`, Maven wrapper, setup docs; a standalone demo UI in `frontend/`.
- 70 tests, all passing (up from the current version's set).

**Regressions: things v2 removes that our app needs**

| # | Problem | Proof |
|---|---|---|
| E1 | **Returns no posts.** `PostServiceClient` is an older file (22 Sep) than ours (5 Oct) and sends `visibility=PUBLIC`; our Post Service only accepts lowercase `public` and answers 422, so Explore falls back to an empty list. | Live, same Post Service: current Explore **10 posts**, v2 **0 posts**; v2 log shows `422 ... Input should be 'public', 'followers' or 'private'`. |
| E2 | **No images.** The `@JsonAlias("url")` that reads our Post Service's media field was removed (the file is the old 22 Sep version). | Live, hashtag `#carouseltest`: current returns the image URL, v2 returns an empty one. |
| E3 | **Blocked by the browser.** `WebConfig.java` (CORS for the React app) was deleted. | Live preflight from `http://localhost:5173`: current 200, v2 **403**. |

**Other problems**

| # | Problem | Detail |
|---|---|---|
| E4 | Wrong default Post Service address: `http://localhost:8000` in `application.yml` and `.env.example`. In this project 8000 is the **News** service; Post is 8004. | Works only because our launcher overrides it. |
| E5 | The Flyway migration (`V1__init_explore_schema.sql`) uses PostgreSQL-only SQL (`ON CONFLICT`). With the new H2-in-runtime setup it fails to start unless Flyway is disabled. | Confirmed: start-up fails with H2 + Flyway on. |
| E6 | `hibernate.jdbc.batch_size` / `format_sql` moved to the wrong level in `application.yml` (`spring.jpa.properties.jdbc...` instead of `...hibernate.jdbc...`), so batching is silently off. | Read |
| E7 | H2 moved from `test` to `runtime` scope, so the production jar ships an in-memory database driver. | `pom.xml` |
| E8 | Identity still comes from a trusted `X-User-Id` header with no gateway in this project, so any caller can act as any user for interactions/recommendations. **Same in today's version** (known, and Explore is outside what we may change), not a v2 regression. | `SecurityUtils` (unchanged) |
| E9 | Actuator shows full health details and metrics publicly (`show-details: always`, `metrics`, `prometheus`). Also in today's version. | `application.yml` |
| E10 | `frontend/` is a separate demo console (lets you type any `X-User-Id`), with built files committed (`dist/`) and a dev proxy (`serve.py`) that listens on all network interfaces and forwards any PUT/DELETE/OPTIONS path. Fine as a dev tool; not part of our app and should not be deployed. | Read |
| E11 | `docs/ENDPOINT_VERIFICATION_REPORT.md` reports every feed test as PASS, but every one returned `content: []` because the Post Service was not running. That is why E1-E3 were missed. Its links also point to another machine (`c:/Users/wizar/Desktop/explore`). | Read |

### 3.2 Recommendation for Explore
Keep running `Explore-main`. If the improvements are wanted, they should be ported onto `Explore-main` (keeping `WebConfig.java`, the lowercase `visibility`, and the `url` alias), not swapped in wholesale. Explore is on the do-not-touch list, so that is your call.

---

## 4. What to do next

**Reels: before it can be integrated (in order)**
1. Enforce who can see a reel everywhere (view, like, comment, comment list, share), using the Post Service follow graph for `followers`; answer 404 for anything hidden (R1, R2, R9, R10).
2. Remove `is_pinned` from the owner's edit (or make it pin only on the owner's own profile) (R3).
3. Lock down ads: campaigns start `pending` and need an admin to approve; validate `cta_url`/media as `https` URLs; track impressions/clicks only for logged-in users from the token, once per user per creative (R4, R5, R16).
4. Validate every media URL as `https` and against `ALLOWED_MEDIA_DOMAINS` (R6).
5. Fix the report threshold (count after flush), ignore self-reports and brand-new accounts, or send to review without hiding (R7, R17).
6. Filter deleted replies (R8); limit tags (R15); atomic counter updates (R11).
7. CORS = the app's origins only; `/ready` returns 503 without error text when the DB is down; rate-limit per user and skip health checks (R12-R14).
8. Pin dependency versions, drop `passlib`, register the generic error handler, use Alembic only.
9. Add the missing pieces for our app: video upload with validation, usernames via Post lookup, launcher entry, frontend Reels tab.

**Explore v2:** do not swap it in; see 3.2.

---

## 5. Evidence

| Check | Result |
|---|---|
| Reels own test suite (scratch copy, fresh venv from its `requirements.txt`) | **36 passed** |
| Reels probe (real app via TestClient, throwaway SQLite) | 15 of 16 suspected issues confirmed; the report threshold was confirmed at 6 instead of 5 in a follow-up run |
| Reels Alembic `upgrade head` + `check` | Migration applies; matches models |
| Explore v2 `mvn test` (JDK 23, Maven 3.9.9, scratch copy) | **70 passed**, 0 failures (2 ERROR log lines are from tests that simulate outages) |
| Explore v2 live vs current, same Post Service | current 10 posts / images / CORS OK; v2 0 posts (422), no image URL, CORS 403 |
| Originals modified? | No: 0 files changed in `Reels-main/` or `explore/` since the review started |

### 5.1 Standalone runs (each service alone, one at a time, 2026-10-19)

**Reels**: started with its own `.env.example` settings on port 8005 (SQLite). 22 requests covering every feature; every one returned the expected code, no server errors logged:

| Request | Result |
|---|---|
| `/`, `/api/v1/health`, `/api/v1/ready`, `/openapi.json` | 200 |
| Publish reel logged in / without login | 201 / 401 |
| Feed (anonymous), reel by id, view, like, bookmark, share | 200 |
| Comment, reply | 201 |
| Comment list, owner edit | 200 |
| Edit by someone else | 403 |
| Report | 201 |
| Moderation queue without admin role | 403 |
| Owner delete, then open it / feed | 200, then 404 / reel gone from feed |

**Explore v2**: started with the standalone settings from its `docs/LOCAL_SETUP.md` (in-memory H2, Flyway off, dev mode) on port 8093, with no Post Service and no Redis (Post URL pointed at an unused port so it could not reach our News service on its default 8000). Started in about 13 s.

| Request | Result |
|---|---|
| Liveness, OpenAPI docs | 200 |
| `/api/v1/explore`, `?userId=42`, `/trending`, `/popular`, `/recent`, `/hashtags/bitcoin` | 200, empty lists (nothing to rank without the Post Service) |
| Page size 51 / `page=abc` / malformed JSON | 400 with clear messages |
| Interaction without user / with `X-User-Id` | 401 / 201 recorded |
| Unknown route / wrong method | 404 / 405 (the new error handlers work) |
| Full `/actuator/health` | 503 DOWN: `db` UP, `postService` DOWN (not running), `redis` DOWN (not installed). Expected when it runs alone. |

So both services **run correctly on their own**. The problems in sections 2 and 3 show up when they are used by real users (Reels) or connected to our real Post Service and frontend (Explore).

Probe scripts: kept in the session scratch folder (`probe_reels.py`, `probe2.py`); they can be added to the Reels test suite when the fixes are made, so each problem stays fixed.
