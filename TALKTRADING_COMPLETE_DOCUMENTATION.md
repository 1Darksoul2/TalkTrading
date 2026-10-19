# TalkTrading — Complete Project Documentation

> **Version 3.0** · last updated **19 October 2026**
> This is the single reference for the project: what it is, how it is built, how to run, deploy, test and
> operate it, what is finished, and what is left. Older reports are kept in [`docs/history/`](docs/history/).

---

## Contents

1. [Status at a glance](#1-status-at-a-glance)
2. [What TalkTrading is](#2-what-talktrading-is)
3. [Repository map](#3-repository-map)
4. [Architecture](#4-architecture)
5. [The services](#5-the-services)
6. [Identity, security and privacy](#6-identity-security-and-privacy)
7. [The web app](#7-the-web-app)
8. [Running it on your computer](#8-running-it-on-your-computer)
9. [Deploying it](#9-deploying-it)
10. [Operating the beta](#10-operating-the-beta)
11. [Testing](#11-testing)
12. [Known limitations and risks](#12-known-limitations-and-risks)
13. [Roadmap](#13-roadmap)
14. [Change log](#14-change-log)
15. [Other documents](#15-other-documents)
- [Appendix A — API reference](#appendix-a--api-reference)
- [Appendix B — Settings (`deploy/.env`)](#appendix-b--settings-deployenv)

---

## 1. Status at a glance

**Ready for a closed beta** with trusted testers, once it is deployed on a server with a domain and a news key.

| Area | State |
|---|---|
| Features | All built and connected to the real services, which run their original code; no mock data anywhere |
| End-to-end check | 17 user flows pass in a real browser against the production Docker stack (PostgreSQL, gateway, production build), and every page passes on desktop and phone size |
| Service tests | Each service's own test suite passes (see [§11](#11-testing)); the 2 chat WebSocket tests hang in their test harness |
| CI | GitHub Actions runs every suite, the web app's lint and build, and validates the deployment files |
| Deployment | Docker Compose stack with HTTPS gateway, backups, restore, moderation and starter-content scripts — all exercised end to end |
| Not verified yet | Live prices (TradingView) and news (Finnhub) were blocked in the build environment; check them on the real server with the in-app Service status page |

Readiness by part, honestly:

| Part | Done | What is missing |
|---|---|---|
| Features | ~90% | Reel upload in the app (the Reel service stores only links to hosted videos), password reset by email, block/mute, account self-deletion |
| Wiring and stability | ~95% | Load testing with many simultaneous users |
| Deployment and operations | ~90% | First real deploy; outside data feeds verified live |
| Safety | ~70% | Email verification, password reset by email, server-side password rules, block/mute and an admin screen all need changes to the Post Service; scripts cover moderation and password resets meanwhile |
| Phones | ~85% | Tested at iPhone size in a browser; not yet on real devices |

---

## 2. What TalkTrading is

A social network for traders: people share trade ideas, discuss markets and back their calls with live charts.

| Area | What users can do |
|---|---|
| **Accounts** | Sign up (full name, username, email), sign in with email, "Remember me", edit profile and photo. A forgotten password is reset by the team (see [§10](#10-operating-the-beta)) |
| **Home feed** | Posts with photos and videos, `$TICKERS`, `#hashtags`, `@mentions`; like, comment (threaded), save, share, follow; Everyone / Following tabs |
| **Stories** | 24-hour photo/video stories with stickers, viewers, replies, reactions, polls, highlights, Close Friends, hide-from, mute, archive |
| **Reels** | Vertical video feed with like, save, comment, share, follow, report and delete. Reels are published by the team from hosted videos (`add_reel.py`); the Reel service stores only the video link |
| **Chats** | One-to-one messages, end-to-end encrypted in the browser |
| **Communities** | Create, discover, join and leave trading groups |
| **Explore** | For You, Trending, Popular and Recent feeds; people search; hashtag pages |
| **Markets** | Watchlist, 20 instruments (stocks, crypto, forex, commodities) with live prices and sparklines, TradingView chart per symbol |
| **News** | Market news by category, saved articles |
| **Notifications** | Likes, comments, follows, mentions, story activity; bell with unread count |
| **Settings** | Account, your information (export / delete story data), story privacy, people lists, notifications, appearance (3 themes, high contrast, reduce motion) |
| **Beta pages** | Terms of Use, Privacy Notice, Community Guidelines, Send feedback, Service status, 404 |

---

## 3. Repository map

```
TalkTrading/
├── TalkTrading-main/TalkTrading-main/   The web app (React 19 + Vite + Tailwind 4)
├── backend/
│   ├── post-service-feature-post-module/  Post Service: accounts and the social core   (Python, port 8004)
│   ├── story-service/                     Story Service                                (Python, port 8001)
│   ├── Reels-main/                        Reel Service                                 (Python, port 8005)
│   ├── E2E-main/                          Encrypted chat (E2EE) Service                (Python, port 8003)
│   ├── news-service/                      News Service                                 (Python, port 8000)
│   ├── chart-service/                     Chart Service                                (Python, port 8002)
│   ├── community-main/                    Community Service                            (Java, port 8080)
│   └── Explore-main/                      Explore Service                              (Java, port 8083)
├── deploy/                    Production: docker-compose.yml, Caddyfile (gateway), Dockerfiles, scripts/
├── tests/e2e/                 Browser tests that drive the running app as real users
├── .github/workflows/ci.yml   Continuous integration
├── start_all.py / stop_all.py (+ .bat/.ps1 wrappers)   One-command local start and stop
├── README.md                  Quick start
├── DEPLOY.md                  Step-by-step deployment to a server
├── BETA_TESTING.md            Running the closed beta; the page for testers
└── docs/history/              Earlier audits and reports (kept for reference)
```

---

## 4. Architecture

```
                    Browser (React app)                                      Outside providers
                           │  HTTPS, one address                              TradingView (prices, chart widget)
                           ▼                                                  Yahoo Finance (sparklines)
  ┌──────────────────────────────────────────────────────────┐               Finnhub (news)
  │ Gateway — Caddy (deploy/Caddyfile)                        │               Video host / CDN (reel videos)
  │  /                → the web app (static files)            │
  │  /svc/<service>/… → the service, prefix removed           │
  │  security headers, rate limits, HTTPS certificates        │
  │  sets X-User-Id for Community/Explore from a verified login│
  └───┬──────┬──────┬──────┬──────┬───────┬─────────┬────────┘
      │      │      │      │      │       │         │
    post   story   reel   e2ee   news   chart   community / explore
    8004   8001    8005   8003   8000   8002     8080 / 8083
      │      │      │      │      │       │         │
      └──────┴──────┴──── PostgreSQL 16 (one database per service) ──┘
                     Redis (chat rate limits, Explore cache)
                     Volumes: post_uploads, story_media, community_uploads
```

- **One public address.** Only the gateway is reachable from the internet (ports 80/443). Services and databases sit on a private Docker network.
- **One login for everything.** The Post Service issues the login token (JWT, HS256); every other Python service verifies it with the same secret. Community and Explore trust an `X-User-Id` header that only the gateway sets (see [§6](#6-identity-security-and-privacy)).
- **Each service owns its data.** Services never read each other's databases; where one needs another's data it calls the public API (Story and Explore read the follow graph from the Post Service).
- **Local development** runs the same services without Docker: SQLite files instead of PostgreSQL, H2 in memory for the Java services, and the browser talks to each port directly.

---

## 5. The services

| Service | Folder | Port | Stack | Data | Login check | Health | Tests |
|---|---|---|---|---|---|---|---|
| **Post** (accounts, posts, comments, likes, saves, shares, follows, profiles, mentions, hashtags, notifications) | `backend/post-service-feature-post-module` | 8004 | Python 3.9, FastAPI | `post` DB, `post_uploads` | Issues tokens | `/health/` | 76 |
| **Story** (stories, stickers, highlights, privacy lists, story notifications, data export) | `backend/story-service` | 8001 | Python 3.12, FastAPI | `story` DB, `story_media` | JWT | `/health` | 148 |
| **Reel** (reels, comments, likes, bookmarks, shares, reports) | `backend/Reels-main` | 8005 | Python 3.12, FastAPI | `reel` DB | JWT | `/api/v1/health` | 36 |
| **E2EE chat** (devices, key bundles, conversations, encrypted messages, WebSocket) | `backend/E2E-main` | 8003 | Python 3.11, FastAPI | `e2e` DB, Redis | JWT | `/health` | 27 |
| **News** (ingestion from a provider, articles, saved articles) | `backend/news-service` | 8000 | Python 3.12, FastAPI | `news` DB | JWT for bookmarks | `/health` | 23 |
| **Chart** (20 symbols, quotes, sparklines) | `backend/chart-service` | 8002 | Python 3.11, FastAPI | `chart` DB | none (public data) | `/health` | 12 |
| **Community** (communities, members, roles, community posts) | `backend/community-main` | 8080 | Java 23, Spring Boot 3 | `community` DB, `community_uploads` | `X-User-Id` from gateway | `/api/v1/health` | 110 |
| **Explore** (ranked For You / Trending / Popular / Recent feeds) | `backend/Explore-main` | 8083 | Java 23, Spring Boot 3 | `explore` DB, Redis | `X-User-Id` from gateway | `/actuator/health/liveness` | 56 |

Notes per service:

- **Post** is the identity authority: `/auth/register` and `/auth/login` (by email). Users have a UUID `id`; the post tables use an integer `author_id` derived from it with CRC32 (`derive_author_id`), which the web app reproduces in `src/utils/authorId.js`. Registration takes no name, so the web app saves the full name with `PUT /api/v1/users/me` straight after sign-up. Its logging middleware adds a layer on every request and fails after about 1,000 requests in one process; the deployment runs it as two workers that each restart after 800 requests (see [§9](#9-deploying-it)).
- **Story** stores uploads on disk and serves them through signed, expiring URLs; it also answers the gateway's `/internal/gateway-auth` check (blocked from outside).
- **Reel** stores reels as links to videos hosted elsewhere (a CDN or storage bucket); it has no upload of its own. The team publishes reels with `deploy/scripts/add_reel.py`. Moderation actions need `X-Service-API-Key`.
- **E2EE** never sees private keys or plaintext; it stores public key bundles and ciphertext and delivers over WebSocket. See [§6](#6-identity-security-and-privacy).
- **News** pulls from one provider (`NEWS_PROVIDER`, default Finnhub) with `NEWS_API_KEY`; without a key the feed is empty and the app says so.
- **Chart** reads live quotes from TradingView's public scanner (cached 60 s; no account or key needed) and 7-day sparklines from Yahoo Finance (cached 15 min). When those are unreachable, the Markets page says "Live prices are unavailable" instead of showing numbers.
- **Community** and **Explore** are Spring Boot services. In production they use PostgreSQL; locally `start_all.py` runs them with an in-memory H2 database (data resets on restart).

---

## 6. Identity, security and privacy

**Login.** The Post Service checks the password (bcrypt) and returns a JWT whose `sub` is the user's UUID, signed with `JWT_SECRET` (HS256), lasting `LOGIN_LIFETIME_MINUTES` (7 days by default). The web app stores it in `localStorage` with "Remember me", otherwise in `sessionStorage`, signs the user out the moment it expires, and on any `401` from any service.

**Community and Explore.** These trust an `X-User-Id` header. The gateway deletes any `X-User-Id`/`X-User-Roles` the browser sends, asks the Story Service (`/internal/gateway-auth`) to verify the token, and sets `X-User-Id` only from a valid login. Nobody can impersonate another user or claim admin roles through these headers.

**Forgotten passwords.** The Post Service has no password reset, so the team sets a temporary password on request with `moderate.sh set-password <email>` (the hash is made by the Post Service's own password function); the app's "Forgot password?" page explains this and links to the support email.

**Gateway protections.**
- 10 sign-in/sign-up attempts per minute per address, 900 API calls per minute per address overall.
- Security headers: HSTS, no framing, strict Content-Security-Policy, `nosniff`, no `Server` header.
- Login tokens never appear in logs: the gateway strips the chat WebSocket's token from its access log, and the chat service runs without its own access log for that reason.
- The gateway overwrites `X-Forwarded-For` with the real client address. The Story, Reel and E2EE services read it (`--proxy-headers`) so their per-address rate limits apply to each user, not to everyone together.

**End-to-end encrypted chat.**
- Each browser generates an X25519/Ed25519 identity, a signed prekey and one-time prekeys (`@noble/curves`) and uploads only the public parts.
- Senders run X3DH against the recipient's bundle, derive a key with HKDF-SHA256, and encrypt with AES-256-GCM; the server stores and forwards ciphertext only.
- Private keys stay in the browser, AES-GCM-encrypted in IndexedDB under a non-extractable WebCrypto key (`src/crypto/keyVault.js`).
- Consequence: chats are tied to a browser. A new browser, phone or cleared site data cannot read earlier messages.

**Privacy.** What is stored and why is described for users on `/privacy`. Story data can be exported or deleted in Settings; full account export or deletion is done by the team on request (see [BETA_TESTING.md](BETA_TESTING.md)). Backups are kept 14 days.

---

## 7. The web app

**Location:** `TalkTrading-main/TalkTrading-main` · React 19, React Router 7, Vite 8, Tailwind CSS 4, framer-motion.

**Where each page gets its data:**

| Page | Route | Services |
|---|---|---|
| Sign in / Sign up / Forgot password (help page) | `/login` `/signup` `/forgot-password` | Post |
| Home feed, stories tray, composer | `/` | Post, Story, Chart (ticker strip) |
| Post detail, hashtag page | `/p/:id` `/tags/:tag` | Post |
| Reels | `/reels` | Reel, Post (authors, follow), Chart (ticker prices) |
| Create (post / story) | `/create` | Post, Story, Chart (ticker search) |
| Profile | `/profile` `/profile/:username` | Post, Story |
| Chats | `/chats` | E2EE, Post (names) |
| Communities | `/communities` | Community |
| Explore | `/explore` | Explore, Post (people search, follow) |
| Markets, stock page | `/market` `/market/:symbol` | Chart, TradingView widget |
| News | `/news` | News, Chart |
| Notifications | `/notifications` | Post, Story |
| Settings | `/settings/*` | Post, Story |
| Story viewer, archive | `/stories/:id` `/stories/archive` | Story |
| Feedback, Service status, 404 | `/feedback` `/status` | all (health checks) |
| Terms, Privacy, Guidelines (public) | `/terms` `/privacy` `/guidelines` | — |

**Code layout.** `src/services/*Service.js` (one file per backend; addresses in `apiConfig.js`), `src/context/` (auth, chat, theme, preferences, watchlist), `src/crypto/` (chat encryption), `src/components/` (layout, posts, stories, profile, settings, ui), `src/pages/`, `src/utils/session.js` (where the login lives), `src/config.js` (support email, legal date).

**Rules the app follows.**
- **No fallbacks to fake data.** If a call fails the page says what failed; nothing is invented.
- **Service addresses:** in development they default to the local ports; a production build gets them from `deploy/docker/gateway.Dockerfile` and refuses to start if one is missing.
- **Each page loads on first visit** (the first download is 443 KB, 140 KB compressed). A crash inside one page shows a message there, not a blank app.
- **Phones:** bottom navigation for the main sections; Market and Create in the top bar. The app can be added to the home screen (`manifest.webmanifest`).

**Commands:** `npm install`, `npm run dev` (port 5173), `npm run lint`, `npm run build`.

---

## 8. Running it on your computer

**Needs:** Python 3.11+ (3.12 recommended), Node 22, and for Community/Explore a **JDK 23+** with **Maven** (without them those two are skipped).

```bash
# once
python -m venv venv
venv\Scripts\activate                     # macOS/Linux: source venv/bin/activate
for %s in (news-service story-service chart-service E2E-main post-service-feature-post-module Reels-main) do pip install -r backend\%s\requirements.txt
pip install greenlet               # needed by the chat service, not in its requirements
cd TalkTrading-main\TalkTrading-main && npm install

# every time
python start_all.py          # or start.bat / .\start.ps1
python stop_all.py           # or stop.bat / .\stop.ps1
```

Then open http://localhost:5173 and sign up. Options: `--backend-only`, `--check-only`, `--kill-existing`, `--windows` (one console per service).

| Port | Service | Local data |
|---|---|---|
| 8000 | News | `news.db` |
| 8001 | Story | `stories.db` |
| 8002 | Chart | `chart.db` |
| 8003 | E2EE chat | `e2e.db` |
| 8004 | Post | `post.db` |
| 8005 | Reel | `reel.db` |
| 8080 | Community | in memory |
| 8083 | Explore | in memory |
| 5173 | Web app | — |

**Keys and settings:** copy `.env.example` to `.env` in the project root and fill it in; `start_all.py` passes it to every service. Only Finnhub (news) needs a key; TradingView (prices and charts) needs none. The in-app **Service status** page shows whether news articles and live prices are arriving.

**Trying the production setup locally:** `cd deploy && python scripts/make_env.py --local && docker compose up -d --build`, then open http://localhost:8088.

---

## 9. Deploying it

Follow [DEPLOY.md](DEPLOY.md). In short: one Linux server (Hetzner CX32, about €8/month) with Docker, a domain pointing at it, then:

```bash
cd /opt/talktrading/deploy
python3 scripts/make_env.py --domain your-domain.com --email you@example.com
docker compose up -d --build
python3 scripts/seed_beta.py --url https://your-domain.com --email team@your-domain.com
```

The gateway obtains and renews the HTTPS certificate itself. All settings live in `deploy/.env` ([Appendix B](#appendix-b--settings-deployenv)); keep a copy of it somewhere safe, because the databases and logins depend on it.

Services in `docker-compose.yml`: `gateway`, `db` (PostgreSQL 16), `redis`, `post`, `story`, `news`, `chart`, `reel`, `e2e`, `community`, `explore`.

The service code is deployed exactly as it is in `backend/`. What the deployment adds around it lives in `deploy/`:
- **Post** runs as two workers that each restart after 800 requests, and the gateway retries a request once if a worker is restarting. This keeps the Post Service's logging middleware below the point (about 1,000 requests per process) where it fails.
- **Reel** is built from `deploy/docker/reel.Dockerfile`; **E2EE** from `deploy/docker/e2e.Dockerfile`, which also installs `greenlet` (needed by its database library but missing from its requirements).
- Reel and E2EE read the real client address from the gateway, so their rate limits apply per user; E2EE writes no access log because its WebSocket URL carries the login token.

---

## 10. Operating the beta

Everything runs from `/opt/talktrading/deploy` on the server. The full routine is in [BETA_TESTING.md](BETA_TESTING.md).

| Task | Command |
|---|---|
| Health | `docker compose ps`, or `/status` in the app |
| Logs | `docker compose logs -f --tail=100 <service>` |
| Backup (nightly via cron) | `sh scripts/backup.sh` → `backups/<date>/` (all databases, all uploads, `.env`), kept 14 days |
| Restore | `sh scripts/restore.sh backups/<date>` (asks you to type RESTORE; replaces all data) |
| Reports | `sh scripts/moderate.sh reports` |
| Recent content | `sh scripts/moderate.sh recent` |
| Hide / restore | `moderate.sh hide-post <id>` · `restore-post` · `hide-reel <id>` · `restore-reel` · `end-story <id>` · `close-story-reports <id>` |
| Look up a user | `sh scripts/moderate.sh user <username>` |
| Forgotten password | `sh scripts/moderate.sh set-password <email>` (prompts for a temporary password; send it to the user privately) |
| Publish a reel | `python3 scripts/add_reel.py --url https://your-domain.com --email team@… --video https://cdn…/clip.mp4 --duration 42 --caption "…" --tickers NVDA` (the video must already be hosted over HTTPS) |
| Beta numbers | `sh scripts/moderate.sh stats` |
| Starter content | `python3 scripts/seed_beta.py --url … --email …` (safe to run again) |
| Update to a new version | `git pull && docker compose up -d --build` |

---

## 11. Testing

**Service test suites** (each service's own tests; all pass):

| Service | Tests | Runs on |
|---|---|---|
| Post | 76 | Python 3.9 |
| Story | 148 | Python 3.12 |
| Reel | 36 | Python 3.12 |
| E2EE chat | 25 + 2 WebSocket tests (see below) | Python 3.11 (plus `greenlet`) |
| News | 23 | Python 3.12 (SQLite) |
| Chart | 12 | Python 3.11 |
| Community | 110 | Java 23 |
| Explore | 56 | Java 23 |
| **Total** | **488** (486 run in the blocking CI jobs) | |

The chat service's two WebSocket tests hang inside the test client (the WebSocket itself works, as the browser tests show). CI runs them in a separate job that cannot block a merge.

**CI** (`.github/workflows/ci.yml`, on every push to `main` and every pull request): all suites above on their Dockerfile's version; web app lint and production build; `docker compose config`; gateway image build and Caddyfile validation; launcher syntax.

**Browser tests** (`tests/e2e/`, run against a running stack, see its README):
- `flows.js` — two new users: sign-up (with the full name saved), post with photo and ticker, story, a reel published through the Reel API, follow/like/comment on the reel, report it, feed, notifications, create and join a community, people search, profile, encrypted chat both ways, sign-in with "Remember me", wrong password, the forgot-password help page (17 steps).
- `pages.js` — every page opens without a crash, failed call or console error.
- `mobile.js` — every page fits an iPhone-size screen; Market and Create are reachable.
- `a11y.js` — every page in the dark and light themes has no serious or critical accessibility problem (axe-core: contrast, names of buttons and links, links not told apart by colour alone).

**Verified on 18–19 October 2026:** the full Docker stack (PostgreSQL, Redis, gateway with HTTPS config, production web build) built and ran; all three browser suites passed against it; a backup was taken, data changed, the backup restored, and the flows passed again on the restored data; moderation hide/restore was checked through the public API. In that environment the system packages for three images and Maven Central were rate-limited or blocked, so those images were built from the same code with equivalent stand-in Dockerfiles; the real Dockerfiles are unchanged and build normally on a server with internet access. CI builds and tests them on GitHub.

---

## 12. Known limitations and risks

| Limitation | Effect | Plan |
|---|---|---|
| No email verification at sign-up | Anyone can register with any address | Phase 3 |
| No password reset by email | The team sets a temporary password with `moderate.sh set-password` | Needs a Post Service change |
| No reel upload in the app | Reels are published by the team from hosted videos with `add_reel.py` | Needs a Reel Service upload endpoint and video storage |
| Post Service worker restarts | Each worker restarts every 800 requests; the gateway retries, so users see nothing | Goes away when the Post logging middleware is fixed |
| No admin screen | Moderation is done with `moderate.sh` on the server | Phase 3 |
| Password rules only in the sign-up form | Someone calling the API directly could set a weak password | Phase 3 |
| No block/mute for posts and chats | Only stories have mute/hide | Phase 3 |
| No self-service account deletion | Done by the team on request | Phase 3 |
| Chats tied to the browser | A new browser/phone can't read earlier messages | By design of the encryption; multi-device key sync later |
| Prices and news depend on TradingView, Yahoo and Finnhub | If they block or change, those pages show "unavailable" | Watch during beta; a paid feed later |
| Community and Explore lose data on restart locally | Local only (H2 in memory); production uses PostgreSQL | — |
| Quick reloads can trigger a harmless 429 from chat key upload | Nothing visible to the user; keys are already registered | — |
| Single server | No redundancy; a server outage takes the beta down | Enough for a beta; backups cover data loss |
| Not load-tested | Unknown limit of simultaneous users | Phase 5 |

---

## 13. Roadmap

| Phase | Goal | Status |
|---|---|---|
| 0 | Services built; one login across services; gateway; Docker deployment | ✅ Done |
| 1 | New web app connected to every service, no mock data | ✅ Done |
| 2 | Beta readiness: legal pages, feedback, status page, reel reports, phone layout, CI, browser tests, backups/restore, moderation and starter-content scripts, beta guide | ✅ Done |
| 3 | **Next:** deploy to a server; verify prices, news and email live; email verification; server-side password rules; block/mute; admin screen | Next |
| 4 | Closed beta with 10–20 testers for 2 weeks ([BETA_TESTING.md](BETA_TESTING.md)) | After phase 3 deploy |
| 5 | Polish and open beta: load test, video compression, push notifications, invite links | Later |
| 6 | After launch: installable app, price alerts, verified traders, group chats, creator subscriptions | Later |

---

## 14. Change log

**19 October 2026 — core services back to their original code**
- The Post, Reel and E2EE service folders are again exactly as they were before this work (the Community and Explore folders were never changed). Changes made earlier inside them were undone: username sign-in, full name at registration, password reset by email, the reel video upload endpoint, the Post crash fix, and the E2EE requirements fix.
- The web app was adapted: sign-in with email; the full name is saved to the profile right after sign-up; "Forgot password?" is a help page; Create offers Post and Story; the Reels page shows reels the team publishes.
- The deployment covers what the code changes did: Post runs as two workers restarting every 800 requests with a gateway retry; `greenlet` is installed by the E2EE Dockerfile; the Reel Dockerfile moved to `deploy/docker/`.
- New operator tools: `moderate.sh set-password` and `scripts/add_reel.py`. SMTP settings removed (the Post Service sends no email).

**19 October 2026 — polish**
- One `.env` for keys: `.env.example` at the project root, read by `start_all.py` and passed to every service; `make_env.py` writes a labelled place for the Finnhub key in `deploy/.env`. TradingView needs no key.
- Service status page shows whether news articles are arriving (to confirm the Finnhub key).
- Accessibility and themes: light theme fixed (some cards stayed dark navy with dark text; gold, green, red and grey text now meet WCAG AA contrast on white), warnings use a theme-aware colour, settings switches are named by their row, profile links and follower counts are announced correctly, links in text are underlined. Automated scan: no serious or critical issues on any page in dark or light; no console warnings in any theme.
- New browser test `tests/e2e/a11y.js`.

**19 October 2026 — beta readiness** (core service code untouched in this round)
- Web app: Terms, Privacy and Guidelines pages; feedback page; service status page; 404 page; reel report and delete; Market and Create reachable on phones (the floating Market button covered content); scrollable tab bars; pages load on demand (first download 747 → 443 KB); web app manifest and icon.
- Security: the chat service no longer writes access logs (its WebSocket URL carries the login token, which uvicorn logged in full); the gateway's log keeps the URL with the token removed. Sign-in pages explain the gateway's rate limit ("Too many attempts from this network") instead of a generic failure.
- Deployment: gateway build sends only the web app and Caddyfile (a local `node_modules` from another OS used to break the image, and the whole repo including `deploy/.env` was sent to Docker); Reel and E2EE services read the real client address so rate limits are per user; `SUPPORT_EMAIL` setting.
- Operations: `backup.sh` covers every upload volume; `restore.sh`; `moderate.sh`; `seed_beta.py`; `BETA_TESTING.md`.
- Quality: CI workflow; browser test suite in `tests/e2e`.
- Documentation: this file rewritten; older reports moved to `docs/history/`.

**18 October 2026 — new web app connected**
- The `TalkTrading-main` web app replaced the previous one and was connected to all eight services; all mock data removed.
- Reel Service joined the stack (Dockerfile, gateway route, database).
- Post, Reel and E2EE code changes made on this day were undone on 19 October (see above).
- `start_all.py` requires JDK 23 (the Java services compile with 23).

**September – October 2026 — earlier phases** (details in `docs/history/`)
- Code audit of every service (`DIAGNOSIS.md`); one login across services with UUID subjects; CRC32 author-id bridge; Community and Explore integration through the gateway; `start_all.py` / `stop_all.py`; production deployment with Caddy and PostgreSQL.

---

## 15. Other documents

| Document | For |
|---|---|
| [README.md](README.md) | Quick start |
| [DEPLOY.md](DEPLOY.md) | Putting it on a server, step by step |
| [BETA_TESTING.md](BETA_TESTING.md) | Running the beta; the page for testers |
| [tests/e2e/README.md](tests/e2e/README.md) | Running the browser tests |
| Service READMEs in `backend/*/` | Each service's own details |
| [docs/history/](docs/history/) | Earlier audits and reports: original project write-up (Sept 2026), `DIAGNOSIS.md`, `INITIAL_FILES_AUDIT.md`, `NEW_SERVICES_REVIEW.md`, `IMPLEMENTATION_CHECKLIST.md` |

---

## Appendix A — API reference

Generated from each service's own OpenAPI description on 19 October 2026 (224 endpoints; internal and advertising
endpoints omitted). In production every path is reached through the gateway under its public base, e.g.
`https://your-domain.com/svc/post/api/v1/posts/`. Locally, call the port directly, e.g. `http://127.0.0.1:8004/api/v1/posts/`.
Full request and response details: each service's `/docs` page (Python) or `/swagger-ui.html` (Java).

### Post Service — accounts, posts, comments, likes, saves, shares, follows, profiles, notifications

Public base: `/svc/post` · 85 endpoints

| Method | Path | What it does |
|---|---|---|
| `GET` | `/` | Root |
| `GET` | `/api/v1/comments/{comment_id}` | Read Comment By Id |
| `PUT` | `/api/v1/comments/{comment_id}` | Edit Comment Content |
| `DELETE` | `/api/v1/comments/{comment_id}` | Remove Comment By Id |
| `GET` | `/api/v1/feed/` | Read User Feed |
| `GET` | `/api/v1/hashtags/{hashtag}/posts` | List Posts For Hashtag |
| `GET` | `/api/v1/health/` | Health Summary |
| `GET` | `/api/v1/health/live` | Liveness Check |
| `GET` | `/api/v1/health/ready` | Readiness Check |
| `DELETE` | `/api/v1/media/{media_id}` | Remove Post Media |
| `GET` | `/api/v1/notifications` | List Notifications |
| `POST` | `/api/v1/notifications/read-all` | Read All |
| `GET` | `/api/v1/notifications/unread-count` | Unread Count |
| `POST` | `/api/v1/notifications/{notification_id}/read` | Read One |
| `POST` | `/api/v1/posts/` | Create New Post |
| `GET` | `/api/v1/posts/` | List Posts |
| `GET` | `/api/v1/posts/{post_id}` | Read Post Detail |
| `PUT` | `/api/v1/posts/{post_id}` | Update Existing Post |
| `DELETE` | `/api/v1/posts/{post_id}` | Delete Existing Post |
| `POST` | `/api/v1/posts/{post_id}/comments` | Create Comment For Post |
| `GET` | `/api/v1/posts/{post_id}/comments` | List Comments For Post |
| `POST` | `/api/v1/posts/{post_id}/likes` | Add Like |
| `DELETE` | `/api/v1/posts/{post_id}/likes` | Remove Like |
| `GET` | `/api/v1/posts/{post_id}/likes/count` | Read Like Count |
| `POST` | `/api/v1/posts/{post_id}/media` | Upload Post Media |
| `POST` | `/api/v1/posts/{post_id}/save` | Add Save |
| `DELETE` | `/api/v1/posts/{post_id}/save` | Remove Save |
| `POST` | `/api/v1/posts/{post_id}/shares` | Share Post By Id |
| `GET` | `/api/v1/users/by-username/{username}` | Read By Username |
| `GET` | `/api/v1/users/lookup` | Lookup Users |
| `GET` | `/api/v1/users/me` | Read Me |
| `PUT` | `/api/v1/users/me` | Update Me |
| `POST` | `/api/v1/users/me/avatar` | Upload Avatar |
| `GET` | `/api/v1/users/me/saved-posts` | List Saved Posts |
| `GET` | `/api/v1/users/search` | Search Users |
| `GET` | `/api/v1/users/{user_id}` | Read Profile |
| `POST` | `/api/v1/users/{user_id}/follow` | Follow |
| `DELETE` | `/api/v1/users/{user_id}/follow` | Unfollow |
| `GET` | `/api/v1/users/{user_id}/follow-stats` | Follow Stats |
| `GET` | `/api/v1/users/{user_id}/followers` | Followers |
| `GET` | `/api/v1/users/{user_id}/following` | Following |
| `GET` | `/api/v1/users/{user_id}/mentions` | Mentions |
| `POST` | `/auth/login` | Login |
| `POST` | `/auth/register` | Register |
| `GET` | `/comments/{comment_id}` | Read Comment By Id |
| `PUT` | `/comments/{comment_id}` | Edit Comment Content |
| `DELETE` | `/comments/{comment_id}` | Remove Comment By Id |
| `GET` | `/feed/` | Read User Feed |
| `GET` | `/hashtags/{hashtag}/posts` | List Posts For Hashtag |
| `GET` | `/health/` | Health Summary |
| `GET` | `/health/live` | Liveness Check |
| `GET` | `/health/ready` | Readiness Check |
| `DELETE` | `/media/{media_id}` | Remove Post Media |
| `GET` | `/notifications` | List Notifications |
| `POST` | `/notifications/read-all` | Read All |
| `GET` | `/notifications/unread-count` | Unread Count |
| `POST` | `/notifications/{notification_id}/read` | Read One |
| `POST` | `/posts/` | Create New Post |
| `GET` | `/posts/` | List Posts |
| `GET` | `/posts/{post_id}` | Read Post Detail |
| `PUT` | `/posts/{post_id}` | Update Existing Post |
| `DELETE` | `/posts/{post_id}` | Delete Existing Post |
| `POST` | `/posts/{post_id}/comments` | Create Comment For Post |
| `GET` | `/posts/{post_id}/comments` | List Comments For Post |
| `POST` | `/posts/{post_id}/likes` | Add Like |
| `DELETE` | `/posts/{post_id}/likes` | Remove Like |
| `GET` | `/posts/{post_id}/likes/count` | Read Like Count |
| `POST` | `/posts/{post_id}/media` | Upload Post Media |
| `POST` | `/posts/{post_id}/save` | Add Save |
| `DELETE` | `/posts/{post_id}/save` | Remove Save |
| `POST` | `/posts/{post_id}/shares` | Share Post By Id |
| `GET` | `/users/by-username/{username}` | Read By Username |
| `GET` | `/users/lookup` | Lookup Users |
| `GET` | `/users/me` | Read Me |
| `PUT` | `/users/me` | Update Me |
| `POST` | `/users/me/avatar` | Upload Avatar |
| `GET` | `/users/me/saved-posts` | List Saved Posts |
| `GET` | `/users/search` | Search Users |
| `GET` | `/users/{user_id}` | Read Profile |
| `POST` | `/users/{user_id}/follow` | Follow |
| `DELETE` | `/users/{user_id}/follow` | Unfollow |
| `GET` | `/users/{user_id}/follow-stats` | Follow Stats |
| `GET` | `/users/{user_id}/followers` | Followers |
| `GET` | `/users/{user_id}/following` | Following |
| `GET` | `/users/{user_id}/mentions` | Mentions |

### Story Service — stories, highlights, story privacy, story notifications

Public base: `/svc/story` · 49 endpoints

| Method | Path | What it does |
|---|---|---|
| `DELETE` | `/account-data` | Delete My Story Data |
| `GET` | `/close-friends` | List Close Friends |
| `POST` | `/close-friends` | Add Close Friends |
| `DELETE` | `/close-friends/{user_id}` | Remove Close Friends |
| `GET` | `/export` | Export My Data |
| `GET` | `/health` | Health |
| `POST` | `/highlights` | Create Highlight |
| `PUT` | `/highlights/order` | Order Highlights |
| `GET` | `/highlights/user/{user_id}` | User Highlights |
| `GET` | `/highlights/{highlight_id}` | Get Highlight |
| `PATCH` | `/highlights/{highlight_id}` | Update Highlight |
| `DELETE` | `/highlights/{highlight_id}` | Delete Highlight |
| `GET` | `/notifications` | List Notifications |
| `POST` | `/notifications/read-all` | Read All |
| `GET` | `/notifications/unread-count` | Unread Count |
| `POST` | `/notifications/{notification_id}/read` | Read One |
| `POST` | `/stories` | Create Story |
| `GET` | `/stories/archive` | Get Archive |
| `GET` | `/stories/feed` | Get Feed |
| `POST` | `/stories/media` | Upload Media |
| `POST` | `/stories/presign` | Presign Upload |
| `GET` | `/stories/tray` | Get Tray |
| `GET` | `/stories/user/{user_id}` | Get User Stories |
| `GET` | `/stories/{story_id}` | Get Story |
| `DELETE` | `/stories/{story_id}` | Delete Story |
| `GET` | `/stories/{story_id}/analytics` | Get Analytics |
| `PUT` | `/stories/{story_id}/countdown/reminder` | Remind Me |
| `DELETE` | `/stories/{story_id}/countdown/reminder` | Stop Reminding |
| `POST` | `/stories/{story_id}/link-click` | Link Click |
| `POST` | `/stories/{story_id}/poll/vote` | Vote In Poll |
| `POST` | `/stories/{story_id}/question` | Answer Question |
| `GET` | `/stories/{story_id}/question/answers` | Question Answers |
| `POST` | `/stories/{story_id}/quiz` | Answer Quiz |
| `PUT` | `/stories/{story_id}/reaction` | React |
| `DELETE` | `/stories/{story_id}/reaction` | Unreact |
| `GET` | `/stories/{story_id}/replies` | Get Replies |
| `POST` | `/stories/{story_id}/replies` | Reply To Story |
| `POST` | `/stories/{story_id}/report` | Report Story |
| `POST` | `/stories/{story_id}/slider` | Answer Slider |
| `POST` | `/stories/{story_id}/view` | View Story |
| `GET` | `/stories/{story_id}/viewers` | Get Viewers |
| `GET` | `/story-hidden` | List Hidden |
| `POST` | `/story-hidden` | Add Hidden |
| `DELETE` | `/story-hidden/{user_id}` | Remove Hidden |
| `GET` | `/story-mutes` | List Muted |
| `POST` | `/story-mutes` | Add Muted |
| `DELETE` | `/story-mutes/{user_id}` | Remove Muted |
| `GET` | `/story-settings` | Read Settings |
| `PUT` | `/story-settings` | Write Settings |

### Reel Service — reels, comments, likes, bookmarks, reports

Public base: `/svc/reel` · 18 endpoints

| Method | Path | What it does |
|---|---|---|
| `GET` | `/` | Root |
| `GET` | `/api/v1/feed` | Get Feed |
| `GET` | `/api/v1/health` | Basic health status |
| `POST` | `/api/v1/moderation/reels/{reel_id}/action` | Moderate Reel |
| `POST` | `/api/v1/moderation/reels/{reel_id}/report` | Report Reel |
| `GET` | `/api/v1/moderation/reports` | Get Reports |
| `GET` | `/api/v1/ready` | Readiness check including database ping |
| `POST` | `/api/v1/reels` | Create Reel |
| `DELETE` | `/api/v1/reels/comments/{comment_id}` | Delete Comment |
| `GET` | `/api/v1/reels/{reel_id}` | Get Reel |
| `PUT` | `/api/v1/reels/{reel_id}` | Update Reel |
| `DELETE` | `/api/v1/reels/{reel_id}` | Delete Reel |
| `POST` | `/api/v1/reels/{reel_id}/bookmark` | Toggle Bookmark |
| `POST` | `/api/v1/reels/{reel_id}/comments` | Add Comment |
| `GET` | `/api/v1/reels/{reel_id}/comments` | Get Comments |
| `POST` | `/api/v1/reels/{reel_id}/like` | Toggle Like |
| `POST` | `/api/v1/reels/{reel_id}/share` | Record Share |
| `POST` | `/api/v1/reels/{reel_id}/view` | Register View |

### E2EE Chat Service — devices, key bundles, conversations, encrypted messages, WebSocket

Public base: `/svc/e2ee` · 12 endpoints

| Method | Path | What it does |
|---|---|---|
| `GET` | `/e2ee/conversations` | List Conversations |
| `POST` | `/e2ee/conversations` | Create Conversation |
| `POST` | `/e2ee/conversations/{conversation_id}/messages` | Send Message |
| `GET` | `/e2ee/conversations/{conversation_id}/messages` | Get Messages |
| `GET` | `/e2ee/devices` | List Devices |
| `POST` | `/e2ee/devices` | Register Device |
| `GET` | `/e2ee/devices/{device_id}` | Get Device |
| `DELETE` | `/e2ee/devices/{device_id}` | Revoke Device |
| `POST` | `/e2ee/devices/{device_id}/rotate` | Rotate Signed Prekey |
| `GET` | `/e2ee/keys/{user_id}` | Get User Keys |
| `POST` | `/e2ee/prekeys` | Replenish Prekeys |
| `GET` | `/health` | Health Check |

### Community Service — communities, membership, community posts

Public base: `/svc/community` · 43 endpoints

| Method | Path | What it does |
|---|---|---|
| `PUT` | `/api/v1/comments/{commentId}` | Update comment |
| `DELETE` | `/api/v1/comments/{commentId}` | Delete comment |
| `GET` | `/api/v1/comments/{commentId}/replies` | Get comment replies |
| `GET` | `/api/v1/communities` | Get communities |
| `POST` | `/api/v1/communities` | Create community |
| `GET` | `/api/v1/communities/{communityId}/posts` | Get community posts |
| `GET` | `/api/v1/communities/{id}` | Get community by ID |
| `PUT` | `/api/v1/communities/{id}` | Update community |
| `DELETE` | `/api/v1/communities/{id}` | Delete community |
| `POST` | `/api/v1/communities/{id}/join` | Join community |
| `DELETE` | `/api/v1/communities/{id}/join` | Leave community |
| `GET` | `/api/v1/communities/{id}/members` | Get community members |
| `DELETE` | `/api/v1/communities/{id}/members/{userId}` | Remove community member |
| `PUT` | `/api/v1/communities/{id}/members/{userId}/role` | Update member role |
| `POST` | `/api/v1/communities/{id}/posts` | Create community post |
| `GET` | `/api/v1/feed` | Get main feed |
| `GET` | `/api/v1/feed/following` | Get personalized following feed |
| `GET` | `/api/v1/health` | Check microservice status |
| `GET` | `/api/v1/media/files/{filename}` | Serve media file |
| `GET` | `/api/v1/posts` | Get posts |
| `POST` | `/api/v1/posts` | Create post |
| `GET` | `/api/v1/posts/{id}` | Get post by ID |
| `PUT` | `/api/v1/posts/{id}` | Update post |
| `DELETE` | `/api/v1/posts/{id}` | Delete post |
| `GET` | `/api/v1/posts/{postId}/comments` | Get post comments |
| `POST` | `/api/v1/posts/{postId}/comments` | Create comment or reply |
| `POST` | `/api/v1/posts/{postId}/like` | Like post |
| `DELETE` | `/api/v1/posts/{postId}/like` | Unlike post |
| `GET` | `/api/v1/posts/{postId}/likes` | Get post likes |
| `GET` | `/api/v1/posts/{postId}/media` | Get post media |
| `POST` | `/api/v1/posts/{postId}/media` | Upload post media |
| `DELETE` | `/api/v1/posts/{postId}/media/{mediaId}` | Delete post media |
| `POST` | `/api/v1/posts/{postId}/vote` | Vote on post |
| `DELETE` | `/api/v1/posts/{postId}/vote` | Remove vote |
| `GET` | `/api/v1/search` | Global search |
| `POST` | `/api/v1/users` | Create user profile |
| `GET` | `/api/v1/users/{id}` | Get profile by user ID |
| `PUT` | `/api/v1/users/{id}` | Update user profile |
| `POST` | `/api/v1/users/{id}/follow` | Follow user |
| `DELETE` | `/api/v1/users/{id}/follow` | Unfollow user |
| `GET` | `/api/v1/users/{id}/followers` | Get followers |
| `GET` | `/api/v1/users/{id}/following` | Get following |
| `GET` | `/api/v1/users/{userId}/posts` | Get user posts |

### Explore Service — ranked discovery feeds

Public base: `/svc/explore` · 6 endpoints

| Method | Path | What it does |
|---|---|---|
| `GET` | `/api/v1/explore` | Get Personalized Explore Feed |
| `GET` | `/api/v1/explore/hashtags/{hashtag}` | Get Posts by Hashtag |
| `POST` | `/api/v1/explore/interactions` | Record Post Interaction |
| `GET` | `/api/v1/explore/popular` | Get Popular Posts |
| `GET` | `/api/v1/explore/recent` | Get Recent Posts |
| `GET` | `/api/v1/explore/trending` | Get Trending Posts |

### News Service — articles and saved articles

Public base: `/svc/news` · 6 endpoints

| Method | Path | What it does |
|---|---|---|
| `GET` | `/health` | Health |
| `GET` | `/news` | Get News Feed |
| `GET` | `/news/bookmarks` | Get My Bookmarks |
| `GET` | `/news/{article_id}` | Get Article |
| `PUT` | `/news/{article_id}/bookmark` | Bookmark Article |
| `DELETE` | `/news/{article_id}/bookmark` | Unbookmark Article |

### Chart Service — symbols, quotes, sparklines

Public base: `/svc/chart` · 5 endpoints

| Method | Path | What it does |
|---|---|---|
| `GET` | `/health` | Health |
| `GET` | `/quotes/batch` | Get Batch Quotes |
| `GET` | `/symbols` | List Symbols |
| `GET` | `/symbols/{symbol}/quote` | Get Quote |
| `GET` | `/symbols/{symbol}/sparkline` | Get Sparkline |

---

## Appendix B — Settings (`deploy/.env`)

Created by `scripts/make_env.py`; edit, then run `docker compose up -d` (add `--build` after changing `PUBLIC_URL` or `SUPPORT_EMAIL`, which are built into the web app).

| Setting | Meaning |
|---|---|
| `SITE_ADDRESS` | Domain the gateway answers on (`:80` for a local trial) |
| `PUBLIC_URL` | Full address users open, e.g. `https://talktrading.example.com` |
| `ACME_EMAIL` | Email for the free HTTPS certificate |
| `SUPPORT_EMAIL` | Shown in the app for feedback, reports and privacy requests |
| `HTTP_PORT`, `HTTPS_PORT` | Ports the gateway listens on (80/443) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database account (random) |
| `JWT_SECRET` | Signs every login; changing it logs everyone out |
| `LOGIN_LIFETIME_MINUTES` | How long a login lasts (default 10080 = 7 days) |
| `REEL_SERVICE_API_KEY` | Lets `moderate.sh` moderate reels |
| `NEWS_PROVIDER`, `NEWS_API_KEY` | News source (default Finnhub) and its key. TradingView needs no key |

