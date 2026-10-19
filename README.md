# TalkTrading System

A social network for traders: posts, stories, reels, end-to-end encrypted chat, communities, explore, live market charts and news. Eight backend services and a React 19 + Vite web app.

## 🧰 One-time setup

The Python services share one virtual environment in `venv/` at the project root, and the web app needs its npm packages:

```bash
python -m venv venv
venv\Scripts\activate            # Windows  (macOS/Linux: source venv/bin/activate)
for %s in (news-service story-service chart-service E2E-main post-service-feature-post-module Reels-main) do pip install -r backend\%s\requirements.txt
cd TalkTrading-main\TalkTrading-main && npm install
```

(On macOS/Linux use `for s in news-service story-service chart-service E2E-main post-service-feature-post-module Reels-main; do pip install -r backend/$s/requirements.txt; done`.)

## 🔑 API keys

| Service | Key needed? | Where it goes |
|---|---|---|
| **Finnhub** (news) | Yes, free at [finnhub.io](https://finnhub.io) | `NEWS_API_KEY` |
| **TradingView** (prices, charts) | **No.** Prices come from TradingView's public feed and the chart is its free widget | — |
| **Email** (password reset) | Optional: any SMTP provider | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` |

- **On your computer:** copy `.env.example` to `.env` in the project root and fill it in. `start_all.py` passes it to every service.
- **On the server:** the same names go in `deploy/.env` (created by `deploy/scripts/make_env.py`); then `docker compose up -d`.
- To check: open **Service status** in the app (account menu). "News articles" and "Live prices" turn green once data arrives.

## 🚀 One-Command Quick Start

Start all 8 backend microservices and the frontend in a single command:

```cmd
:: Windows Command Prompt / Double-click
start.bat
```

```powershell
# Windows PowerShell
.\start.ps1
```

```bash
# Python
python start_all.py
```

### 🛑 Stop All Services

To cleanly stop all background microservices and free all ports:

```cmd
stop.bat
```
*(or `.\stop.ps1` / `python stop_all.py`)*

---

## 📡 Microservices & Endpoints

| Microservice | Port | Database (local) | Health Check | Interactive Docs / UI |
| :--- | :--- | :--- | :--- | :--- |
| **News Service** | `8000` | SQLite (`news.db`) | [/health](http://127.0.0.1:8000/health) | [Swagger UI](http://127.0.0.1:8000/docs) |
| **Story Service** | `8001` | SQLite (`stories.db`) | [/health](http://127.0.0.1:8001/health) | [Swagger UI](http://127.0.0.1:8001/docs) |
| **Chart Service** | `8002` | SQLite (`chart.db`) | [/health](http://127.0.0.1:8002/health) | [Swagger UI](http://127.0.0.1:8002/docs) |
| **E2EE Chat Service** | `8003` | SQLite (`e2e.db`) | [/health](http://127.0.0.1:8003/health) | [Swagger UI](http://127.0.0.1:8003/docs) |
| **Post Service** (accounts, posts, follows) | `8004` | SQLite (`post.db`) | [/health](http://127.0.0.1:8004/health) | [Swagger UI](http://127.0.0.1:8004/docs) |
| **Reel Service** | `8005` | SQLite (`reel.db`) | [/api/v1/health](http://127.0.0.1:8005/api/v1/health) | [Swagger UI](http://127.0.0.1:8005/docs) |
| **Community Service** (Java) | `8080` | H2 in memory | [/api/v1/health](http://127.0.0.1:8080/api/v1/health) | [Swagger UI](http://127.0.0.1:8080/swagger-ui.html) |
| **Explore Service** (Java) | `8083` | H2 in memory | [/actuator/health](http://127.0.0.1:8083/actuator/health/liveness) | [Swagger UI](http://127.0.0.1:8083/swagger-ui.html) |
| **Frontend Web App** | `5173` | React 19 + Vite | — | [App Home](http://localhost:5173) |

The web app lives in `TalkTrading-main/TalkTrading-main/`. Every page talks to the services above; there is no mock data. In development it finds them on the ports above; a production build gets their addresses from `deploy/docker/gateway.Dockerfile` (one `VITE_*_SERVICE_URL` per service) and refuses to start if one is missing.

- **Accounts:** sign up, sign in with email *or* username ("Remember me" keeps you signed in after the browser closes), and reset a forgotten password. Reset links are emailed when `SMTP_HOST` is set for the Post Service; otherwise the link is printed in the Post Service log.
- **Community and Explore** are Java/Spring Boot services. `start_all.py` runs them through Maven and needs **JDK 23+** and Maven; without them it skips those two and says so.
- **News** needs a free Finnhub key (see API keys above); **prices and charts** come from TradingView and need no key. When either source is unreachable the page says so instead of showing made-up data.

---

## 🛠 Advanced Startup Options

- `start.bat --windows` (or `-w`): Opens each service in its own dedicated, titled Windows console window.
- `start.bat --backend-only` (or `--no-frontend`): Launches only the 8 backend microservices without starting Vite.
- `start.bat --check-only`: Verifies that Python virtualenv, Node/npm, and all ports are available.
- `start.bat --kill-existing`: Automatically terminates any processes occupying ports 8000-8005, 8080, 8083, 5173 before launching.

## 📚 Documentation

| Document | For |
|---|---|
| [TALKTRADING_COMPLETE_DOCUMENTATION.md](TALKTRADING_COMPLETE_DOCUMENTATION.md) | Everything: architecture, services, security, testing, operations, limits, roadmap, API reference |
| [DEPLOY.md](DEPLOY.md) | Putting it on a server |
| [BETA_TESTING.md](BETA_TESTING.md) | Running the closed beta, and the page for testers |
| [tests/e2e/README.md](tests/e2e/README.md) | Browser tests that drive the app as real users |
