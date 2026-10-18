# TalkTrading — Complete Master System Documentation

> **Document Version**: 2.0 (Consolidated Master Reference)  
> **Last Updated**: October 2026  
> **Status**: Comprehensive System Reference & Audit Remediation Record  
> **Scope**: All 6 Microservices (News, Story, Chart, E2EE Chat, Post, Community) + Frontend Web Application + Cryptographic Architecture + Unified Orchestrator

---

## Table of Contents

1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
2. [Microservices Breakdown & Service Profiles](#2-microservices-breakdown--service-profiles)
   - [2.1 News Service (Port 8000)](#21-news-service-news-service-port-8000)
   - [2.2 Story Service (Port 8001)](#22-story-service-story-service-port-8001)
   - [2.3 Chart Service (Port 8002)](#23-chart-service-chart-service-port-8002)
   - [2.4 E2EE Chat & Identity Service (Port 8003)](#24-e2ee-chat--identity-service-e2e-main-port-8003)
   - [2.5 Post & Interaction Service (Port 8004)](#25-post--interaction-service-post-service-feature-post-module-port-8004)
   - [2.6 Community Service (Port 8080)](#26-community-service-community-main-port-8080)
   - [2.7 Frontend Web Application (Port 5173)](#27-frontend-web-application-talktrading-frontend-port-5173)
3. [End-to-End Encryption (E2EE) Cryptographic Architecture](#3-end-to-end-encryption-e2ee-cryptographic-architecture)
   - [3.1 Cryptographic Foundations & X3DH Protocol](#31-cryptographic-foundations--x3dh-protocol)
   - [3.2 The Cryptographically Blind Server Model](#32-the-cryptographically-blind-server-model)
   - [3.3 Web Cryptography & IndexedDB Key Storage](#33-web-cryptography--indexeddb-key-storage)
   - [3.4 Security Gates & Verification Matrix](#34-security-gates--verification-matrix)
4. [Independent Audit & Deep-Dive Diagnostics Summary](#4-independent-audit--deep-dive-diagnostics-summary)
   - [4.1 Code Inspection & Test Suite Baseline](#41-code-inspection--test-suite-baseline)
   - [4.2 Key Architectural Vulnerabilities & Inconsistencies Found](#42-key-architectural-vulnerabilities--inconsistencies-found)
5. [Complete Remediation & Development Log (Work Done Till Date)](#5-complete-remediation--development-log-work-done-till-date)
   - [5.1 Phase 1: Deep Diagnostic Audit](#51-phase-1-deep-diagnostic-audit)
   - [5.2 Phase 2: Central Authentication & Identity Engineering](#52-phase-2-central-authentication--identity-engineering)
   - [5.3 Phase 3: Frontend User Identity & Profile Wiring](#53-phase-3-frontend-user-identity--profile-wiring)
   - [5.4 Phase 4: Community Microservice Discovery, Dockerization & Frontend Integration](#54-phase-4-community-microservice-discovery-dockerization--frontend-integration)
   - [5.5 Phase 5: Unified Multi-Service Orchestrator & CLI Tooling](#55-phase-5-unified-multi-service-orchestrator--cli-tooling)
6. [Complete API Reference Guide](#6-complete-api-reference-guide)
7. [Frontend Architecture, Pages & State Management](#7-frontend-architecture-pages--state-management)
8. [How to Run, Test & Operate the Platform](#8-how-to-run-test--operate-the-platform)
9. [Prioritized Punch List & Production Roadmap](#9-prioritized-punch-list--production-roadmap)

---

## 1. Executive Summary & System Architecture

**TalkTrading** is a full-stack, enterprise-grade financial social network and trading intelligence platform. It integrates real-time market quotes and financial charting, aggregated market news feeds, ephemeral 24-hour video/image stories, rich social interactions (posts, nested comments, media, hashtags), structured trader communities/groups, and a zero-knowledge End-to-End Encrypted (E2EE) private messaging protocol.

### High-Level Architecture Diagram

```
                             +-------------------------------------------------------------+
                             |                    TalkTrading Clients                      |
                             |            talktrading-frontend (React 18 + Vite)           |
                             |                         Port 5173                           |
                             +----+-----------+-----------+------------+------------+------+
                                  |           |           |            |            |
                                  |           |           |            |            | (Docker / REST)
                                  v           v           v            v            v
                            +-----------+ +-----------+ +----------+ +------------+ +------------+
                            | News Svc  | | Story Svc | |Chart Svc | | E2EE Svc   | | Post Svc   |
                            | Port 8000 | | Port 8001 | |Port 8002 | | Port 8003  | | Port 8004  |
                            | FastAPI   | | FastAPI   | |FastAPI   | | FastAPI    | | FastAPI    |
                            +-----+-----+ +-----+-----+ +----+-----+ +------+-----+ +-----+------+
                                  |             |            |              |             |
                             SQLite (dev)  SQLite (dev) SQLite (dev)  SQLite/PG     SQLite (dev)
                             news.db       stories.db   chart.db      e2e.db+Redis  post.db
                                  |             |            |              |             |
                                  v             v            v              |             v
                             External News    AWS S3     TradingView/       |        Local Uploads
                             API Adapters    Presign    Yahoo Finance       |         /uploads/
                                                                            |
                                  +-----------------------------------------+
                                  |
                                  v
                            +-------------------------------------------------------------+
                            | Community Microservice (Java 23 / Spring Boot 3.3.4)        |
                            | Port 8080 (Dockerized Container + PostgreSQL 16 DB)         |
                            +-------------------------------------------------------------+
```

### Complete Microservices Matrix

| Microservice | Port | Stack / Language | Database / Storage | Auth Mechanism | Health Check Endpoint | Interactive Docs / UI | Status |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :---: |
| **News Service** | `8000` | Python 3.10 / FastAPI | SQLite (`news.db`) | Open / Public Read | `GET /health` | [Swagger UI](http://127.0.0.1:8000/docs) | **Operational** |
| **Story Service** | `8001` | Python 3.10 / FastAPI | SQLite (`stories.db`) + S3 | Pluggable JWT / Auth Optional | `GET /health` | [Swagger UI](http://127.0.0.1:8001/docs) | **Operational** |
| **Chart Service** | `8002` | Python 3.10 / FastAPI | SQLite (`chart.db`) | Open / Public Read | `GET /health` | [Swagger UI](http://127.0.0.1:8002/docs) | **Operational** |
| **E2EE Identity Svc** | `8003` | Python 3.10 / FastAPI | SQLite (`e2e.db`) + Redis | Bearer JWT (HS256 / Ed25519) | `GET /health` | [Swagger UI](http://127.0.0.1:8003/docs) | **Operational** |
| **Post Service** | `8004` | Python 3.10 / FastAPI | SQLite (`post.db`) + Local FS | Bearer JWT (Bcrypt + UUID sub) | `GET /health` | [Swagger UI](http://127.0.0.1:8004/docs) | **Operational** |
| **Community Service** | `8080` | Java 23 / Spring Boot 3.3.4 | PostgreSQL 16 (Docker) | `X-User-Id` Header Filter | `GET /api/v1/health` | [Swagger UI](http://127.0.0.1:8080/swagger-ui.html) | **Operational** |
| **Frontend Web App** | `5173` | React 18 / Vite / Lucide | IndexedDB + LocalStorage | AuthContext + Token Sync | `GET /` | [App Home](http://localhost:5173) | **Operational** |

---

## 2. Microservices Breakdown & Service Profiles

### 2.1 News Service (`news-service/`, Port 8000)
- **Role**: Ingestion, normalization, deduplication, indexing, and serving of financial news.
- **Data Ingestion**: Multi-provider adapter pattern (`app/adapters/`) supporting Finnhub, NewsAPI, AlphaVantage, Polygon, GNews, and MediaStack.
- **Deduplication**: Enforces uniqueness on `source_url` preventing duplicate feed pollution.
- **Query Capabilities**: Supports cursor-based pagination, symbol-specific filtering (`related_symbols`), category filtering, and user bookmarks (`/news/bookmarks`).
- **Tests**: 12/12 automated pytest unit & integration tests passing.

### 2.2 Story Service (`story-service/`, Port 8001)
- **Role**: Ephemeral 24-hour social stories with video/image hosting and engagement tracking.
- **Media Ingestion**: Direct client-to-cloud upload via Amazon S3 Presigned URLs (`POST /stories/presign`), eliminating media bottleneck on backend servers.
- **Lifecycle & TTL**: Automatic 24-hour expiration filter (`filter(expires_at > now)`).
- **Background Worker**: `app/worker.py` provides batch deletion and event broadcasting (`story.expired`).
- **Abuse Prevention**: Rate limiting configured with `slowapi` to prevent media spam.
- **Tests**: 10/10 automated pytest unit & integration tests passing.

### 2.3 Chart Service (`chart-service/`, Port 8002)
- **Role**: Real-time market data quotes, mini-chart sparklines, and candlestick OHLCV timeseries.
- **Seed Universe**: 20 pre-seeded financial instruments spanning US Equities (AAPL, TSLA, NVDA), Crypto (BTC, ETH, SOL), Forex (EUR/USD, GBP/USD), and Commodities (Gold, Oil).
- **Live Scraper / Provider**: Live quotes scraped via TradingView Scanner API and 7-day sparklines via Yahoo Finance public chart endpoints.
- **Interactive UI**: Native integration with TradingView Advanced Real-Time Chart widget embedded on the frontend.
- **Caching**: 60-second TTL in-memory quote cache to optimize upstream bandwidth.
- **Tests**: 12/12 automated pytest unit & integration tests passing.

### 2.4 E2EE Chat & Identity Service (`E2E-main/`, Port 8003)
- **Role**: Cryptographic identity registry, prekey distribution facility, opaque ciphertext envelope repository, and real-time WebSocket delivery gateway.
- **Core Principle**: **Cryptographically Blind Server** — the backend never sees private keys, never derives session keys, and cannot decrypt message ciphertext.
- **X3DH Prekey Distribution**: Manages Identity Keys (IK), Signed Prekeys (SPK), and One-Time Prekeys (OPK) with atomic DB consumption (`with_for_update()`).
- **Real-Time Communication**: Async WebSocket endpoint (`/ws/v1/chat/{device_id}`) with live push delivery for online recipients and inbox queueing for offline devices.
- **Protection**: Redis sliding-window rate limiter protecting registration and prekey fetching endpoints (with graceful fail-open resilience).
- **Tests**: 27/27 automated pytest security & cryptographic tests passing.

### 2.5 Post & Interaction Service (`post-service-feature-post-module/`, Port 8004)
- **Role**: Core social engine providing posts, rich text, ticker tagging (`$TSLA`), hashtags (`#crypto`), nested threaded comments, likes, saves/bookmarks, and media management.
- **Authentication**: Primary authentication authority for the platform. Implements `POST /auth/register` and `POST /auth/login` with Passlib/Bcrypt password hashing and JWT token issuance.
- **Media Engine**: Local filesystem media storage (`/uploads/`) with defensive path-traversal validation.
- **Security**: Granular resource ownership enforcement (users can only edit/delete their own posts and comments).
- **Tests**: 28/28 automated pytest unit & integration tests passing.

### 2.6 Community Service (`community-main/`, Port 8080)
- **Role**: Full-featured Reddit-style community group platform with trading-specific metadata (Entry Price, Target, Stop Loss, Timeframe, Direction).
- **Technology**: Java 23, Spring Boot 3.3.4, Spring Data JPA, PostgreSQL 16, Maven, Docker.
- **Features**:
  - Community Creation, Discover Feed, Member Join/Leave, Role Management (`OWNER`, `MODERATOR`, `MEMBER`).
  - Community-specific post feeds, nested comment hierarchies, upvoting/downvoting.
  - User profiles, follow/unfollow graphs, and keyword search.
- **Deployment**: Fully dockerized with Docker Compose to resolve Windows JDK NIO AF_UNIX platform socket compatibility.

### 2.7 Frontend Web Application (`talktrading-frontend/`, Port 5173)
- **Role**: Client interface built with React 18, Vite, Lucide React icons, and custom modern responsive dark-mode styling.
- **Security & Crypto Layer**: Pure browser-side cryptography using `@noble/curves` and WebCrypto API (`SubtleCrypto`). Private keys generated and stored in IndexedDB; never exported.
- **State Management**: React Context APIs (`AuthContext`, `E2EContext`, `SettingsStateContext`).

---

## 3. End-to-End Encryption (E2EE) Cryptographic Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                 X3DH KEY EXCHANGE PROTOCOL                                       |
+---------------------------------------------------------------------------------------------------+
  ALICE (Sender Browser)                                          BOB (Recipient Device)
    |                                                               |
    | 1. Request Bob's Key Bundle (IK_B, SPK_B, OPK_B_1)           |
    +-------------------------------------------------------------->| (Stored in E2EE Svc)
    |                                                               |
    | 2. Generate Ephemeral Keypair (EK_A)                         |
    | 3. Compute 4 Diffie-Hellman Shared Secrets:                   |
    |    DH1 = X25519(IK_A_priv, SPK_B_pub)                         |
    |    DH2 = X25519(EK_A_priv, IK_B_pub)                          |
    |    DH3 = X25519(EK_A_priv, SPK_B_pub)                         |
    |    DH4 = X25519(EK_A_priv, OPK_B_pub)                         |
    |                                                               |
    | 4. SK = HKDF-SHA256(DH1 || DH2 || DH3 || DH4, "TalkTrading")  |
    | 5. Encrypt Envelope: AES-256-GCM(SK, Nonce, Plaintext, AAD)   |
    |                                                               |
    | 6. Send Envelope (Ciphertext, IK_A, EK_A, OPK_id) via WebSocket/REST                          |
    +---------------------------------------------------------------------------------------------->|
                                                                    | 7. Compute DH1..DH4 using     |
                                                                    |    Bob's private keys         |
                                                                    | 8. Derive SK via HKDF-SHA256  |
                                                                    | 9. AES-256-GCM Decrypt        |
```

### 3.1 Cryptographic Foundations & X3DH Protocol
- **Identity Keys (IK)**: Ed25519 for identity signatures; X25519 for Diffie-Hellman key exchange (Curve25519).
- **Signed Prekeys (SPK)**: Rotated periodically, signed with the device's Identity Private Key.
- **One-Time Prekeys (OPK)**: Batch generated (e.g., 50 keys) and atomically consumed on the server upon key fetch.
- **Session Derivation**: HKDF-SHA256 derives 256-bit symmetric encryption keys from concatenated DH outputs.
- **Symmetric Cipher**: AES-256-GCM with 96-bit unique nonces and Associated Authenticated Data (AAD) binding sender and recipient device IDs.

### 3.2 The Cryptographically Blind Server Model
The E2EE Identity Service acts solely as an untrusted message routing switch:
1. **Zero Private Key Ingestion**: The API schema strictly rejects any payload containing private keys.
2. **Zero Plaintext Ingestion**: Message submission endpoints accept only base64-encoded ciphertext blobs.
3. **Zero Server Decryption**: The server does not possess the mathematical components required to compute the Diffie-Hellman secret.

### 3.3 Web Cryptography & IndexedDB Key Storage
- All key generation takes place in the user's browser using `window.crypto.subtle`.
- Cryptographic keys are saved into an IndexedDB database (`talktrading_crypto_store`) marked as **non-extractable** (`extractable: false`), preventing script-level exfiltration.

### 3.4 Security Gates & Verification Matrix

| # | Security Gate Requirement | Status | Verification & Evidence | Residual Risk / Mitigation |
| :-: | :--- | :-: | :--- | :--- |
| **1** | **No private keys server-side** | **PASS** | Validated via `test_security_gate_1_private_keys_never_reach_backend` | None. Private keys never leave the browser. |
| **2** | **No plaintext messages server-side** | **PASS** | Validated via `test_security_gate_2_and_3_plaintext_never_sent` | None within service boundary. |
| **3** | **No server-side decryption capability**| **PASS** | Validated via `test_security_gate_4_e2ee_service_cannot_decrypt_messages` | None. |
| **4** | **Service-to-service auth (Ed25519)** | **PASS** | Validated via `test_service_to_service_auth_success` | Mitigated by 5-minute token TTL. |
| **5** | **Distributed rate limiting** | **PASS** | Validated via `test_rate_limiting_enforcement` (HTTP 429) | Redis outage; fail-open fallback. |
| **6** | **Device authorization** | **PASS** | Validated via JWT `sub` and `device_id` cross-checks | Token leakage mitigated by expiration. |
| **7** | **Prekey atomicity** | **PASS** | Validated via `with_for_update()` DB row locking | SQLite single-writer lock contention. |
| **8** | **Key rotation safety** | **PASS** | Validated via `test_security_gate_8_key_rotation` | Client-side periodic schedule. |
| **9** | **Device revocation** | **PASS** | Validated via `test_security_gate_6_revoked_devices_purged` | En-route dispatched messages. |
| **10**| **Multi-device fan-out** | **PASS** | Validated via `test_security_gate_7_multiple_devices_handled` | Payload size scaling. |
| **11**| **Permissive licensing** | **PASS** | `@noble/curves` (MIT), PyCA `cryptography` (Apache 2.0) | Upstream security patch tracking. |
| **12**| **Web key storage isolation** | **PASS** | IndexedDB with non-extractable WebCrypto keys | DOM XSS mitigated via CSP. |
| **13**| **Zero sensitive data in logs** | **PASS** | Validated via `test_security_gate_12_sensitive_data_not_logged` | Stack trace leakage in debug mode. |
| **14**| **Safe database backups** | **PASS** | DB contains only public keys and ciphertext envelopes | Metadata traffic analysis. |

---

## 4. Independent Audit & Deep-Dive Diagnostics Summary

In September 2026, a rigorous, code-level diagnostic audit was executed across the entire codebase to cross-examine architectural claims against actual source code and running test suites.

### 4.1 Code Inspection & Test Suite Baseline
Every test suite was executed locally and verified:
- **News Service**: 12/12 Tests Passing (`pytest`)
- **Story Service**: 10/10 Tests Passing (`pytest`)
- **Chart Service**: 12/12 Tests Passing (`pytest`)
- **E2EE Chat Service**: 27/27 Tests Passing (`pytest`)
- **Post Service**: 28/28 Tests Passing (`pytest`)

### 4.2 Key Architectural Vulnerabilities & Inconsistencies Found

1. **Absence of Shared Central Identity**:
   - Only Post Service implemented a real password registration/login flow.
   - Post Service JWTs encoded `sub` as an email string, whereas E2EE Identity Service required `sub` to be a UUID.
   - Frontend relied on hardcoded demo identities (`alex_quant`, Alice, Bob).
2. **Orphaned Java Community Microservice**:
   - A fully built Spring Boot 3.3.4 microservice (`community-main/`) existed on disk but was completely absent from documentation, launch scripts, and frontend service calls (which were 100% mocked).
3. **Environment Drift in Post Service**:
   - `bcrypt 5.0.0` was installed in the environment despite `requirements.txt` pinning `bcrypt==4.0.1`, triggering a fatal `ValueError` crash inside `passlib 1.7.4`.
   - Post Service's `app/models/user.py` was defined as a Pydantic `BaseModel` rather than a SQLAlchemy ORM model, causing `/auth/register` to throw a 500 error when attempting `db.add(User(...))`.
4. **Windows NIO Loopback Socket Incompatibility**:
   - Modern JDKs (17, 21, 23) on Windows hardcode `preferAfUnix = true` in `WEPollSelectorImpl.java`, which fails to establish loopback socket connections natively on certain Windows configurations, preventing Spring Boot from launching outside Docker.

---

## 5. Complete Remediation & Development Log (Work Done Till Date)

### 5.1 Phase 1: Deep Diagnostic Audit
- Performed four parallel code audits across all microservices and frontend pages.
- Documented baseline test executions and compiled the authoritative `DIAGNOSIS.md`.

### 5.2 Phase 2: Central Authentication & Identity Engineering
- **Fixed Bcrypt Environment Conflict**: Aligned virtualenv dependency with `bcrypt==4.0.1`.
- **Created Real SQLAlchemy User Model**: Rewrote `post-service-feature-post-module/app/models/user.py` with `id` (UUID Primary Key), `username`, `email`, `hashed_password`, `created_at`.
- **Standardized JWT Subject to UUID**: Updated `POST /auth/login` to issue tokens with `sub: str(db_user.id)` (UUID).
- **Built Frontend Authentication Layer**:
  - `src/services/authService.js`: API bindings for `/auth/register` and `/auth/login`.
  - `src/context/AuthContext.jsx`: Global authentication provider maintaining active session token and user profile.
  - `src/pages/Login.jsx`: Responsive login and signup page.
  - `src/components/layout/RequireAuth.jsx`: Protected route guard redirecting unauthenticated traffic to `/login`.
  - `src/components/layout/TopAppBar.jsx`: Integrated dynamic user avatar and logout flow.

### 5.3 Phase 3: Frontend User Identity & Profile Wiring
- **Deterministic CRC32 Author ID Bridge**:
  - Created `src/utils/authorId.js` (JavaScript port of Python's `zlib.crc32` UUID→integer derivation) allowing the frontend to compute Post Service's numeric `author_id` synchronously from a UUID.
  - Verified bit-for-bit output between Python and JavaScript engines.
- **Dynamic User Profile & Feed**:
  - Rewrote `UserProfile.jsx` to load and filter posts dynamically for the logged-in user.
  - Removed artificial fabricated stats and badges, rendering real verified counts.
  - Updated `HomeFeed.jsx` story and post composer to dynamically attribute new posts to the authenticated user.
  - Resolved `localStorage` cache staleness by computing derived author IDs dynamically via `useMemo`.

### 5.4 Phase 4: Community Microservice Discovery, Dockerization & Frontend Integration
- **Identified & Diagnosed Native JDK NIO Windows Defect**: Proved `Selector.open()` platform limitation and containerized the service.
- **Containerized Spring Boot & PostgreSQL**:
  - Configured `community-main/docker-compose.yml` deploying Spring Boot 3.3.4 container alongside PostgreSQL 16 on port `8080`.
- **Built Frontend Community Integration**:
  - Created `src/services/communityService.js` mapping backend DTOs (`CommunityResponse`, `PageResponse<T>`) with `X-User-Id` header authentication.
  - Rewrote `src/pages/Communities.jsx` replacing 100% mock data with live CRUD calls: listing communities, joining/leaving groups, and creating new trading communities via an interactive modal.

### 5.5 Phase 5: Unified Multi-Service Orchestrator & CLI Tooling
- **Built `start_all.py` Orchestrator**:
  - Automated detection of Python virtualenvs, Node/npm binaries, and Docker daemons.
  - Real-time HTTP health probe polling with visual progress spinner.
  - Thread-safe, color-coded multiplexed console log aggregation.
  - CLI flags: `--windows` (`-w`), `--backend-only`, `--check-only`, `--kill-existing`.
- **Built `stop_all.py` Teardown Script**:
  - Graceful Docker container teardown (`docker compose down`) followed by selective Windows socket PID cleanup.
- **Created Cross-Platform Execution Wrappers**:
  - `start.bat`, `stop.bat` (Windows Command Prompt)
  - `start.ps1`, `stop.ps1` (PowerShell)

---

## 6. Complete API Reference Guide

### 6.1 News Service (Port 8000)
| Method | Endpoint | Description | Auth / Headers | Parameters / Body |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health probe | None | Returns `{"status": "healthy"}` |
| `GET` | `/news` | Paginated news feed | None | Query: `limit`, `offset`, `category`, `symbol` |
| `GET` | `/news/{news_id}` | Retrieve specific article | None | Path: `news_id` |
| `GET` | `/news/bookmarks` | List bookmarked articles | `X-User-Id: <id>` | Query: `limit`, `offset` |
| `POST` | `/news/bookmarks/{news_id}` | Bookmark an article | `X-User-Id: <id>` | Path: `news_id` |
| `DELETE`| `/news/bookmarks/{news_id}` | Remove bookmark | `X-User-Id: <id>` | Path: `news_id` |

### 6.2 Story Service (Port 8001)
| Method | Endpoint | Description | Auth / Headers | Parameters / Body |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health probe | None | Returns `{"status": "healthy"}` |
| `GET` | `/stories` | Active 24-hour stories feed | Optional Bearer | Returns list of unexpired stories |
| `POST` | `/stories` | Create a new story | Optional Bearer | Body: `{"media_url": "...", "caption": "..."}` |
| `POST` | `/stories/presign` | Generate S3 upload URL | Optional Bearer | Body: `{"filename": "...", "content_type": "..."}` |
| `POST` | `/stories/{id}/view` | Record story view | Optional Bearer | Path: `id` |
| `DELETE`| `/stories/{id}` | Delete a story | Optional Bearer | Path: `id` |

### 6.3 Chart Service (Port 8002)
| Method | Endpoint | Description | Auth / Headers | Parameters / Body |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health probe | None | Returns `{"status": "healthy"}` |
| `GET` | `/symbols` | List supported instruments | None | Query: `category` (stocks, crypto, forex, commodities) |
| `GET` | `/quote/{symbol}` | Real-time quote & price | None | Path: `symbol` (e.g. `AAPL`, `BTCUSD`) |
| `GET` | `/quotes` | Batch quote retrieval | None | Query: `symbols=AAPL,TSLA,BTCUSD` |
| `GET` | `/sparkline/{symbol}` | 7-day mini chart sparkline | None | Path: `symbol` |
| `GET` | `/history/{symbol}` | OHLCV historical candles | None | Query: `resolution`, `from`, `to` |

### 6.4 E2EE Identity Service (Port 8003)
| Method | Endpoint | Description | Auth / Headers | Parameters / Body |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health probe | None | Returns `{"status": "healthy"}` |
| `POST` | `/api/v1/devices/register` | Register device key bundle | Bearer JWT | Body: `{"device_id": "...", "ik": "...", "spk": "...", "opks": [...]}` |
| `GET` | `/api/v1/devices/{user_id}` | Fetch user device IDs | Bearer JWT | Path: `user_id` |
| `GET` | `/api/v1/keys/{user_id}/{device_id}` | Fetch X3DH prekey bundle | Bearer JWT | Atomically claims 1 OPK |
| `POST` | `/api/v1/keys/replenish` | Upload fresh OPKs | Bearer JWT | Body: `{"opks": [...]}` |
| `POST` | `/api/v1/messages/send` | Submit encrypted envelope | Bearer JWT | Body: `{"recipient_device_id": "...", "envelope": "..."}` |
| `GET` | `/api/v1/messages/inbox` | Pull queued envelopes | Bearer JWT | Query: `device_id` |
| `WS` | `/ws/v1/chat/{device_id}` | Real-time message stream | Bearer Token in Handshake | Live bidirectional push socket |

### 6.5 Post Service (Port 8004)
| Method | Endpoint | Description | Auth / Headers | Parameters / Body |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/health` | Service health probe | None | Returns `{"status": "healthy"}` |
| `POST` | `/auth/register` | Register new account | None | Body: `{"username": "...", "email": "...", "password": "..."}` |
| `POST` | `/auth/login` | Authenticate & get JWT | None | Body: `{"email": "...", "password": "..."}` |
| `GET` | `/api/v1/posts/` | Paginated social post feed | Optional Bearer | Query: `limit`, `offset`, `author_id`, `tag` |
| `POST` | `/api/v1/posts/` | Create a new post | Bearer JWT | Body: `{"content": "...", "media_urls": [...]}` |
| `GET` | `/api/v1/posts/{id}` | Retrieve single post | Optional Bearer | Path: `id` |
| `DELETE`| `/api/v1/posts/{id}` | Delete own post | Bearer JWT | Path: `id` |
| `POST` | `/api/v1/posts/{id}/comments` | Add comment to post | Bearer JWT | Body: `{"content": "...", "parent_id": null}` |
| `POST` | `/api/v1/posts/{id}/like` | Toggle post like | Bearer JWT | Path: `id` |
| `POST` | `/api/v1/posts/{id}/bookmark` | Toggle post bookmark | Bearer JWT | Path: `id` |
| `POST` | `/api/v1/media/upload` | Upload media attachment | Bearer JWT | Form: `multipart/form-data` |

### 6.6 Community Service (Port 8080)
| Method | Endpoint | Description | Auth / Headers | Parameters / Body |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service health probe | None | Returns `{"status": "UP"}` |
| `GET` | `/api/v1/communities` | List communities | `X-User-Id: <id>` | Query: `page`, `size`, `sort` |
| `POST` | `/api/v1/communities` | Create new community | `X-User-Id: <id>` | Body: `{"name": "...", "description": "...", "rules": "..."}` |
| `GET` | `/api/v1/communities/{id}` | Get community details | `X-User-Id: <id>` | Path: `id` |
| `POST` | `/api/v1/communities/{id}/join` | Join community group | `X-User-Id: <id>` | Path: `id` |
| `DELETE`| `/api/v1/communities/{id}/join` | Leave community group | `X-User-Id: <id>` | Path: `id` |
| `GET` | `/api/v1/communities/{id}/posts` | Community post feed | `X-User-Id: <id>` | Path: `id`, Query: `page`, `size` |
| `POST` | `/api/v1/communities/{id}/posts` | Create trading post | `X-User-Id: <id>` | Body: `{"title": "...", "content": "...", "symbol": "...", "entryPrice": ...}` |

---

## 7. Frontend Architecture, Pages & State Management

```
+-------------------------------------------------------------------------------+
|                             REACT COMPONENT TREE                              |
+-------------------------------------------------------------------------------+
                                    [App.jsx]
                                        |
                            +-----------+-----------+
                            |     (AuthProvider)    |
                            +-----------+-----------+
                                        |
                          +-------------+-------------+
                          |   (BrowserRouter / Routes)|
                          +-------------+-------------+
                                        |
                  +---------------------+---------------------+
                  |                                           |
             [/login]                                   (RequireAuth)
            [Login.jsx]                                       |
                                        +---------------------+---------------------+
                                        |                                           |
                                [TopAppBar.jsx]                             [NavigationRail]
                                        |
    +---------------+---------------+---+-----------+---------------+---------------+
    |               |               |               |               |               |
[HomeFeed]    [UserProfile]      [Chats]     [MarketCharts]   [MarketNews]    [Communities]
    |               |               |               |               |               |
(PostService) (PostService)    (E2EContext)   (ChartService)  (NewsService)   (CommunityService)
(StoryService)(authorId.js)   (IndexedDB)     (TradingView)   (Bookmarks)     (Docker/REST)
```

### Page Breakdown
1. **`HomeFeed.jsx`**: Main social dashboard featuring stories carousel, interactive post composer with image uploading, live posts stream, and market summary widget.
2. **`UserProfile.jsx`**: Personal profile exhibiting user identity, dynamic tabbed post history, saved bookmarks, and media gallery.
3. **`Chats.jsx`**: Real-time End-to-End Encrypted chat terminal with cryptographic identity verification, key generation, and WebSocket status indicator.
4. **`MarketCharts.jsx` & `StockChart.jsx`**: Live multi-asset quote board with sparklines, interactive search, and embedded TradingView charting canvas.
5. **`MarketNews.jsx`**: Real-time financial news stream with category filtering, sentiment tags, and article bookmarking.
6. **`Communities.jsx`**: Community groups dashboard with "Discover" and "My Groups" tabs, member counts, join/leave controls, and community creation modal.
7. **`ExploreSearch.jsx`**: Search terminal across traders, tickers, and trending hashtags.
8. **`Settings.jsx` & `SettingsDetail.jsx`**: Preferences management covering Security, E2EE Keys, Notifications, and Display Settings.
9. **`Login.jsx`**: Authentication portal with instant toggling between Login and Signup modes.

---

## 8. How to Run, Test & Operate the Platform

### 8.1 System Prerequisites
- **Python**: Version 3.10+ (virtualenv located in `./venv`)
- **Node.js**: Version 18+ & npm
- **Docker Desktop**: Required for running the Java Community Service & PostgreSQL container

### 8.2 One-Command Quick Start
From the project root directory:

```cmd
:: Windows Command Prompt
start.bat
```

```powershell
# Windows PowerShell
.\start.ps1
```

```bash
# Cross-Platform Python CLI
python start_all.py
```

### 8.3 CLI Startup Options
- `python start_all.py -w` (or `--windows`): Launches each microservice in its own dedicated, titled terminal window.
- `python start_all.py --backend-only`: Starts only the 6 backend microservices (skipping Vite frontend).
- `python start_all.py --check-only`: Verifies environment prerequisites, virtualenvs, Node binaries, and port availability.
- `python start_all.py --kill-existing`: Automatically terminates any zombie processes occupying ports 8000–8004, 8080, 5173 before boot.

### 8.4 Stopping the Platform
To safely shut down all services, tear down Docker containers, and release all network ports:

```cmd
stop.bat
```
*(or `.\stop.ps1` / `python stop_all.py`)*

### 8.5 Automated Test Execution
Run test suites across the individual services:

```bash
# Python Microservices Unit & Security Tests
.\venv\Scripts\python.exe -m pytest news-service/
.\venv\Scripts\python.exe -m pytest story-service/
.\venv\Scripts\python.exe -m pytest chart-service/
.\venv\Scripts\python.exe -m pytest E2E-main/
.\venv\Scripts\python.exe -m pytest post-service-feature-post-module/

# Java Community Service Tests (Maven)
cd community-main && mvn test

# Frontend Production Build Test
cd talktrading-frontend && npm run build
```

---

## 9. Prioritized Punch List & Production Roadmap

### Status Tracking

| Priority | Item | Description | Status |
| :---: | :--- | :--- | :---: |
| **P0** | **Version Control** | Initialize repository Git tracking and standard `.gitignore` | Pending |
| **P0** | **Central Identity Phase 1** | Implement UUID-based User authentication model & JWT login | **COMPLETED** |
| **P1** | **Community Service Integration** | Containerize Java microservice and wire frontend `Communities.jsx` | **COMPLETED** |
| **P1** | **Dynamic User Profile & Feed** | Wire authenticated user into feed, post composer, and profile | **COMPLETED** |
| **P1** | **AWS S3 Storage Credentials** | Configure IAM credentials for Story Service S3 presign uploads | Planned |
| **P1** | **Automated Ingestion Schedulers** | Schedule News ingestion (`ingestion.py`) and Story expiration cleanup | Planned |
| **P2** | **Code Cleanup** | Remove dead route imports in Post Service and clean root `.zip` archives | Planned |
| **P2** | **Double Ratchet Protocol** | Upgrade X3DH E2EE sessions with per-message Diffie-Hellman ratcheting | Planned |
| **P3** | **Frontend Automated Tests** | Introduce Vitest / React Testing Library suite for `talktrading-frontend` | Planned |

---
*End of Master System Documentation.*
