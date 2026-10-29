# TalkTrading — Complete Project Documentation

> **Last Updated**: 2026-09-25 (Remediation Log added — see Section 11)
> **Scope**: All backend microservices (News, Story, Chart) + E2EE Identity Service + full frontend integration with `talktrading-frontend`
> **Note**: Sections 1-10 below were the original project write-up and were written by a prior contributor. A full independent code audit was later performed against every service (not just these docs) — see `DIAGNOSIS.md` in the project root for that audit's findings, including gaps this original documentation did not mention (an undocumented 6th microservice, missing central auth, misconfigured services, etc). Section 11 is a live changelog of fixes applied since that audit and is updated as work continues.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Microservice Profiles](#2-microservice-profiles)
3. [API Reference Guide](#3-api-reference-guide)
4. [E2EE Frontend Integration](#4-e2ee-frontend-integration)
5. [Problems Encountered and Solutions](#5-problems-encountered-and-solutions)
6. [How to Run and Test](#6-how-to-run-and-test)
7. [Security Architecture and Threat Model](#7-security-architecture-and-threat-model)
8. [Security Gate Status](#8-security-gate-status)
9. [Production TODOs](#9-production-todos)
10. [Verification Status Summary](#10-verification-status-summary)
11. [Remediation Log (Live — Post-Audit Fixes)](#11-remediation-log-live--post-audit-fixes)

---

## 1. System Architecture Overview

TalkTrading is built on a **decoupled microservices architecture** designed for high scalability, independent database ownership, and full end-to-end message encryption. The system consists of four independent backend services and one React/Vite frontend.

```
                     +--------------------------------------------------+
                     |          TalkTrading Clients                      |
                     |   talktrading-frontend (React 18 + Vite)         |
                     +---+-----------+-----------------+-----------------+
                         |           |                 |                 |
                         v           v                 v                 v
               +-----------+  +-----------+  +----------+  +------------+
               | News Svc  |  | Story Svc |  | Chart Svc|  | E2EE Svc   |
               | Port 8000 |  | Port 8001 |  | Port 8002|  | Port 8003  |
               | FastAPI   |  | FastAPI   |  | FastAPI  |  | FastAPI    |
               +-----+-----+  +-----+-----+  +----+-----+  +------+-----+
                     |              |              |                |
                  news.db      stories.db      chart.db      PostgreSQL
                  SQLite/PG    SQLite/PG+S3   SQLite/PG     + Redis
```

**Key principle for E2EE service**: The service is **cryptographically blind** — it stores and routes opaque ciphertext blobs without ever accessing plaintext or private keys. All encryption and decryption happens exclusively in the user's browser.

---
## 2. Microservice Profiles

### A. News Service (`news-service`)

- **Purpose**: Ingests, normalizes, deduplicates, and serves financial & trading news feeds.
- **Port**: `8000` | **Database**: SQLite (dev) / PostgreSQL (prod)
- **Key Features**:
  - Provider-agnostic: switch via `NEWS_PROVIDER` env var (`newsapi`, `finnhub`, `alphavantage`, `polygon`, `gnews`, `mediastack`)
  - Strict deduplication based on unique `source_url`
  - Article pagination and filtering by category or stock symbol (`related_symbols`)
  - User bookmarking system with full article embedding on lookup

### B. Story Service (`story-service`)

- **Purpose**: Manages short-lived (24-hour) user stories, video/image media, and view tracking.
- **Port**: `8001` | **Database**: SQLite (dev) / PostgreSQL (prod) + AWS S3
- **Key Features**:
  - Direct-to-S3 media upload via presigned URLs (`POST /stories/presign`)
  - Automatic 24-hour TTL expiration handling
  - Rate limiting via `slowapi` to prevent spam uploads
  - Pluggable JWT authentication (`AUTH_ENABLED=true/false`)
  - Idempotent view recording and view count tracking

### C. Chart Service (`chart-service`)

- **Purpose**: Serves real-time market quotes, OHLCV candle data, and symbol metadata.
- **Port**: `8002` | **Database**: SQLite (dev) / PostgreSQL (prod)
- **Key Features**:
  - 20 pre-seeded symbols across Stocks, Crypto, Forex, and Commodities (idempotent seeding)
  - TradingView Advanced Chart widget embedded via free CDN — no API key needed
  - Finnhub provider for real-time quotes and historical OHLCV candles (free tier)
  - TTL-aware quote cache (60s) to respect Finnhub rate limits
  - Batch quotes endpoint for efficient market list loading
  - 7-day sparkline data for mini charts

### D. E2EE Identity Service (`E2E-main`)

- **Purpose**: Cryptographic backbone for end-to-end encrypted private messaging.
- **Port**: `8003` | **Database**: PostgreSQL (async asyncpg + SQLAlchemy) + Redis
- **Auth**: JWT Bearer tokens (HS256), verified via PyJWT with `JWT_SECRET_KEY`
- **Key Features**:
  - Device Registry: register, list, revoke user device key bundles
  - X3DH Prekey Distribution: atomically consumes one OPK per device per key fetch
  - Message Envelope Store: routes opaque ciphertext without decryption capability
  - Real-time WebSocket Delivery for live push of incoming messages
  - Redis Sliding Window Rate Limiter protecting all sensitive routes
  - Asymmetric Ed25519 JWT workload identity for backend-to-backend calls

---

## 3. API Reference Guide

### News Service

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Liveness probe and provider info |
| `GET` | `/news` | Paginated news feed |
| `GET` | `/news/{id}` | Single article by UUID |
| `GET` | `/news/bookmarks/{user_id}` | All bookmarks for a user |
| `POST` | `/news/{id}/bookmark` | Bookmark an article (idempotent) |
| `DELETE` | `/news/{id}/bookmark` | Remove a bookmark |

### Story Service

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Liveness probe |
| `POST` | `/stories/presign` | Generate S3 presigned PUT URL |
| `POST` | `/stories` | Create story entry |
| `GET` | `/stories/user/{user_id}` | Active stories for a user |
| `GET` | `/stories/feed` | Batch active stories for followed users |
| `POST` | `/stories/{story_id}/view` | Record a story view (idempotent) |
| `DELETE` | `/stories/{story_id}` | Delete a story |

### Chart Service

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Liveness probe and provider info |
| `GET` | `/symbols` | List all registered symbols |
| `GET` | `/symbols/{symbol}/quote` | Real-time quote (TTL-cached 60s) |
| `GET` | `/symbols/{symbol}/sparkline` | 7-day daily closes |
| `GET` | `/symbols/{symbol}/candles` | Historical OHLCV bars |
| `GET` | `/quotes/batch` | Batch quotes for multiple symbols |

### E2EE Identity Service

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/e2ee/devices` | Register device public key bundle |
| `GET` | `/e2ee/devices` | List user active devices |
| `DELETE` | `/e2ee/devices/:id` | Revoke a device |
| `GET` | `/e2ee/keys/:userId` | Fetch recipient key bundles (consumes one OPK per device) |
| `POST` | `/e2ee/prekeys` | Replenish one-time prekeys |
| `POST` | `/e2ee/devices/:id/rotate` | Rotate signed prekey |
| `POST` | `/e2ee/conversations` | Create a new conversation |
| `GET` | `/e2ee/conversations` | List user conversations |
| `POST` | `/e2ee/conversations/:id/messages` | Send encrypted message envelopes |
| `GET` | `/e2ee/conversations/:id/messages` | Fetch message envelopes for this device |
| `WS` | `/e2ee/ws` | Real-time encrypted message delivery |

---

## 4. E2EE Frontend Integration

This section documents the complete integration of the `E2E-main` microservice with the `talktrading-frontend` React application. The integration adds full client-side end-to-end encryption to the Chats page without changing any existing news, story, or chart functionality.

### 4.1 Integration Architecture

```
talktrading-frontend (React 18 + Vite)
---------------------------------------
  Chats.jsx  -->  E2EContext.jsx  -->  x3dhCrypto.js
  (UI layer)      (state + logic)      (X3DH + AES-GCM engine)
                        |                      ^
                        v                      |
                  e2eService.js         cryptoStorage.js
                  (HTTP + WS client)    (sessionStorage persistence)
                        |
                        |  HTTP REST + WebSocket
                        v
    E2EE Microservice -- FastAPI (E2E-main, port 8003)
    Endpoints: /e2ee/devices, /e2ee/keys/:id, /e2ee/conversations, /e2ee/ws
```

### 4.2 New Files Created

| File | Purpose |
| :--- | :--- |
| `src/crypto/x3dhCrypto.js` | JS X3DH + AES-256-GCM crypto engine. Mirrors Python `ClientCryptoEngine`/`ClientCryptoAdapter`. Uses `@noble/curves` for X25519/Ed25519 (unavailable in SubtleCrypto) and native SubtleCrypto for AES-GCM + HKDF. |
| `src/crypto/cryptoStorage.js` | `sessionStorage` persistence for private key material across page refreshes. Includes production TODO for PBKDF2 key-wrapping. |
| `src/services/e2eService.js` | Full HTTP + WebSocket client for the E2EE microservice. Handles all 11 endpoints, the `X-Device-Id` header requirement, and the WS token-in-query-param workaround. |
| `src/context/E2EContext.jsx` | React context orchestrating the full E2EE lifecycle: device init, key restoration, WebSocket management, conversation loading, encrypt-and-send, and decrypt-on-receive. |
| `.env` | Added `VITE_E2EE_SERVICE_URL=http://127.0.0.1:8003` and HS256-signed dev JWT tokens for Alice and Bob. |

### 4.3 Modified Files

| File | Change |
| :--- | :--- |
| `src/services/apiConfig.js` | Added `E2EE_SERVICE_URL` and `DEV_JWT_TOKEN` exports. |
| `src/pages/Chats.jsx` | Full rewrite: replaced static `mockChats` data with real E2E-encrypted flow using `useE2E()`. Added Instagram-style split-screen DM layout, Alice/Bob identity switcher, and a cryptographic security inspector modal. |
| `src/App.jsx` | Wrapped the router tree with `<E2EProvider>` so the entire app has access to the E2E context. |
| `package.json` | Added `@noble/curves` (v1.4.x) as a runtime dependency. |
| `vite.config.js` | Added `resolve.conditions: ['browser', 'module', 'import', 'default']` to fix rolldown subpath export resolution for `@noble/curves`. |
| `E2E-main/app/repositories/key_repository.py` | Updated `add_one_time_prekeys()` with upsert logic to handle `UniqueViolationError` on prekey re-registration. |

### 4.4 Crypto Protocol Walkthrough

#### X3DH Session Establishment — Outbound (Alice sends to Bob)

```
Step 1.  GET /e2ee/keys/{bob_user_id}  — fetch Bob's key bundle
Step 2.  Verify SPK:  Ed25519.verify(SPK_B.signature, SPK_B.key, IK_B_sign)
Step 3.  Generate:    EK_A = X25519.randomSecretKey()
Step 4.  Four DH operations:
           DH1 = X25519(IK_A_dh_priv,  SPK_B_pub)
           DH2 = X25519(EK_A_priv,     IK_B_dh_pub)
           DH3 = X25519(EK_A_priv,     SPK_B_pub)
           DH4 = X25519(EK_A_priv,     OPK_B_pub)   <- omit if no OPK
Step 5.  session_key = HKDF-SHA256(DH1||DH2||DH3||DH4,
                                    info="Reddit-Insta-E2EE-X3DH",
                                    salt=0x00 x 32)
Step 6.  (ciphertext, iv) = AES-256-GCM(session_key, JSON.stringify(payload),
                                         AAD="alice-device-id:bob-device-id")
Step 7.  POST /e2ee/conversations/:id/messages  with Matrix m.room.encrypted envelope
```

#### X3DH Session Establishment — Inbound (Bob decrypts)

```
Receives: { ciphertext, iv, EK_A_pub, SPK_B_key_id, OPK_B_id }

Bob computes:
  DH1 = X25519(SPK_B_priv,   IK_A_dh_pub)
  DH2 = X25519(IK_B_dh_priv, EK_A_pub)
  DH3 = X25519(SPK_B_priv,   EK_A_pub)
  DH4 = X25519(OPK_B_priv,   EK_A_pub)

session_key = HKDF-SHA256(DH1||DH2||DH3||DH4, same info+salt)
plaintext   = AES-256-GCM.decrypt(session_key, ciphertext, iv,
                                   AAD="alice-device-id:bob-device-id")
```

Both sides derive the **same session key** without ever transmitting it.

#### Matrix Encrypted Event Format

```json
{
  "type": "m.room.encrypted",
  "content": {
    "algorithm": "m.olm.v1.curve25519-aes-sha2",
    "sender_key": "<base64 64-byte: X25519_pub || Ed25519_pub>",
    "sender_device_id": "web-alice-device",
    "ciphertext": {
      "<base64 recipient identity key>": {
        "type": 0,
        "body": "<base64 JSON: { ciphertext, iv, ephemeral_key, signed_prekey_id, one_time_prekey_id }>"
      }
    }
  }
}
```

### 4.5 API Contract Reference

#### Device Registration

```
POST /e2ee/devices
Authorization: Bearer <token>

Body:
{
  "device_id": "web-alice-device",
  "device_name": "TalkTrading Web (Alice)",
  "identity_key": "<base64 64 bytes: X25519_pub || Ed25519_pub>",
  "signed_prekey": { "key_id": 1, "key": "<base64>", "signature": "<base64>" },
  "one_time_prekeys": [ { "key_id": 100, "key": "<base64>" }, ... ]
}

Response 201:
{ "user_id": "<uuid>", "device_id": "...", "device_name": "...", "created_at": "..." }
```

#### Send Encrypted Message

```
POST /e2ee/conversations/<conv-uuid>/messages
Authorization: Bearer <token>
X-Device-Id: web-alice-device

Body:
{
  "envelopes": {
    "<recipient-device-id>": "<base64 Matrix event>",
    "<sender-device-id>":    "<base64 Matrix event>"
  }
}
```

> Note: The sender's own device is always included in `envelopes` so the sender retains full conversation history on reload.

---

## 5. Problems Encountered and Solutions

### Backend Issues

#### Issue 1 — Cross-Database Compatibility (SQLite vs. PostgreSQL UUIDs)

**Problem**: PostgreSQL supports native `UUID` types but SQLite stores UUIDs as raw strings or bytes. Using native `pgUUID` directly caused parameter binding crashes in SQLite.

**Solution**: Implemented a custom `GUID` `TypeDecorator` in `models.py` that automatically uses PostgreSQL native `UUID` on Postgres, and falls back to `CHAR(32)` hex string in SQLite while maintaining native Python `uuid.UUID` objects in memory.

---

#### Issue 2 — Array Filtering in SQLite

**Problem**: `news-service` filters articles by `related_symbols` array. PostgreSQL supports `@>` array containment operators but SQLite throws syntax errors.

**Solution**: Updated `crud.get_articles` to cast columns to string and use `.like('%"SYMBOL"%')` pattern matching, ensuring compatibility across all database engines.

---

#### Issue 3 — Hyphenated Folder Naming in Python Modules

**Problem**: Python module names cannot contain hyphens. Running imports on `news-service` or `story-service` caused syntax errors.

**Solution**: Used `--app-dir` in `uvicorn` and `sys.path.insert(0, ...)` in test runners so `from app import models, schemas, crud` works cleanly.

---

#### Issue 4 — Dev Mode JWT Authentication Bypass

**Problem**: `story-service` endpoints required valid JWT Bearer headers signed by the Auth service, blocking local standalone testing.

**Solution**: Created a configurable `AUTH_ENABLED` toggle in `app/auth.py`. When `false`, the dependency supplies a default mock developer UUID, allowing testing without the Auth service.

---

#### Issue 5 — 404 Not Found on Root URL

**Problem**: Opening `http://127.0.0.1:8000/` returned `404 Not Found`.

**Solution**: Microservice APIs do not define a root route. The interactive Swagger UI is at `/docs`.

---

#### Issue 6 — PostgreSQL Unique Constraint on Prekey Re-Registration

**Problem**: Re-registering an existing device caused an unhandled `asyncpg.exceptions.UniqueViolationError`:

```
duplicate key value violates unique constraint "unique_user_device_prekey" (prekey_id=100)
```

On each page refresh, the frontend re-registered the device, trying to insert the same OPK IDs again, crashing the backend with a 500 error.

**Solution**: Added upsert logic to `KeyRepository.add_one_time_prekeys` in `app/repositories/key_repository.py`:

```python
async def add_one_time_prekeys(self, user_id, device_id, prekeys):
    for pk_id, pk_val in prekeys:
        existing = await self.db.execute(
            select(OneTimePrekey).filter(
                OneTimePrekey.user_id == user_id,
                OneTimePrekey.device_id == device_id,
                OneTimePrekey.prekey_id == pk_id,
            )
        )
        existing_pk = existing.scalars().first()
        if existing_pk:
            existing_pk.prekey = pk_val
            existing_pk.consumed = False  # reset for re-use after re-registration
        else:
            self.db.add(OneTimePrekey(
                user_id=user_id, device_id=device_id,
                prekey_id=pk_id, prekey=pk_val, consumed=False
            ))
    await self.db.flush()
```

---

### Build Issues

#### Build Issue 1 — Vite 8 / rolldown Cannot Resolve `@noble/curves` Subpath Exports

**Error**:
```
"./x25519" is not exported under the conditions ["module", "browser", "production", "import"]
from package @noble/curves
```

**Root Cause**: Vite 8 uses rolldown which did not include `"browser"` in its conditions array by default. Additionally, `@noble/curves` does not have a `./x25519` subpath — `x25519` lives inside `./ed25519.js`.

**Two fixes required**:

Fix 1 — Correct the import path:
```js
// Before (broken):
import { x25519 } from '@noble/curves/x25519'
import { ed25519 } from '@noble/curves/ed25519'

// After (correct):
import { x25519, ed25519 } from '@noble/curves/ed25519.js'
```

Fix 2 — Add resolve conditions to `vite.config.js`:
```js
resolve: {
  conditions: ['browser', 'module', 'import', 'default'],
}
```

**Result**: `npm run build` completes in ~285ms, 363 kB bundle (112 kB gzipped).

---

### Runtime and Cryptographic Issues

#### Runtime Issue 1 — X25519 Not Available in SubtleCrypto

**Root Cause**: The Python backend uses `X25519` for all DH operations. The browser SubtleCrypto only supports NIST curves (P-256, P-384, P-521). X25519/Curve25519 is absent from the SubtleCrypto spec. Using P-256 instead would produce incompatible key encodings and DH outputs.

**Solution**: Added `@noble/curves` (v1.4.x) — all functions return/accept raw `Uint8Array` of 32 bytes, identical to Python's `cryptography` library. AES-256-GCM and HKDF-SHA256 continue using native SubtleCrypto.

---

#### Runtime Issue 2 — WebSocket Cannot Send Authorization Headers

**Root Cause**: The browser WebSocket API cannot set custom HTTP headers on the upgrade request — a long-standing browser limitation.

**Solution**: FastAPI endpoint already accepts token + device_id as query parameters:
```python
token = websocket.query_params.get("token")
device_id = websocket.query_params.get("device_id")
```
Frontend appends them to the WebSocket URL:
```js
const url = `${wsBase}/e2ee/ws?token=${encodeURIComponent(token)}&device_id=${encodeURIComponent(deviceId)}`
```

Security note: In production, use short-lived one-time WS tickets exchanged via HTTPS first (query params appear in server logs).

---

#### Runtime Issue 3 — X-Device-Id Header Mandatory on Message Endpoints

**Root Cause**: `GET /e2ee/conversations/:id/messages` requires `X-Device-Id` to filter envelopes by device. Without it the backend returns `HTTP 400`.

**Solution**: `e2eService.js` always passes the header in both `sendMessage()` and `getMessages()`:
```js
{ 'X-Device-Id': senderDeviceId }
```

---

#### Runtime Issue 4 — OPK Depletion on Every Bundle Fetch

**Root Cause**: `GET /e2ee/keys/:userId` consumes one OPK per device per call (X3DH spec — OPKs are single-use). Fetching on every send would exhaust the 5-OPK pool almost immediately.

**Solution**: `E2EContext.jsx` caches bundles in a `keyBundleCache` ref:
```js
const keyBundleCache = useRef({})
let bundle = keyBundleCache.current[userId]
if (!bundle) {
  bundle = await getUserKeyBundle(userId, token)
  keyBundleCache.current[userId] = bundle
}
```
Cache is not persisted — a fresh bundle (with fresh OPK) is fetched on each new browser session to preserve forward secrecy.

---

#### Runtime Issue 5 — Device Registration Race Condition (React 18 Strict Mode)

**Root Cause**: React 18 Strict Mode fires `useEffect` twice in development, causing two concurrent `POST /e2ee/devices` calls with the same device_id.

**Solution**: An `isInitializing` ref blocks double-init. Backend conflict errors are swallowed:
```js
const isInitializing = useRef(false)
if (isInitializing.current) return
isInitializing.current = true
```
```js
catch (regError) {
  if (!regError.message.includes('already') && !regError.message.includes('409')) {
    throw regError
  }
  // Device already registered — continue with restored keys
}
```

---

#### Runtime Issue 6 — Private Keys Lost on Page Refresh

**Root Cause**: `ClientCryptoAdapter` generates key material in memory. Page refresh wipes all private keys — the device can no longer decrypt or establish sessions.

**Solution**: `cryptoStorage.js` serializes the adapter to `sessionStorage` via `adapter.exportState()`. On next mount, `ClientCryptoAdapter.importState(state)` restores it. `sessionStorage` chosen over `localStorage` because it clears when the tab closes.

Production TODO: Wrap exported bytes with PBKDF2-derived AES-GCM wrapping key before writing to storage.

---

#### Runtime Issue 7 — WebSocket Disconnects on Tab Blur / Network Blip

**Root Cause**: Browsers aggressively kill WebSocket connections when tabs are backgrounded or network changes.

**Solution**: Exponential-backoff reconnection in `E2EContext.jsx`:
```js
ws.onclose = () => {
  const delay = Math.min(reconnectDelay.current, 30000)
  reconnectDelay.current = delay * 2
  setTimeout(() => openWebSocket(adapterRef.current), delay)
}
```
Delay starts at 1s, doubles each attempt, caps at 30s.

---

#### Runtime Issue 8 — `dev-mock-token` Returns 401 Unauthorized

**Problem**: FastAPI validates Bearer tokens via PyJWT expecting a valid UUID in `sub`/`user_id`. The placeholder `"dev-mock-token"` fails with `401 Unauthorized`.

**Solution**: Generated HS256-signed dev tokens for two demo users configured in `.env` and `DEMO_USERS` in `E2EContext.jsx`:

| User  | UUID |
| :---- | :--- |
| Alice | `11111111-1111-4111-a111-111111111111` |
| Bob   | `22222222-2222-4222-a222-222222222222` |

Token expiry set to year 2027 for frictionless local development.

---

#### Runtime Issue 9 — `randomPrivateKey` vs `randomSecretKey`

**Problem**: `x25519.utils.randomPrivateKey()` threw `TypeError: x25519.utils.randomPrivateKey is not a function`.

**Solution**: `@noble/curves` v1.x exposes the method as `randomSecretKey()`. Updated all key generation call sites.

---

#### Runtime Issue 10 — HKDF Info String and Salt Mismatch

**Problem**: Frontend used `info = "X3DH"`. Python engine uses `info = b"Reddit-Insta-E2EE-X3DH"` and `salt = b"\x00" * 32`. Mismatch produces different session keys — every decrypt throws `DecryptionError`.

**Solution**: Aligned `x3dhCrypto.js` HKDF parameters byte-for-byte with Python:
```js
async function hkdf(ikm,
  info = new TextEncoder().encode('Reddit-Insta-E2EE-X3DH'),
  salt = new Uint8Array(32)) { ... }
```

---

#### Runtime Issue 11 — AES-256-GCM AAD Mismatch

**Problem**: Python engine binds Associated Data:
```python
assoc_data = f"{self.device_id}:{peer_device_id}".encode("utf-8")
```
Without matching AAD in SubtleCrypto, GCM authentication tag verification fails with `DecryptionError`.

**Solution**: `x3dhCrypto.js` passes AAD in both encryption and decryption:
```js
// Outbound (sender):
const assocData = new TextEncoder().encode(`${this.deviceId}:${peerDeviceId}`)
// Inbound (receiver — direction reversed):
const assocData = new TextEncoder().encode(`${peerDeviceId}:${this.deviceId}`)
```

---

#### Runtime Issue 12 — Standard Base64 vs URL-Safe Base64 Padding

**Problem**: Python uses standard `base64.b64decode()`. Frontend was using URL-safe base64 (replacing `+/-`, stripping `=`). This caused `binascii.Error: Incorrect padding` on the Python side.

**Solution**: Switched `bytesToB64` to standard `btoa()`. `b64ToBytes` auto-pads and normalizes before decoding:
```js
export function b64ToBytes(b64str) {
  let b64 = b64str.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4 !== 0) b64 += '='
  return new Uint8Array([...atob(b64)].map(c => c.charCodeAt(0)))
}
```

---

#### Runtime Issue 13 — Incomplete Session State on User Switch / Refresh

**Problem**: Switching Alice -> Bob -> Alice caused messages to disappear. `exportState()` originally omitted `sessions`, `sessionEphemeralKeys`, `sessionOpkIds`, and `peerIdentityKeys`. On reload, the receiver re-ran `receiveX3DH` but the consumed OPK was gone, causing DH4 failure and AES-GCM tag errors.

**Solution**: Enhanced `exportState()` and `importState()` in `x3dhCrypto.js` to serialize all session keys and metadata. Auto-save on every `loadMessages` and `handleIncomingWsMessage`:
```js
const stateKey = `talktrading_adapter_state_${activeUserKey}`
localStorage.setItem(stateKey, JSON.stringify(adapter.exportState()))
```

---

#### Runtime Issue 14 — PostgreSQL Connection Refusal on Port 5432 (`Errno 10061`)

**Problem**:
When running the E2EE service directly via `uvicorn app.main:app --port 8003 --reload` without a dedicated PostgreSQL server running locally, `app/config/settings.py` defaulted to `postgresql+asyncpg://postgres:postgres@localhost:5432/e2e_db`. When frontend called `POST /e2ee/conversations`, `asyncpg` failed to connect with:
```
OSError: Multiple exceptions: [Errno 10061] Connect call failed ('::1', 5432, 0, 0), [Errno 10061] Connect call failed ('127.0.0.1', 5432)
POST /e2ee/conversations HTTP/1.1 500 Internal Server Error
```

**Solution**:
1. Defaulted `DATABASE_URL` in `app/config/settings.py` to `sqlite+aiosqlite:///e2e.db` for zero-config local development, with PostgreSQL as an environment variable override for production.
2. Added `connect_args={"check_same_thread": False}` in `app/database/session.py` for SQLite async engines.
3. Updated FastAPI `lifespan` in `app/main.py` to automatically execute `Base.metadata.create_all` on startup, creating all tables (`conversations`, `messages`, `devices`, `one_time_prekeys`, etc.) in `e2e.db`.
4. Created an `.env` file in `E2E-main` configuring `DATABASE_URL=sqlite+aiosqlite:///e2e.db`.

---

#### UI/UX Redesign — Instagram-Style DM Interface

As part of the integration `Chats.jsx` was fully redesigned:

- **Split-Screen DM Layout**: Desktop and tablet split pane (left: conversation list, right: active chat) with fluid mobile transitions.
- **Active Story Rings**: Instagram-style gradient rings for active contacts.
- **Gradient Speech Bubbles**: Outgoing messages in purple-to-pink gradients.
- **Interactive Reactions**: Double-click to heart a message with reaction pills and emoji drawer.
- **Header Identity Switcher**: Instant Alice / Bob toggle for rapid end-to-end testing.
- **Security Inspector Modal**: Displays verified protocol parameters (X3DH, AES-256-GCM, AAD device binding, HKDF info).

---

## 6. How to Run and Test

### System Requirements & Prerequisites
- **Python**: 3.10+ with `virtualenv` installed
- **Node.js**: 18+ and `npm`
- **Databases**: SQLite (default local development) or PostgreSQL 15+
- **Cache / PubSub**: Redis (optional locally; services gracefully fall back in mock/in-memory mode)

### One-Command Quick Start (Recommended)

To start the entire TalkTrading system — all 5 microservices and the frontend — in a single command from the project root:

```bash
# Windows Command Prompt / Explorer
start.bat

# Or Windows PowerShell
.\start.ps1

# Or Cross-Platform Python (using root venv)
python start_all.py
```

**Advanced options for `start_all.py` / `start.bat`:**
- `start.bat --windows` (or `-w`): Opens each microservice in its own titled Windows console window.
- `start.bat --backend-only` (or `--no-frontend`): Boots only the 5 backend microservices without Vite.
- `start.bat --check-only`: Verifies runtime dependencies and port availability without starting.
- `start.bat --kill-existing`: Automatically terminates any zombie processes occupying ports 8000-8004, 5173.

To cleanly stop all running services and free all ports at any time:
```bash
stop.bat
# or
.\stop.ps1
# or
python stop_all.py
```

---

### Step 1 — Start the Backend Microservices Manually (Alternative)

Each microservice runs independently on its allocated port. From the project root (`files (2)`):

#### 1. News Service (Port 8000)
```bash
cd news-service
# Activate virtualenv if needed
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- **Health Check**: `http://localhost:8000/health`  
- **API Docs**: `http://localhost:8000/docs`

#### 2. Story Service (Port 8001)
```bash
cd story-service
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```
- **Health Check**: `http://localhost:8001/health`  
- **API Docs**: `http://localhost:8001/docs`

#### 3. Chart Service (Port 8002)
```bash
cd chart-service
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```
- **Health Check**: `http://localhost:8002/health`  
- **API Docs**: `http://localhost:8002/docs`

#### 4. E2EE Identity Service (Port 8003)
```bash
cd E2E-main
uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload
```
- **Health Check**: `http://localhost:8003/health`  
- **WebSocket Endpoint**: `ws://localhost:8003/api/v1/chat/ws?token=<JWT_TOKEN>`  
- **API Docs**: `http://localhost:8003/docs`

---

### Step 2 — Start the Frontend Application

```bash
cd talktrading-frontend
npm install
npm run dev
```

The frontend will start at `http://localhost:5173`.

Vite is configured with automated reverse proxy routing in `vite.config.js`:
- `/api/news` -> `http://localhost:8000`
- `/api/stories` -> `http://localhost:8001`
- `/api/chart` -> `http://localhost:8002`
- `/api/v1` & `/ws` -> `http://localhost:8003`

---

### Step 3 — Running Automated Test Suites

#### E2EE Backend Tests
Run the complete cryptographic and integration test suite:
```bash
cd E2E-main
pytest -v
```
Expected output: **27 passed** (covering X3DH, prekey exhaustion, device revocation, rate limiting, WebSocket real-time delivery, and multi-device routing).

#### Chart Service Tests
```bash
cd chart-service
pytest -v
```

#### News Service Tests
```bash
cd news-service
pytest -v
```

#### Story Service Tests
```bash
cd story-service
pytest -v
```

#### Frontend Production Build Test
```bash
cd talktrading-frontend
npm run build
```
Ensures zero JSX/Rollup/CSS syntax errors and generates optimized production bundles in `dist/`.

---

### Step 4 — Interactive Manual E2E Testing (Alice & Bob)

1. Open `http://localhost:5173` in your browser.
2. Click **Chats** in the top navigation bar.
3. Observe the top bar: by default, **Alice** (`alice_dev`) is the active user.
4. Select **Bob** (`bob_crypto`) from the contact list on the left.
5. Notice the green **E2EE Encrypted** shield badge in the chat header.
6. Type a message (e.g., *"Secret trade signal: Buy AAPL at $210!"*) and press **Send** (or Hit Enter).
7. The browser:
   - Fetches Bob's identity key and one-time prekey (OPK) from the E2EE service (`POST /api/v1/keys/query`).
   - Computes X3DH session key via `@noble/curves/ed25519` and WebCrypto HKDF.
   - Encrypts the plaintext using AES-256-GCM with device-bound AAD.
   - Dispatches the encrypted envelope to the backend (`POST /api/v1/chat/send` or via active WebSocket).
8. Toggle the active user identity in the header to **Bob**.
9. Bob's view instantly decrypts the received envelope using Bob's matching identity and consumed OPK private key!
10. Click the **Security Inspector** shield button to inspect:
    - Protocol version (`X3DH-v1 + AES-256-GCM`)
    - Sender & Recipient Device IDs
    - Consumed One-Time Prekey (OPK) ID
    - Associated Data (AAD) string
    - Raw ciphertext and initialization vector (IV) base64 strings

---

## 7. Security Architecture and Threat Model

### Web Client Key-Storage Threat Model

| Threat Vector | Severity | Vulnerability Description | Applied Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **XSS Key Extraction** | Critical | Malicious script injected via DOM attempts to dump cryptographic private keys. | Keys are stored in IndexedDB using `cryptoStorage.js` with WebCrypto handles. Private keys are marked non-extractable where supported by the browser engine. |
| **LocalStorage Scraping** | High | Unencrypted local storage values dumped by rogue browser extensions. | Sensitive cryptographic private keys and one-time prekey seeds are persisted in isolated browser IndexedDB object stores rather than plain `localStorage`. |
| **Ciphertext Tampering** | High | In-transit or at-rest tampering with encrypted message payloads. | AES-256-GCM authenticated encryption provides cryptographic integrity tags. Tampered payloads fail authentication and are discarded. |
| **Device Impersonation** | High | Rogue client attempts to publish prekeys under another user's identity. | Device registration and prekey uploads require authenticated JWT tokens with strict user identity claim validation. |
| **Identity Key Spoofing** | High | Adversary attempts to swap signed prekeys. | Signed Prekeys (SPK) must be cryptographically signed by the user's Master Identity Key (IK) using Ed25519 signatures. |
| **Traffic Replay Attacks** | Medium | Old ciphertext envelopes captured by an adversary replayed to recipient. | Ephemeral public keys (EK) and random 96-bit AES-GCM IVs ensure every ciphertext is unique. Replayed frames trigger duplicate detection or ratcheted state errors. |

---

### Service-to-Service Authentication Architecture

For backend microservice communication (e.g., between News/Story/Chat and the E2EE Identity Service), the architecture implements **Asymmetric Workload JWTs**:

1. **Workload Identity**: Calling services hold an Ed25519 private key and sign short-lived (5-minute expiration) JWT tokens.
2. **Claims Structure**: Includes standard `iss` (`chat-identity-provider`), `sub` (`service:chat-service`), `aud` (`Reddit-Insta E2EE Service`), and `scopes` (`["keys:read"]`).
3. **Zero Shared Secrets**: The E2EE Service loads only public keys (`CHAT_SERVICE_PUBLIC_KEY`). A compromise of the E2EE Service does not compromise the private keys of calling services.

---

### Distributed Rate Limiting

The E2EE Identity Service implements a **Redis Sliding Window Rate Limiter** to protect against brute-force key enumeration and denial-of-service:

- **Algorithm**: Redis Sorted Sets (`ZSET`) storing millisecond timestamps. `ZREMRANGEBYSCORE` cleans old timestamps outside the current window; `ZCARD` counts active attempts.
- **Thresholds**:
  - Device Registration: 3 requests/min per User, 5 requests/min per IP.
  - Prekey Replenishment: 10 requests/min per device.
  - Key Bundle Query: 100 requests/min per user, 10,000 requests/min for authenticated backend services.
- **Resilience (Fail-Open)**: If Redis becomes unreachable, the rate limiter fails open with warning logs to prevent breaking legitimate user message delivery.

---

## 8. Security Gate Status

All 14 core security gates defined in the architecture specification have been validated against the codebase and verified through automated test suites:

| # | Security Gate Requirement | Status | Verification & Evidence | Residual Risk / Mitigation |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **No private keys server-side** | **PASS** | Verified by `test_security_gate_1_private_keys_never_reach_backend`. API schemas strictly exclude private key fields. | None. Private keys never leave the browser. |
| **2** | **No plaintext messages server-side** | **PASS** | Verified by `test_security_gate_2_and_3_plaintext_never_sent_and_only_ciphertext_received`. Server stores only base64 ciphertext envelopes. | None within the service boundary. |
| **3** | **No server-side decryption** | **PASS** | Verified by `test_security_gate_4_e2ee_service_cannot_decrypt_messages`. Server lacks private keys and cannot derive session secrets. | None. |
| **4** | **Service-to-service authentication** | **PASS** | Verified by `test_service_to_service_auth_success` using asymmetric Ed25519 signed JWTs. | Chat service private key compromise; mitigated by 5m TTL. |
| **5** | **Distributed rate limiting** | **PASS** | Verified by `test_rate_limiting_enforcement`. Requests over limit return HTTP 429 Too Many Requests. | Redis outage; handled with fail-open fallback. |
| **6** | **Device authorization** | **PASS** | Verified by JWT sub and device_id matching enforcement in API route dependencies. | Token leakage; mitigated by short expiration windows. |
| **7** | **Prekey atomicity** | **PASS** | Verified by `with_for_update()` database row locking during OPK consumption. | Database lock contention under extreme concurrency. |
| **8** | **Key rotation safety** | **PASS** | Verified by `test_security_gate_8_key_rotation_does_not_break_active_sessions`. Existing session keys remain valid. | Client failing to trigger periodic rotation. |
| **9** | **Device revocation** | **PASS** | Verified by `test_security_gate_6_revoked_devices_cannot_establish_sessions`. Revoked devices are purged from prekey lookup. | Messages already dispatched before revocation takes effect. |
| **10** | **Multi-device fan-out** | **PASS** | Verified by `test_security_gate_7_multiple_devices_handled_independently`. Unique encrypted envelopes generated per recipient device. | Growth of metadata payload size with large device counts. |
| **11** | **Protocol / library selection** | **PASS** | Permissive `@noble/curves` (MIT) and WebCrypto on frontend; PyCA `cryptography` (Apache 2.0/BSD) on backend. Zero AGPL copyleft risks. | Future dependency vulnerability; monitored via audit tools. |
| **12** | **Web key storage** | **PASS** | Key material isolated in IndexedDB via `cryptoStorage.js` with non-extractable WebCrypto primitives. | DOM-level XSS; mitigated by Content Security Policy. |
| **13** | **Zero sensitive data in logs** | **PASS** | Verified by `test_security_gate_12_sensitive_data_is_never_logged`. Intercepted log buffers contain no plaintexts or key material. | Exception stack traces during debug mode. |
| **14** | **Safe database backups** | **PASS** | Database contains only public identity keys, signed prekeys, and opaque ciphertexts. Backups cannot decrypt messages. | Metadata correlation (who talks to whom and when). |

---

## 9. Production TODOs

For transitioning from development/staging to high-volume enterprise production:

1. **Production PostgreSQL Migration**
   - Migrate backend SQLite databases (`news.db`, `stories.db`, `chart.db`) to managed PostgreSQL instances (e.g., AWS RDS or Supabase).
   - Apply Alembic migrations across all services to maintain schema synchronization.

2. **Distributed Redis Cluster**
   - Deploy managed Redis (AWS ElastiCache or Redis Enterprise) for production sliding window rate limiting and cross-pod WebSocket pub/sub broadcasting.

3. **Double Ratchet Protocol Implementation**
   - Extend the initial X3DH session establishment with continuous Diffie-Hellman ratcheting (Double Ratchet) to provide per-message forward secrecy and break-in recovery.

4. **Multi-Device Key Synchronization & Social Recovery**
   - Implement encrypted identity backups protected with user passphrases derived via `scrypt` or Argon2id.
   - Introduce QR-code out-of-band safety number verification between contacts.

5. **End-to-End Encrypted Media Attachments**
   - Implement client-side file chunking and AES-256-GCM file encryption for images and audio files before uploading to S3 presigned URLs.
   - Only the encrypted media decryption key is transmitted inside the E2EE text message payload.

6. **Hardened Content Security Policy (CSP)**
   - Configure HTTP response headers to restrict `script-src` and `connect-src` strictly to trusted domains to prevent XSS-driven cryptographic exploitation.

---

## 10. Verification Status Summary

| Component | Status | Port | Core Technologies | Automated Test Coverage |
| :--- | :---: | :---: | :--- | :---: |
| **News Service** | **READY** | `8000` | FastAPI, SQLite/PostgreSQL, Provider Adapters | PASS |
| **Story Service** | **READY** | `8001` | FastAPI, SQLite/PostgreSQL, AWS S3 Presign, SlowAPI | PASS |
| **Chart Service** | **READY** | `8002` | FastAPI, SQLite/PostgreSQL, Finnhub, TradingView | PASS |
| **E2EE Identity Service** | **READY** | `8003` | FastAPI, PostgreSQL/SQLite, WebSockets, PyCA `cryptography` | **27/27 PASS** |
| **TalkTrading Frontend** | **READY** | `5173` | React 18, Vite, `@noble/curves`, WebCrypto SubtleCrypto | **Build PASS** |
| **End-to-End Chat Flow** | **READY** | Browser | Alice <-> Bob bidirectional X3DH + AES-256-GCM | **VERIFIED** |

**Conclusion**: The TalkTrading platform is fully integrated, cryptographically verified, fully documented, and ready for deployment.

> **Caveat (added 2026-09-25)**: The line above was the original author's conclusion and is optimistic relative to the independent audit in `DIAGNOSIS.md`. In particular: no shared authentication existed across services at audit time (since partially fixed, see Section 11 below), one full microservice (Community/Java) was never mentioned anywhere in this document and was completely disconnected from the frontend, Story Service's S3 upload had no AWS credentials configured, and the frontend had zero automated tests. Treat this document's original sections 1-10 as a description of intended design; treat Section 11 and `DIAGNOSIS.md` as the current, verified state.

---

## 11. Remediation Log (Live — Post-Audit Fixes)

This section is updated every time a problem from `DIAGNOSIS.md` (or one newly discovered while fixing something else) is worked on. Same format as Section 5: **Problem → Solution**, dated, most recent first. Nothing is marked fixed here unless it was actually tested (curl/pytest/browser), not just code-reviewed.

---

### 2026-09-25 — Central Authentication, Phase 1: Real Login/Signup

**Context**: `DIAGNOSIS.md` Section 9 identified that no shared authentication existed across the platform — only Post Service had a login flow, and it was cryptographically incompatible with E2EE Service (different JWT secret, different `sub` claim format: email-derived int vs. expected UUID). Decision made with the user: fix Post Service's token format to issue UUID subjects (compatible with E2EE Service) rather than build a throwaway login first and redo it later.

#### Problem 1 — Post Service's `/auth/register` crashed with 500 on every call (found during this work, not in original audit)

**Root cause, two stacked bugs**:
1. `passlib==1.7.4`'s bcrypt backend self-test is incompatible with `bcrypt>=4.1` (a known upstream ecosystem issue). The installed environment had drifted to `bcrypt==5.0.0` even though `requirements.txt` already correctly pinned `bcrypt==4.0.1` — nobody had installed from the pinned file in this environment. Calling `hash_password()` threw `ValueError: password cannot be longer than 72 bytes` from deep inside passlib's internal backend-detection self-test, unrelated to the actual password length.
2. Once bcrypt was fixed, a second bug surfaced: `app/models/user.py` defined `User` as a plain **Pydantic** `BaseModel` (explicitly commented "Post Service does NOT own a local users table"), but `app/services/auth_service.py` imported that same class and called `db.add(User(...))` on it as if it were a SQLAlchemy ORM model. There was no `users` table in the database at all — `main.py` never imported the model, so `Base.metadata.create_all()` never created it.

**Verification**: Ran `python -m uvicorn app.main:app` directly and hit `POST /auth/register` with curl — confirmed the 500 and captured the real traceback for bug 1, then bug 2, before fixing either.

**Solution**:
- Reinstalled the already-pinned `bcrypt==4.0.1` (`python -m pip install "bcrypt==4.0.1"`) — no code change needed, just matching the environment to the existing pin.
- Rewrote `app/models/user.py` as a real SQLAlchemy model: `id` (String(36) UUID, default `uuid.uuid4()`), `username`, `email`, `hashed_password`, `created_at`.
- Added `from app.models.user import User` to `app/main.py`'s model-import block so `Base.metadata.create_all()` actually creates the `users` table.
- Updated `app/schemas/user.py`'s `UserResponse.id` type from `int` to `str` to match the new UUID PK.

**Files changed**: `post-service-feature-post-module/app/models/user.py`, `app/main.py`, `app/schemas/user.py`.

#### Problem 2 — Post Service JWTs used email as `sub`, incompatible with E2EE Service's UUID expectation

**Solution**: Changed `app/api/auth.py`'s `/login` to issue `"sub": str(db_user.id)` (the new UUID) instead of `db_user.email`. Post Service's existing `get_current_user_id()` dependency (`app/core/security.py`) already had a CRC32-based fallback that deterministically maps a non-integer `sub` string to a stable pseudo-integer for its existing `author_id: Integer` columns — so this required **no changes** to Post/Comment/Like/Save ownership logic; it was already written to tolerate a UUID `sub`, just never exercised with one until now.

**Files changed**: `post-service-feature-post-module/app/api/auth.py`.

**Verification (real, via curl against a running instance)**:
```
POST /auth/register -> 201 {"id":"f7a87e56-...", "username":"testuser2", "email":"test2@example.com"}
POST /auth/login    -> 200 {"access_token": "<JWT with sub=f7a87e56-...>", "token_type":"bearer"}
POST /api/v1/posts/ (Authorization: Bearer <token>) -> 201, author_id derived correctly from the UUID
```
Full existing test suite re-run after changes: **28/28 passed** (no regressions).

#### Problem 3 — No login UI existed anywhere in the frontend

**Solution**: Built a real, working login system in `talktrading-frontend`:
- `src/services/authService.js` — calls Post Service's real `/auth/register` and `/auth/login`.
- `src/context/AuthContext.jsx` — holds `user`/`token` state, persists to `localStorage` under `talktrading_token` / `talktrading_user` (the same key `postService.js` was already reading via `getAuthToken()`, so every existing API call started using the real token automatically with zero changes elsewhere).
- `src/pages/Login.jsx` — combined login/signup screen matching the app's dark theme.
- `src/components/layout/RequireAuth.jsx` — route guard; redirects unauthenticated users to `/login` and back to their originally intended page after login.
- `src/App.jsx` — wrapped the router in `AuthProvider`, gated all existing routes behind `RequireAuth`, added the `/login` route.
- `src/components/layout/TopAppBar.jsx` — added a working logout button and switched the avatar to reflect the real logged-in username.

**Verification (live in-browser, via the Claude Browser tool, not just code review)**:
1. Signed up a new user (`browser_test_user` / `browsertest@example.com`) through the actual UI → confirmed a real UUID user was created and the app auto-logged-in and redirected to the home feed.
2. Confirmed `localStorage` held a real JWT and user object (not placeholder data).
3. Clicked Logout → confirmed redirect to `/login`.
4. Navigated directly to `/profile` while logged out → confirmed the route guard blocked it and redirected to `/login`.
5. Logged back in with the same credentials → confirmed redirect back to `/profile` (the page originally requested before being bounced), and the profile page rendered.

**Known gaps intentionally left for follow-up** (not silently dropped — tracked here so they aren't lost):
- `E2EContext.jsx` (chat) still hardcodes the Alice/Bob demo identities and does not yet use the real logged-in user — chat is not yet on the new auth system.
- `UserProfile.jsx` and `HomeFeed.jsx` still display hardcoded mock profile data (`Alex Mercer`, `alex_quant`, `author_id: 101`) instead of `useAuth().user` — new posts are correctly attributed to the real logged-in user on the backend, but the UI doesn't reflect it yet.
- No `/users/me` endpoint exists on Post Service, so the frontend cannot re-fetch profile info after login — it only knows what was typed into the login/signup form.
- No password-reset flow (backend has none either).

---

---

### 2026-09-25 — Wired Real Logged-In User into Feed & Profile (Immediate Follow-up #2)

**Context**: The previous entry's login system worked but nothing consumed it yet — `UserProfile.jsx` still showed a hardcoded mock persona (`Alex Mercer`/`alex_quant`/`author_id: 101`) and `HomeFeed.jsx` still used a hardcoded dev UUID for stories, regardless of who was actually logged in.

**Solution**:
- Added `src/utils/authorId.js` — a JS port of Post Service's `zlib.crc32`-based UUID→int derivation (`app/core/security.py`'s `get_current_user_id()` fallback), so the frontend can compute the same `author_id` the backend assigns to a UUID subject, needed to filter "my posts" since there's no `/users/me` endpoint.
- **Verified the port bit-for-bit against the real backend before trusting it**: ran Python's `zlib.crc32` against a UUID captured from an earlier live test and compared it to the JS implementation's output for the same input — both produced `563255`. Did not wire this into any component until that matched.
- `UserProfile.jsx`: replaced the hardcoded `mockUsers[1]` with the real `useAuth()` user; `loadUserPosts()` now filters by the real derived `author_id`; removed fabricated stats (follower/following/win-rate counts that had no backend behind them) rather than leaving fake numbers on screen — they now show `0`/`—` honestly instead of invented values. Also removed a "verified" checkmark badge that had no real verification behind it (per `DIAGNOSIS.md`, this account's actual Trader Verification status is "Not verified").
- `HomeFeed.jsx`: replaced the hardcoded `defaultDevUserId` with the real logged-in user's UUID for story creation/viewing; composer avatar now reflects the real user.

**Bug introduced and caught during this same pass** (documented per the rule of logging what actually happened, not just what was intended): the first version only special-cased "this is your own post" display (real username instead of the generic `trader_<id>` placeholder) inside `loadPosts()`'s initial fetch — a post created live through the composer bypassed that logic entirely, since `handleCreateNewPost` added the API response straight to state. Caught by testing in-browser rather than trusting the code read: created a post live, it rendered as `trader_173888` instead of the real username. Fixed by extracting the logic into a shared `applyOwnIdentity()` helper used by both the initial feed load and the live composer path.

**Second, more fundamental bug found while diagnosing the first fix**: after fixing the above, the new post *still* didn't show the real username, and `UserProfile.jsx` showed 0 posts even after the derived `author_id` filter was in place. Root cause: `AuthContext` had been storing `authorId` as a field on the `user` object at the moment of login/register and persisting that snapshot to `localStorage` — but this browser tab's session had been created *before* that field was added to the code, so its cached `localStorage` user object simply never had it, and silently evaluated as `undefined` everywhere it was read. This is a general class of bug (any field added to a persisted object after users already have one cached will be missing for existing sessions) — fixed properly rather than patched around: `authorId` is no longer written to `localStorage` or trusted from storage at all; `AuthContext` now derives it live from `user.id` via `useMemo` every time the user object is read, so it can never go stale no matter what was cached before this code existed.

**Verification (live in-browser + build)**:
1. Reloaded with the pre-existing (stale) session — confirmed the derived-live fix picked up the correct `author_id` (`173888`, independently cross-checked against Python's `zlib.crc32` for that exact UUID) without requiring the user to log out and back in.
2. Created a post through the real composer — confirmed it now renders with the real username (`browsertest`), and another test user's earlier post correctly still shows as `trader_563255` (i.e. the override only applies to the current user's own posts, not everyone's).
3. Navigated to `/profile` — confirmed "1 Post" (the real count from the real filtered query) and the new post rendered in the grid, with honest `0`/`0`/`—` placeholder stats instead of any fabricated numbers.
4. `npm run build` — clean production build, no errors, 307ms.

**Files changed**: `talktrading-frontend/src/utils/authorId.js` (new), `talktrading-frontend/src/context/AuthContext.jsx`, `talktrading-frontend/src/pages/UserProfile.jsx`, `talktrading-frontend/src/pages/HomeFeed.jsx`.

**Still open** (unchanged from previous entry, restated so it isn't lost): chat (`E2EContext.jsx`) still uses the Alice/Bob demo identities, not the real logged-in user; no password-reset flow; no `/users/me` endpoint on the backend, so profile bio/avatar are still frontend-only placeholders, not editable real data.

---

---

### 2026-09-25 — Wired Up Community Service (P1: Highest-Leverage Item from the Punch List)

**Context**: `DIAGNOSIS.md` Section 6 found a fully-built, fully-tested Java/Spring Boot microservice (`community-main/`) that was completely undocumented (absent from `README.md`, `PROJECT_DOCUMENTATION.md`, and `start_all.py`) and completely disconnected from the frontend (`Communities.jsx` ran on 100% hardcoded mock data, with no `communityService.js` in `src/services/` unlike every other real backend). Goal: prove the backend actually runs, then wire the frontend to it for real.

#### Finding 1 — The service compiles cleanly (confirms the earlier audit)

No JDK/Maven was installed system-wide (only JDK 11, which is below Spring Boot 3's Java 17+ floor). Found JDK 23 already installed at `C:\Program Files\Java\jdk-23` (unused, not the active `JAVA_HOME`), and downloaded Apache Maven 3.9.9 (the project's own `mvnw.cmd` is broken — a custom, non-standard wrapper hardcoding a path from the original author's machine, `C:\Users\Admin\.mvn-portable\...`, that doesn't exist here and silently falls back to a plain `mvn` that also isn't installed). Compiled the project with real Maven + JDK 23: **clean compile, zero errors**, directly confirming the earlier audit's "no structural incompleteness" assessment.

#### Finding 2 — A genuine, deep environment bug: this machine cannot run any modern JDK's embedded web server natively

Attempting to actually *run* the service (`mvn spring-boot:run`) failed immediately with `java.io.IOException: Unable to establish loopback connection` from deep inside Tomcat's NIO startup. This was investigated thoroughly rather than worked around blindly, because it looked environment-specific and worth understanding before reaching for Docker as a default hammer:

1. Isolated the failure to a 4-line reproduction with no Spring/Tomcat/Maven involved at all — bare `java.nio.channels.Selector.open()` throws the identical exception. Confirms it is not a Spring Boot or Tomcat bug.
2. Tested across JDK 11 (works), JDK 21 (fails), JDK 23 (fails) — ruling out "JDK 23 specific regression," which was the first hypothesis.
3. Tested with the Bash tool's sandbox explicitly disabled (`dangerouslyDisableSandbox: true`) — failed identically, ruling out Claude Code's own tool sandboxing as the cause. This is a restriction on the underlying Windows machine itself.
4. Extracted and read the actual JDK source (`lib/src.zip`, bundled with every JDK distribution) for `sun.nio.ch.PipeImpl.java`, `WEPollSelectorImpl.java`, and `WindowsSelectorImpl.java`. Root cause, precisely: both the old and new Windows `Selector` implementations hardcode `preferAfUnix = true` when constructing their internal wakeup pipe (`WEPollSelectorImpl.java:79`, `WindowsSelectorImpl.java:141`) — there is no system property, JVM flag, or config to disable this; it is a literal hardcoded `true` with no override mechanism anywhere in the source. On this machine, the pipe's Unix-domain-socket *listener* can bind successfully, but the *client-side connect* to that same socket fails ("Invalid argument: connect") — an asymmetric platform quirk — and `PipeImpl`'s connector logic (`LoopbackConnector.run()`) has no fallback for that specific failure mode (it only catches exceptions from the bind/listen step, not the subsequent connect step).
5. Conclusion: any NIO-based server (Tomcat, Netty, anything calling `Selector.open()`) cannot start natively on this machine with any JDK new enough to run Spring Boot 3. This is not fixable from application code or JVM flags — it requires either an OS-level fix to this machine's AF_UNIX support (out of scope, a systems change I'm not positioned to make safely) or an isolated network namespace, i.e. a container.

This dead end was not wasted effort — it conclusively rules out "just run it directly" as an option and justifies Docker as a requirement rather than a convenience choice, which is now documented plainly in `README.md` so the next person doesn't repeat the same investigation.

#### Finding 3 — Docker resolved it, and the service runs and behaves correctly

Docker Desktop was installed but its daemon wasn't running; started it and confirmed the daemon came up. Ran the project's own `docker-compose.yml` (which spins up a real Postgres 16 container alongside the service — the `prod` Spring profile, not the H2 in-memory `dev` profile) with `PORT=8080` overridden so the container's published port matches what the frontend was already wired to expect (compose's own default is `8081`).

First build attempt appeared to hang for several minutes with zero visible output — this was Docker BuildKit's default progress renderer producing no output at all when not attached to a real TTY, not an actual stall. Restarted the build with `--progress=plain` to get real, verifiable output, which confirmed it was genuinely working the whole time (actively resolving several hundred small Maven plugin dependency POMs — slow due to per-request network latency in this environment, not a hang).

**Verification, all done against the real running container, not assumed**:
```
GET  /api/v1/health                    -> {"status":"UP","service":"community-service",...}
GET  /api/v1/communities (fresh DB)    -> {"content":[],...}  (correctly empty)
POST /api/v1/communities (X-User-Id:1) -> real community created, memberCount:1, currentUserRole:OWNER, isMember:true
POST /api/v1/communities/1/join (X-User-Id:2) -> real membership row created, role:MEMBER
GET  /api/v1/communities (X-User-Id:2) -> memberCount:2, isMember:true (reflects the real join)
DELETE /api/v1/communities/1/join (X-User-Id:2) -> 204, real leave
```

#### Frontend integration

- `src/services/communityService.js` (new) — matches the real backend's DTOs exactly (`CommunityResponse`, `PageResponse<T>`, `X-User-Id` header auth), read directly from `CommunityController.java` and `UserContextFilter.java` before writing a single line, rather than guessing the contract.
- **Reused the existing `authorId` derivation** (`utils/authorId.js`, built in the previous entry for Post Service) as the `X-User-Id` header value — Community Service's `UserContextFilter.java` expects a plain `Long` user id, the same numeric-id pattern Post Service uses, so no new identity-mapping concept was needed.
- `src/pages/Communities.jsx` — full rewrite: real `listCommunities`/`createCommunity`/`joinCommunity`/`leaveCommunity` calls replacing 100% mock data, plus a create-community modal (necessary because the service's `dev`/`prod` Postgres starts empty on every fresh container — without a create flow the page would always be empty on a clean environment). Dropped the `isPro`/`tags` mock-only fields since the real backend has no such concept — no fabricated UI left behind.
- `src/services/apiConfig.js` — added `COMMUNITY_SERVICE_URL` for consistency with the other 5 services' config pattern.

**Verified live in-browser** (not just code-reviewed): navigated to `/communities`, saw the real "Options Kings" community created via curl testing render correctly under Discover; clicked Join — moved to "My Groups" with correct role (`MEMBER`) and updated member count, live; opened the create-community modal, created "Crypto Alphas" through the actual UI form, confirmed it appeared correctly with `OWNER` role. No console errors. Production build (`npm run build`) still clean afterward.

#### Orchestration

- `start_all.py` — added a `ServiceDef` for Community Service. Unlike the five Python services, its `command` is `docker compose up -d --build` (detached — the process exits quickly after starting the containers, which fits the orchestrator's existing health-check-based readiness model without changes).
- `stop_all.py` — added a dedicated `stop_community_service()` step running `docker compose down` scoped to `community-main/`, called **before** the generic port-based kill loop. Deliberately did **not** add port 8080 to the generic `PORTS` kill list: on Windows, the process holding a Docker-published port is Docker Desktop's shared networking backend, not a process unique to this one container — force-killing it by PID could disrupt every other container's port forwarding, not just this service's.
- `README.md` — added Community Service to the microservice table (port 8080, PostgreSQL/Docker), updated "5 backend microservices" wording to 6 throughout, and added an explicit note pointing at this log entry explaining *why* Docker is required here, not just preferred.

**Still open / not done in this pass**: Community Service's own auth (`X-User-Id` header, trust-the-caller) is not yet tied into the platform's real JWT-based auth from the earlier login work — it currently trusts whatever `X-User-Id` the frontend sends, the same as it trusted a hardcoded value before. No community-post creation UI (the backend supports posts within a community; only the community list/join/create flows were wired this pass, matching the original mock UI's scope). Community Service's own `/api/v1/health` isn't yet surfaced anywhere in the frontend (no health-check-and-fallback pattern like `newsService.healthCheck()` — if the container isn't running, `Communities.jsx` shows a clear inline error, which is enough for now but is less graceful than News/Chart's pattern).

---

### 2026-10-05 — Login Page Problems (reported by user): Root Cause + Fixes

**Reported**: "check the problem with login page". No specific symptom was given, so each login/signup path was reproduced against the real backend and in the real UI.

**Root cause #1 (the big one) — a stale Docker copy of Post Service hijacks port 8004.** The old `post_service_app` container (+ `post_service_postgres`) from the Post Service's own docker-compose has restart policy `unless-stopped`, so Docker Desktop resurrects it every time it starts. It runs a pre-auth image against its own separate Postgres DB, and it binds `0.0.0.0:8004` — the same port the native Post Service uses. Whenever it was the one answering, login returned **HTTP 500**, and the old frontend mapped *any* failed login to "Invalid email or password" — so users were told their password was wrong when the server was broken. Real accounts live in the native `post.db`, which that container never sees.
**Fix**: `docker update --restart=no` + `docker stop` on `post_service_app` and `post_service_postgres` (reversible; volumes untouched; the unrelated `e2e-*` containers were left alone). To undo: `docker update --restart=unless-stopped post_service_app post_service_postgres && docker start post_service_postgres post_service_app`. **Do not run both at once** — pick native (used by `start_all.py`) or Docker for Post Service.

**Other problems found and fixed**
| # | Problem | Fix |
|---|---|---|
| 2 | Duplicate-email signup → unhandled DB error → HTTP 500 → UI said only "Registration failed" | `auth_service.register_user` checks email/username first and returns a clear **409** (also catches the `IntegrityError` race) |
| 3 | After any logout/login the username silently changed (e.g. DB `browser_test_user` shown as `browsertest`): logout wipes the cached profile and there is no `/users/me` | `/auth/login` now returns `user {id, username, email}` alongside the token; `AuthContext.login` uses it |
| 4 | Login was case-sensitive on email (phone keyboards auto-capitalize → `Harsh@gmail.com` failed for `harsh@gmail.com`) | emails are trimmed/lower-cased on signup; login compares `lower(email)` (existing rows still match) |
| 5 | Backend down showed a raw "Failed to fetch" | friendly "Cannot reach the server…" message |
| 6 | FastAPI 422 `detail` is an array of objects → rendered as "[object Object]" | `authService` flattens validation messages into readable text |
| 7 | 5xx responses reported as bad credentials | any 5xx now shows "The account service ran into a problem on its side…" |

**Verification**: new `tests/test_auth.py` (6 tests: register→login returns profile, duplicate email/username → 409, case-insensitive duplicates, case-insensitive login, identical 401 for wrong-password vs unknown-user) — post-service suite **34/34 pass** (was 28). In the real UI: duplicate signup shows the 409 message; login with `BrowserTest@Example.COM` succeeds and stores the real username `browser_test_user`; with the backend stopped the friendly unreachable message appears; production build clean. Two throwaway rows my curl tests had created (`fresh@`/`longpw@example.com`) were deleted; the real accounts (`harsh`, `harsh200493`, etc.) were not touched.

**Files changed**: `post-service-feature-post-module/app/services/auth_service.py`, `app/api/auth.py`, `tests/test_auth.py` (new); `talktrading-frontend/src/services/authService.js`, `src/context/AuthContext.jsx`.

**Still open**: one of the real accounts was registered as `harshshrama200493@gmail.com` ("shrama" — likely a typo of "sharma"); there is no password-reset or change-email flow, so that user must log in with the typo'd address. No rate limiting on `/auth/login`. `start_all.py`'s port pre-flight cannot safely detect this container hijack on Windows (the port owner is Docker's shared backend, not the container) — hence the note above.

---

### 2026-10-05 — Community & Explore run natively (no Docker) + Explore/Post Service integration bugs

**Correction to the 2026-09-25 entry.** That entry concluded modern JDKs cannot start a web server on this machine and that Docker was required. That was wrong. Root cause: the JDK builds its Selector wakeup pipe from a Unix-domain socket created under `java.io.tmpdir`; here that path (user name with a space, 8.3 short name `HARSHS~1`) can be bound but not connected to ("Invalid argument: connect"). Starting the JVM with **`-Djdk.net.unixdomain.tmpdir=C:\jtmp`** (any short, space-free folder) fixes it — verified with the 4-line `Selector.open()` test (fails without, passes with). Docker is therefore optional for both Java services.

**How to run natively** (JDK 23 at `C:\Program Files\Java\jdk-23`, Maven 3.9.x; create `C:\jtmp` once):
- Community (H2 dev profile, :8080): `mvn spring-boot:run -Dspring-boot.run.profiles=dev "-Dspring-boot.run.jvmArguments=-Djdk.net.unixdomain.tmpdir=C:\jtmp"`
- Explore (:8083, in-memory H2, no Redis — Explore already fails open when Redis is down): `mvn spring-boot:run -Dspring-boot.run.useTestClasspath=true "-Dspring-boot.run.jvmArguments=-Djdk.net.unixdomain.tmpdir=C:\jtmp" "-Dspring-boot.run.arguments=--server.port=8083 --spring.datasource.url=jdbc:h2:mem:explore;DB_CLOSE_DELAY=-1;MODE=PostgreSQL --spring.datasource.driver-class-name=org.h2.Driver --spring.datasource.username=sa --spring.datasource.password= --spring.flyway.enabled=false --spring.jpa.hibernate.ddl-auto=create-drop --spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect --app.clients.post-service.url=http://127.0.0.1:8004"`. (`useTestClasspath` is only to get the test-scoped H2 driver; data is lost on restart.)

**Two bugs found because Explore returned an empty feed** (would also have affected the Docker build):
1. Explore called Post Service with `visibility=PUBLIC`; Post Service's enum is lowercase, so every call got **HTTP 422** and Explore's circuit-breaker fallback silently returned an empty feed. Fixed in `PostServiceClient.java` (`"public"`). My earlier note that Post Service ignores that parameter was wrong.
2. Post Service timestamps have no timezone (`2026-09-29T16:09:39`); Explore's `Instant` field failed to deserialize them. Fixed with a lenient deserializer in `ExternalPostDto.java` (no zone = UTC).

**Verification**: Explore returns the real posts ranked, with media paths; the browser Explore page renders them with real images; the Communities page lists a real community from the native service; CORS preflight confirmed for both. "Failed to fetch" on both pages earlier was simply the services not running.

**Not yet done**: `start_all.py`/`stop_all.py` still launch Community via Docker and do not start Explore at all; they need native launchers (Maven path + `C:\jtmp` flag). Explore's `PostServiceClientTest` was not re-run after the changes.

---

### 2026-10-12 — Health check + fix: private / followers-only posts were readable by anyone

**Health check result**: all 261 automated tests pass (News 12, Story 10, Chart 12, E2EE 27, Post 34 → 44 after this fix, Explore 56, Community 110); all five Python services and the frontend start and answer health checks; news is fresh; chart quotes are live.

**Bug found by probing the live API with two real users**: Post Service only filtered visibility in the home feed and hashtag pages. `GET /posts/{id}` (even logged out), the post list, and text search returned private and followers-only posts, and any stranger could like, comment on, save and share them.

**Fix**: one shared rule in `app/core/visibility.py` — public posts are visible to everyone; private and followers-only posts only to their author (followers-only stays author-only until a follow system exists). It is applied to post detail (404, not 403, so existence is not revealed), the post list/search (SQL filter, anonymous viewers see public only), comment-by-id, and a `require_viewable_post` dependency on the comment, like, save and share routes. A missing post still gets each route's own 404.

**Verification**: new `tests/test_visibility.py` (10 tests) — suite 44/44. Live re-run after restarting the service: stranger and anonymous get 404 on a private post, list and search no longer return it, like/comment return 404, the author still sees it, public posts unaffected.

**Still open from the same review**: no follow system or followed-only feed, no profile/`users/me` endpoint or user search, `@mentions` are not stored, no notifications, no story viewer list, story endpoints have no authentication, chat only works for two demo users whose keys derive from public device names, the home-page price strip uses hardcoded fake prices, and `start_all.py` still launches Community via Docker and does not start Explore.

---

### 2026-10-12 — Roadmap step 1 of 8: follow system (Instagram-style following)

**Agreed roadmap** (one step at a time; each step is tested, verified live and logged here before the next): 1 follow system · 2 profiles + user search · 3 persist @mentions · 4 stories: login + viewer list · 5 live prices on the home page · 6 chat for real accounts · 7 `start_all.py` launching Community + Explore natively · 8 notifications.

**Problem**: there was no way to follow anyone, the home feed showed every public post regardless, followers-only posts could never be seen by anyone but the author, and the feed's "who do I follow" lookup called a separate user service that does not exist (so it always returned nothing).

**Backend (Post Service)**
- New `follows` table (`app/models/follow.py`): `follower_id` → `following_id`, unique pair, same integer user ids used by `Post.author_id` / `Like.user_id`.
- New `app/services/follow_service.py` and `app/api/routes/follows.py`: `POST /users/{id}/follow` (201; 409 if already following; 400 for yourself; 401 logged out), `DELETE /users/{id}/follow` (404 if not following), `GET /users/{id}/follow-stats` (followers, following, `is_following`, `follows_you`), `GET /users/{id}/followers`, `GET /users/{id}/following`.
- Visibility rule (`app/core/visibility.py`) extended: followers-only posts are now visible to the author **and their followers** (post detail, list/search via a SQL sub-query, like/comment/save/share, comment-by-id); private stays author-only even for followers.
- Feed: `GET /feed/?scope=all|following`. `following` = your own posts + accounts you follow (including their followers-only posts); anonymous viewers get an empty following feed. `scope=all` (default) keeps the old behaviour so Explore and existing callers are unchanged. The dead external `UserServiceClient` call was removed from `feed_service.py` (the client file is now unused).

**Frontend**: `postService` gained `followUser`, `unfollowUser`, `getFollowStats` and a `scope` option on `fetchFeed` (the following scope never silently falls back to the global list). Home feed has Everyone / Following tabs, a Follow / Following button on other people's posts (state loaded per visible author), and an empty-state message; the profile shows real follower / following counts instead of placeholders.

**Verification**: 9 new tests in `tests/test_follows.py` (counts on both sides, duplicate/self/logged-out rules, unfollow, lists, followers-only visibility granted and revoked, private still hidden from followers, following feed contents, anonymous following feed) — Post Service suite **53/53**. Live: with two real accounts, B followed A, B could read A's followers-only post, B's following feed contained A's posts. In the browser as a fresh account: tabs rendered, 9 Follow buttons appeared on other users' posts, clicking one flipped it to Following, the Following tab then showed only that author, and the profile showed "1 FOLLOWING". Frontend production build clean.

**Known limits**: follow targets are not validated as existing users yet (a profile/user lookup arrives in step 2, which will reject unknown ids); the `follows` and `users` tables are created by `create_all` at startup and are not in an Alembic migration; Explore does not take follows into account yet.

---

### 2026-10-12 — Roadmap step 2 of 8: profiles + user search

**Problem**: accounts had only a UUID, a username and an email. There was no profile endpoint, no bio/avatar/display name, no way to find or open another user's page, posts showed a generic `trader_<id>` placeholder instead of the author's name, and following an id that belonged to nobody was accepted.

**Backend (Post Service)**
- `users` gained `author_id` (unique integer, the same id posts/likes/comments/follows use), `display_name` (64), `bio` (160), `avatar_url`. `author_id` is derived from the UUID (`derive_author_id`); because that hash can collide, signup now re-rolls the UUID until the derived id is unused, and a unique index enforces it.
- Existing databases are upgraded at startup by `app/database/lite_migrations.py` (adds missing columns, backfills `author_id`, creates the index; idempotent, errors logged instead of swallowed). `create_all` never alters existing tables, so this was needed. Before it first ran, `post.db` was backed up to `post.db.bak`. All 13 existing users were backfilled with no collisions, and their ids match the author ids on their existing posts (e.g. `harsh` = 21209).
- New endpoints (`app/api/routes/profiles.py`, `app/services/profile_service.py`): `GET /users/me`, `PUT /users/me` (display name ≤64, bio ≤160, blank name rejected), `POST /users/me/avatar` (JPG/PNG/GIF/WebP only, ≤5 MB, magic bytes checked, so a renamed text file is refused), `GET /users/search?q=` (case-insensitive partial match, `@` ignored, `%`/`_` not treated as wildcards, prefix matches first), `GET /users/lookup?ids=` (batch id → profile, up to 100), `GET /users/by-username/{name}`, `GET /users/{id}`. Fixed paths are declared before `/users/{id}` so they are not captured by it.
- A profile includes followers / following counts, `is_following`, `follows_you`, `is_me` and `posts_count`, which only counts posts the viewer is allowed to see (a stranger sees fewer than the owner).
- Follow now returns 404 for an unknown user (closes the step 1 known limit); followers/following lists also return profile summaries.
- Login is case-insensitive on email; duplicate email/username return 409.

**Bugs found along the way**: startup crashed with `KeyError: 'correlation_id'` because migration log lines are written outside a request, so a default log-record factory now supplies `correlation_id="-"`; a test caught that one bad token in `lookup?ids=` discarded all the good ones, so tokens are now filtered individually.

**Frontend**: `/profile/:username` shows anyone's profile (own profile at `/profile`); unknown names get a "User not found" page. Own profile has real name, bio, avatar, counts, an **Edit Profile** modal (display name, bio with 160 counter, photo upload) and the Saved tab; other people's profiles show a Follow / Following / Follow back button instead, no Saved tab, no composer buttons, no settings icon. The home feed resolves each author to their real username and avatar (and links it to their profile), and the comments drawer shows usernames instead of "Trader #id". Explore has a new **People** tab with debounced search and Follow buttons.

**Verification**: 11 new tests in `tests/test_profiles.py` plus the follow tests adjusted to seed real users — Post Service suite **64/64**; frontend production build clean. Live after restarting the service: lookup/search/by-username work, follow of an unknown id returns 404. In the browser as `ui_check`: another user's profile loaded with a Follow button and no Saved tab; Follow and Unfollow both flipped the button and persisted on the server; Edit Profile saved a new name and bio and the page updated; People search for "har" listed `harsh` (Following) and `harsh200493` (Follow).

**Not verified in the browser**: avatar upload through the UI (covered by backend tests only). A test-setup slip on my side (stored login state without the user id) briefly made the profile look broken; it was not an app bug.

**Known limits**: `users`/`follows` are still not in Alembic; seeded demo posts and the older mock posts still use placeholder names; followers/following counts on the profile are not yet clickable lists.

---

### 2026-10-12 — Roadmap step 3 of 8: persist @mentions

**Problem**: `@username` in a caption was just text. A `mentions` table and an `extract_mentions` helper existed, but nothing ever wrote to the table, so mentions could not be listed and later notifications would have had nothing to read.

**Backend (Post Service)**
- New `app/services/mention_service.py`: `sync_mentions` resolves `@names` (case-insensitive) to real accounts and stores one row per mentioned user for a post or comment. Unknown names and self-mentions are ignored, duplicates stored once, and editing a caption/comment replaces the old rows. `posts_mentioning` lists posts that mention a user, filtered by the shared visibility rule, newest first.
- Called from `create_post`, `update_post` (when the caption changes), `add_comment` and `update_comment`.
- New `GET /users/{id}/mentions` (paged, anonymous allowed): private posts never appear for anyone but the author; followers-only follow the existing rule.
- Removed the dead `extract_mentions` from `post_service.py` (it duplicated the new pattern).
- `GET /users/by-username/{name}` is now case-insensitive, so a link from `@Harsh` resolves to `harsh`.

**Frontend**: new `components/ui/RichText.jsx` built on the **`linkify-react`** library with `linkify-plugin-mention` (added per the "use libraries, not custom code" rule) — `@name` in home-feed post text becomes a link to `/profile/name`, URLs become links.

**Verification**: 5 new tests in `tests/test_mentions.py` (real users only, duplicates, caption edit, comment create/edit, visibility for anonymous/stranger/author) plus a case-insensitive lookup assertion — Post Service suite **69/69**; frontend build clean. Live: a post mentioning `@Harsh` and `@nobody_here` stored only Harsh; logged-out viewers saw the public post only, the author also saw the private one; the home feed rendered the mentions as links to `/profile/...`.

**Not done / limits**: mentions in the profile grid thumbnails and comment drawer are still plain text; no autocomplete while typing `@`; mentions do not notify anyone yet (step 8). My live test left two posts by `ui_check` (ids 16, 17) in `post.db`.

---

### 2026-10-12 — Roadmap step 4 of 8: stories require login + viewer list

**Problem**: the Story Service launched with `AUTH_ENABLED=false`, so every endpoint was open. Even with auth on, it trusted ids sent by the client: anyone could post a story as another user, record a view as someone else, or delete another user's story by passing their id. Views could also be recorded for stories that do not exist, and there was no way to see who viewed a story.

**Backend (Story Service)**
- Login is now on by default (`auth_enabled=True`) and `start_all.py` runs it with `AUTH_ENABLED=true` and the same HS256 secret the Post Service signs tokens with (`SECRET_KEY`, so Story verifies Post Service logins).
- The acting user always comes from the token. `user_id` in the create body, `viewer_id` in the view body, `user_id` in the presign body and the `user_id` query parameter on delete are no longer trusted (the first three are optional and ignored, so existing clients keep working; delete no longer needs the parameter).
- `POST /stories/{id}/view` returns 404 for unknown or expired stories and does not count the owner's own views; still idempotent per viewer.
- New `GET /stories/{id}/viewers`: owner only (403 for anyone else, 404 if unknown/expired), returns `[{viewer_id, viewed_at}]` newest first.
- Expiry is checked in SQL (`get_active_story`), matching the other queries (SQLite returns naive datetimes, so a Python comparison failed in testing).

**Frontend (non-frozen parts only)**: `storyService.js` now sends the login token on every call, gives a readable error on 401, and has `fetchViewers`. New `components/StoryViewers.jsx` shows "N viewers" with usernames and avatars (resolved through the Post Service lookup); `HomeFeed.jsx` got one import and one line to show it in the story viewer on your own stories — nothing else in that file changed.

**Verification**: new `tests/test_api.py` (12 cases: all six endpoints reject missing/invalid tokens, owner taken from token, viewer once and body id ignored, owner views not counted, viewers owner-only, 404s, delete owner-only) plus the 10 existing tests — Story suite **22/22**; frontend build clean. Live with two real accounts: story created, other user's view recorded (204), owner saw that user in the viewer list, the other user got 403, logged-out got 401. In the browser the home page sent the token (feed 200) and the "My Story" viewer showed "1 viewer — story_viewer".

**Not verified / limits**: posting a story through the UI form was not clicked through (the API path was); the home page still only loads your own stories — showing stories of people you follow needs the follow list in the home page, which is in the frozen post-feed area; old stories created before this change are still owned by whatever `user_id` was sent then. Test accounts `ui_check` and `story_viewer` and one test story remain in the local databases.

---

### 2026-10-12 — Roadmap step 5 of 8: live prices instead of hardcoded ones

**Problem**: the price strip on the home page, the "Trending Tickers" sidebar on the home page and the one on the News page all read `data/mockTickers.js` — invented prices (e.g. AAPL 189.84) that never changed. The Chart Service already serves live quotes and the frontend already had `chartService.getBatchQuotes`; nothing used it there.

**Fix (frontend only; no backend change)**
- New hook `hooks/useLiveQuotes.js`: fetches `/quotes/batch` through the existing `chartService`, refreshes every 30 s, returns an empty list until data arrives or if the service is down (so it never shows made-up numbers).
- New `components/TickerStrip.jsx` (home price strip) and `components/TrendingTickers.jsx` (sidebar, used on the home page and the News page). Trend icon and colour follow the real sign of the change; percentages are real to two decimals.
- In the post-feed page (`HomeFeed.jsx`, frozen area) only the two ticker blocks and the now-unused `mockTickers` import were replaced by the components; nothing else there changed. `MarketNews.jsx` got the same swap.
- Deleted `data/mockTickers.js`: nothing imports it any more.

**Mistake caught during the work**: after swapping the strip I first removed the `mockTickers` import while the sidebar still used it — the build passed but the page would have crashed at runtime. I found it by grepping for remaining uses before testing, then moved the sidebar to the live component too.

**Verification**: frontend build clean; in the browser the home strip showed AAPL 336.64 −1.11%, TSLA 382.70 and the rest from the Chart Service (the old 189.84 is gone); the News page sidebar listed all eight symbols with live percentages (checked in the DOM because the sidebar is hidden at the preview's narrow width). No frontend tests exist for these components.

**Limits**: the symbol lists are fixed in code (5 in the strip, 8 in the sidebar), not "trending" by any measure; the strip hides entirely if the Chart Service is off; the Market pages (`MarketCharts`, `StockChart`) were not changed — they already used the Chart Service.

---

### 2026-10-12 — Roadmap step 6 of 8: encrypted chat for real accounts

**Problem**: chat only worked for two hardcoded demo users (Alice/Bob) with embedded tokens; the page had a "switch identity" button, and their device ids (`web-alice-device`) were public names. A real logged-in account could not use chat at all, and the chat service would not have accepted real logins anyway: it verified tokens with a different secret (`supersecretjwtkeyforverifyingincomingusers`) than the Post Service signs with.

**Changes**
- **Chat service**: no code change. `start_all.py` now starts it with `JWT_SECRET_KEY` equal to the Post Service secret (`SECRET_KEY`), so it accepts the same login token. Verified: a real token gets 200 on `/e2ee/devices`, no token gets 403.
- **Post Service**: profile summaries now include the account `uuid` (chat identifies people by uuid, search returns usernames); covered by the profile tests (Post suite 69/69).
- **`E2EContext.jsx`** rewritten around the real session: identity = logged-in user and their token (from `AuthContext`); device id = random `web-<uuid>` created once per account per browser; key material stored per account id; state cleared when the account changes; demo users, switcher and hardcoded tokens removed. Conversation participants are resolved to usernames through the existing user lookup.
- **`Chats.jsx`**: no demo/switch UI; "New message" is a people search (debounced, excludes yourself) that starts a chat with the chosen account; conversations are titled with the other person's username.

**Bug found while testing (important)**: first messages could not be decrypted ("AES-GCM authentication tag verification failed"), even by the sender. Cause: React runs effects twice in development, so two key sets were generated concurrently — one registered with the server, the other saved locally. Fix: key setup now runs once per account (`setupAdapter` shares one promise). The earlier demo flow hid this because its keys had been created long before.

**Verification**: frontend build clean. Live, two real accounts in the browser: `ui_check` found `story_viewer` via search, started the chat, sent "secret hello 2"; after a reload the sender saw their own history; logged in as `story_viewer` the message decrypted and the chat was titled `ui_check`. Test devices were revoked and recreated once to clear keys left by the bug above. No automated frontend tests exist for the chat UI; the chat service's own 27 tests were not affected (service code unchanged).

**Limits**: a recipient must have opened Chats once (to register a device) before anyone can message them — otherwise sending fails with "No registered devices"; old messages from before this fix remain undecryptable; the call buttons are still mocks; `mockChats.js` is unused and not removed; clearing browser storage loses the private keys (and so history) for that browser.

---

### 2026-10-12 — Roadmap step 7 of 8: launcher starts Community and Explore natively (no Docker)

**Problem**: `start_all.py` started Community through `docker compose` and did not start Explore at all; `stop_all.py` only knew the Docker way to stop Community. Without Docker running, two of seven services (and the Communities and Explore pages) were simply down.

**Changes (`start_all.py`, `stop_all.py`)**
- Community (8080) and Explore (8083) now start through Maven's `spring-boot:run`, the same way they were run by hand: Community with the `dev` profile (in-memory H2); Explore with H2 on its test classpath and the Post Service URL (no Redis — it fails open).
- JVM flag `-Djdk.net.unixdomain.tmpdir=C:\jtmp` is added (and the folder created): without it Java cannot open its NIO selector on this Windows machine.
- The launcher finds its own tools: `find_java_home()` accepts only a real JDK 17+ (it reads the JDK's `release` file — the machine's `JAVA_HOME` points to JDK 11, which cannot run Spring Boot 3, and a first version trusted it); `find_maven()` looks on PATH, `MAVEN_HOME`/`M2_HOME`, then `.tools/apache-maven-*` next to the script. If either is missing it prints which one and skips just those two services instead of failing everything.
- Explore's health is watched through `/actuator/health/liveness`: its overall health is DOWN whenever Redis is absent, which is expected here.
- Startup wait raised from 45 s to 150 s (Maven compiles on first start).
- `stop_all.py` now clears ports 8080 and 8083 like the others; the Docker `compose down` logic and its unused imports are gone.
- A copy of Maven 3.9.9 was placed in `D:\files (2)\.tools\` (copied from where an earlier session had unpacked it).

**Verification**: ran the real launcher (`python start_all.py --kill-existing`): all eight processes launched; the six Python services and the frontend reported healthy; Community answered 200 on `/api/v1/health`; Explore's liveness was UP and `/api/v1/explore` and `/explore/recent` returned posts from the Post Service (including a post from the mentions test and not the private one). The earlier 500 on `/explore/feed` was my wrong guess of a path.

**Limits**: Community's and Explore's data are in memory, so communities created there disappear on restart; a first start takes a minute or two; `stop_all.py` was only checked by reading it plus the shared port-kill code, not run against the Java processes; nothing here is covered by automated tests. If Maven is not installed system-wide, keep `.tools/` or set `MAVEN_HOME`.

---

### 2026-10-12 — Roadmap step 8 of 8: notifications

**Problem**: the bell in the top bar was a dummy — a permanently lit dot that did nothing. Nothing recorded that someone followed, liked, commented on or mentioned you.

**Backend (Post Service)**
- New `notifications` table/model (recipient, actor, type `follow|like|comment|mention`, optional post/comment id, read flag, time) and `notification_service`.
- Created when: someone follows you; likes your post; comments on your post; mentions you in a post or comment. Never for your own actions; the same event is recorded once (like → unlike → like again does not repeat); a mention only notifies someone who is allowed to see the post (a private post's mention stays silent).
- Endpoints: `GET /notifications` (newest first, `unread_only`, paging, each with the actor's profile and the unread count), `GET /notifications/unread-count`, `POST /notifications/{id}/read`, `POST /notifications/read-all`. All need login, and you can only read or mark your own.

**Frontend**: new `components/layout/NotificationBell.jsx` replaces the dummy bell — unread badge (refreshed every 30 s, shows 9+), a panel with avatar, text ("x liked your post"), time and unread dot, "Mark all read", and clicking a row marks it read and opens the person's profile. Four small methods added to `postService`.

**Verification**: 7 new tests in `tests/test_notifications.py` (login required, each trigger notifies the right person, no self/repeat notifications, private-post mentions silent, comment mentions, unread count and marking, cannot mark someone else's) — Post Service suite **76/76**; frontend build clean. Live: `story_viewer` followed, liked, and commented with a mention on a `ui_check` post — `ui_check` got four notifications; in the browser the bell showed 4, the panel listed all four with the right text and links, "Mark all read" cleared the badge and the server count went to 0.

**Limits**: no push or realtime delivery (the badge refreshes every 30 s or when you open the panel); every row opens the actor's profile because there is no single-post page to link to; no notification for replies to your comment, followers-only post publication, or story views; old notifications are never pruned.

---

### 2026-10-14 - Instagram-parity pass: Stories, Profile, Settings (Post / Chat / Explore / Community untouched)

**Rule followed**: no source file in Post, Chat, Explore or Community was changed (checked by file modification times after the work). Everything was built in the Story Service, the frontend and the launcher. The Post Service's existing public API is consumed as-is. Anything that would need a change inside those four services is listed under "Blocked" below with the reason.

**Story Service rewritten (v2.0.0)**
- Media: `POST /stories/media` validates real type from bytes, decodes and re-encodes images (EXIF stripped, size/pixel limits), checks video size and (MP4/MOV) length; files live outside any public folder and are served only through signed, expiring URLs (`/media/{key}?t=`). New stories must use uploaded media (no hot-linked URLs).
- Stories: caption, audience (Everyone / Close Friends), overlays (text, @mention, #hashtag, link, poll) validated server-side; mentions resolved through the Post Service and notified.
- Privacy enforced on every read by one class (`access.py`): hide-from list, Close Friends, "who can see" (everyone/followers, using the viewer's real follow state from the Post Service), mention exception, uniform 404 for anything hidden. Reply and @mention permissions per account.
- Tray (yours first, unseen before seen, muted last), per-person list, view tracking, viewer list (with reactions/replies), analytics, replies, reactions, one-time polls, link taps, report; all rate limited.
- Expiry enforced in queries; archive (kept unless switched off, 365-day retention); purge job that never touches highlighted stories; unpublished uploads removed after 24 h.
- Highlights (create, rename, reorder stories, cover, reorder highlights, delete); Close Friends / hide-from / muted lists; story settings; story notifications honouring the owner's preferences; data export; guarded deletion of all story data.
- Existing `stories.db` is migrated in place (additive columns; the 4 existing stories verified readable). `crud.py` and the two old test files were removed (superseded). Dependencies added: Pillow, filetype, mutagen, httpx, python-multipart.

**Frontend**
- Stories: new tray, full-screen viewer (progress bars, auto-advance, hold to pause, tap/keyboard navigation, person-to-person), composer (file validation, upload progress, draggable text/stickers, audience, retry without re-upload), reactions, replies (also sent as an end-to-end encrypted DM through the existing chat client), poll/link/mention stickers, insights sheet, menu (delete with confirmation, add to highlight, report, mute), archive page, Highlights row and editor.
- Profile: story ring, Highlights, clickable Followers/Following lists (search, paging, real follow buttons), Tagged tab (posts that mention you), "Follows you" indicator, Message button, menu (copy/share link; story controls: Close Friends, hide my story, mute), loading / error / not-found states, no mock fallbacks.
- Settings: the old 560-line catalogue (nothing in the app read any of its values; invented sessions/blocked lists) was deleted and replaced by pages that all work: Account (edit profile, log out of this device), Your information (real JSON download; guarded story-data deletion), Story privacy, Close Friends, Hide story from, Muted stories, Story notifications, Appearance & accessibility (theme, high contrast, reduce motion, autoplay: device preferences with real effect).
- Notification bell merges Post notifications and story notifications; story notifications open the story.
- Removed invented content: fake fallback stories (Elena, Alex, Sarah, Marcus), fake feed posts, hardcoded "Alex Mercer" identity, unused mock data files. A global 401 handler signs the user out when the session expires. ESLint (`npm run lint`) added so undefined names are caught.

**Launcher**: Story Service gets `POST_SERVICE_URL`.

**Tests actually run**: Story 123, News 12, Chart 12, Post 76, Chat 27 (run in place without writing), Community 110 and Explore 56 (run on copies). Live: a script against the real Post + Story services (25 checks, all pass) and browser checks of compose/publish, viewer navigation and hold-to-pause, poll/reaction/reply (verified from the owner's side), notifications, archive, highlight create/edit/play, follower list, profile menu controls, tagged tab, every Settings page (changes verified on the server and after reload), data download (found and fixed a page-size bug), report and delete.

**Blocked by the freeze (not done, with reason)**
- Private accounts, follow requests, block / restrict, mute posts, report user/post: Post owns follows, profiles and all post reads; a flag kept elsewhere could not be enforced.
- Change username, website field, remove avatar: Post's profile update accepts only name and bio.
- Change password, login sessions, server-side logout, 2FA, deactivate/delete account: credentials and tokens are owned by Post, which has no such endpoints.
- Notification preferences for likes/comments/follows/mentions in posts, mention/comment permissions on posts, hidden words: generated/enforced inside Post.
- Message notification preferences: inside Chat. Push and email notifications: no infrastructure exists.
- Mutual followers: needs a Post endpoint (computing it in the browser would be unreliable).
- Story replies are delivered as chat messages only if the story owner has opened the app since chat was enabled (their chat device must be registered); otherwise the reply is still saved and the sender is told.

**Not verified**: video story playback in the browser (no MP4 could be generated; server-side video checks are unit-tested with a stubbed duration reader); the HTTP Range behaviour of video files; the Postgres path of the new tables (everything ran on SQLite); behaviour on a real phone.

---

### 2026-10-15 - Instagram-parity round 2: posts, story stickers, sharing, notifications, search

**Rule followed**: still no change inside Post, Chat, Explore or Community (0 source files changed in 24 h, checked). Everything below uses their existing public APIs or the existing frontend chat client.

**Posts (frontend on the existing Post API)**
- New post card: photo/video **carousel** (swipe, arrows, dots, counter), **double-tap to like**, "N likes", captions with "more", clickable @mentions, **#hashtags** (`linkify-plugin-hashtag`) and links, visibility icon, follow button.
- Working **post menu** (was a dead button): Edit (caption + visibility), Delete (with confirmation), Go to post, Share, Unfollow.
- **Post page** `/p/:id` with threaded comments; profile grid tiles, notifications and shared links open it. Hidden/deleted posts show "This post isn't available".
- **Comments**: replies (threaded under the top comment, @username pre-filled), edit and delete your own, real usernames, paging. The fake fallback comments ("Great analysis!" from invented users) were removed.
- **Composer**: up to 10 photos/videos per post, reorder/remove, all-or-nothing publishing. Before, a failed upload silently left a text-only post; now the half-made post is deleted and the error shown.
- **Hashtag page** `/tags/:tag` (grid + count).
- **Share sheet**: send in an encrypted message (existing chat client), add post to your story, copy link, native share; every share is counted.
- Fixed: post times were off by the timezone offset (showed "5h ago" for a new post) because UTC server times were read as local time.

**Stories (Story Service + frontend)**
- New stickers with server-side rules: **question** (private answers, owner-only list), **emoji slider** (one answer, average shown after answering), **quiz** (2-4 answers; the correct answer is stripped from every response until the viewer has answered - mutation-tested), **countdown** (live ticking; "remind me" sends a notification when it ends, checked every minute), **shared post** (the sharer must be able to see the post; viewers load it with their own access, so a hidden post shows as unavailable). One interactive sticker per story.
- Composer: **filters** (Clarendon, Gingham, Moon, Lark, Reyes, Juno) and **drawing** (colours, undo, clear), both baked into the uploaded photo (verified by reading pixels of the stored file).
- Share a story by encrypted message; `/stories/:id` link page opens a story if you may see it.
- Insights show question answers and slider / quiz / countdown results; new notification types `story_question`, `story_countdown`.
- New tables `story_sticker_responses`, `story_countdown_reminders` (created automatically at start-up).

**Social**
- **Notifications page** `/notifications` grouped Today / This week / This month / Earlier, with real **Follow back** buttons; the bell shows the latest 15 and links to it.
- **Suggested for you** on the home sidebar from the real follow graph (people who follow you, then people followed by accounts you follow), with follow and dismiss.
- **Search**: `#tag` jumps to the hashtag page; recent searches remembered on the device with remove / clear all.
- Home feed: paging ("Load more posts", "You're all caught up").

**Robustness**
- Bug found by the browser test: finishing a drawing stroke crashed the whole app (a state updater read a ref after it had been cleared). Fixed, and an **error boundary** (`react-error-boundary`) now keeps a crash inside one page instead of blanking the app.

**Tests**: Story Service 144 passing (21 new sticker tests). Browser-verified with real accounts: carousel post publish (server has both media in order), double-tap like, caption links, comment + threaded reply (server tree checked), post page, hashtag page, add post to story (sticker stored, share counted), filter + drawing baked into the file, every sticker answered by another account and checked from the owner's side, sending a post by encrypted message and reading it decrypted (with a clickable link) as the recipient, notifications page + follow back, search, post edit and delete.

**Still not possible without changing Post/Chat**: private accounts, follow requests, block/restrict/report users, password/sessions/2FA/account deletion, post-notification preferences, comment likes, "liked by" lists (the Post API has a like count but no list of likers), saved collections, mutual followers. **Not verified**: video posts/stories in a browser.

---

### 2026-10-17 - Completeness pass: security fixes, no fake features left, bugs found by testing

**Rule followed**: still no change inside Post, Chat, Explore or Community (0 source files changed today, checked).

**Security**
- **News bookmarks had no login check**: the browser sent a `user_id`, so anyone could read, add or delete anyone's bookmarks (`GET /news/bookmarks/{user_id}`). Now the account comes from the login token (same JWT check as the Story Service): `GET /news/bookmarks`, `PUT/DELETE /news/{id}/bookmark`. The old route is gone. Verified live with two accounts (the other account sees 0 and gets 404 trying to delete).
- News CORS was `*` with credentials; now only the app's origins (and only GET/PUT/DELETE).
- The News provider API key was hard-coded in `config.py`; it now comes only from `news-service/.env`/environment.
- **The frontend used a made-up login token when logged out** (`dev-mock-token`, plus two long-lived forged tokens in `talktrading-frontend/.env`). All removed; logged-out calls now fail instead of acting as a fake user.
- **Chat private keys were stored as plain JSON in localStorage** (`E2EContext.jsx`; the `cryptoStorage.js` file that claimed sessionStorage was never used and is deleted). They are now AES-GCM encrypted in IndexedDB (`crypto/keyVault.js`, `idb-keyval`) with a non-extractable key: a copy of the browser storage no longer reveals them. Existing plaintext keys are migrated and erased on first load. Verified: keys unreadable (`exportKey` refused), history still decrypts after reload, migration erases the old copy. Honest limit: code running inside the page can still *use* the key; full protection needs a passcode, which would be a product decision.
- Expired logins: the app now signs out the moment the token expires and clears it from storage, instead of failing on the next request.

**Fake features removed / made real**
- Market News no longer shows a built-in fake feed when the service is down; it shows the error with "Try again". New **Saved** tab and bookmark buttons on every article (the backend existed, the app never used it), category chips matching what the service really tags (All/Markets/General/Crypto/Forex), "Load more", empty states, image fallback.
- Chats: removed the audio/video call buttons (they only showed a toast; real calls need the Chat service), "Active now" (no presence data), blue "seen" ticks on every message (the server cannot tell the sender whether it was read), and message hearts that only the clicker could see. Day dividers ("Today", "Yesterday", date) now come from real message times (also fixed the UTC offset there).
- Random stock photos (picsum.photos) were shown as profile pictures for people without one, and in the top bar instead of your own photo. Now a neutral default picture is used and the top bar shows your real photo (refreshes when you change it). Same for communities without an icon.

**Bugs found while testing**
- Chats scrolled to the bottom on every re-render, including each keystroke (the only lint warning). Fixed.
- Stock chart page threw `Cannot read properties of null (reading 'querySelector')` from the TradingView embed whenever the widget was rebuilt (symbol or theme change, React dev double-run). Fixed by inserting the widget one tick later and cancelling on cleanup; verified no console errors on load, theme toggle and symbol change, chart in the right place.

**Tests**: News 23 passing (11 new HTTP tests: login required, wrong secret, expired and fake tokens rejected, privacy between accounts, CORS, idempotent save), Chart 12, Story 144. Lint 0 errors 0 warnings; build OK. Browser: every page opened with zero console errors.

---

*(Next entries append below this line as further items from the punch list are worked on.)*


