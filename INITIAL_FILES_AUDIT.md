# Audit of the Original Four Services

**Scope**: the four zips as received — `community-main`, `E2E_-main` (chat), `Explore-main`, `post-service-feature-post-module (1)`.
**Date**: 2026-10-13. **Method**: extracted into a scratch folder (nothing in the project was changed by this audit), read the code, ran each service's own test suite, and ran the Post Service's login to confirm the biggest suspicion.
**Confidence labels**: **[ran]** = I executed it and saw the result; **[code]** = read directly from the source, not executed.

---

## 1. Verdict at a glance

| Service | Own tests | Does it work as a product? | Biggest problem |
|---|---|---|---|
| **Post Service** (Python/FastAPI) | 28 / 28 pass **[ran]** | Posts, comments, likes, saves, shares, media, hashtags, feed work *if you already hold a token*. **Signup and login are broken.** | Register/login return HTTP 500; the token it would issue is rejected by its own routes **[ran]**. Private posts readable by anyone **[ran]**. |
| **Chat / E2E** (Python/FastAPI) | 26 / 26 pass **[ran]** | Device registration, key bundles, encrypted message relay, WebSocket delivery work. | Anyone can add anyone to a conversation; several server checks are missing (section 4). Default JWT secret. |
| **Community** (Java/Spring Boot) | 110 / 110 pass **[ran]** | Communities, membership roles, posts, comments, votes, likes, search, feeds, media all work. | **No authentication at all**: the caller says who they are in an `X-User-Id` header, and with no header they become user 1 **[code]**. |
| **Explore** (Java/Spring Boot) | 56 / 56 pass **[ran]** | Ranking and endpoints are well structured, but against the real Post Service it returned an **empty feed** (see 5.2). | Trusts `X-User-Id` from "a gateway" that does not exist; unauthenticated actuator/metrics. |

**Important**: green tests do not mean the system works. Each service passes its own tests while being unable to work with the others: the Post tests use integer tokens that the Post login never produces; Explore's tests mock the Post Service instead of calling it; chat's tests use generated tokens.

---

## 2. Problems that affect the whole system (fix these first)

| # | Problem | Why it matters | Needed change |
|---|---|---|---|
| X1 | **Four different identity schemes.** Post: integer in token claim. Chat: UUID in `sub`. Community and Explore: integer in an unauthenticated `X-User-Id` header. | A person has no single identity across services; Community "user 7" has nothing to do with Post "user 7". | One account system issues one JWT (`sub` = UUID). Every service verifies that token; integers (if still needed) are derived from it the same way everywhere. *(Done in the project copy for Post/Story/Chat: UUID `sub`, shared secret, derived integer author id. Community and Explore still use the header.)* |
| X2 | **No gateway and no real login in front of Community/Explore**, although their code says "internal service behind the gateway". | The "trusted header" is trusted by anyone who can reach the port. | Either add a gateway that verifies the JWT and sets the header (and block direct access to the services), or make each service verify the JWT itself. The second is simpler for this project. |
| X3 | **Default secrets committed in the repo**: `super_secret_jwt_key_change_in_production` (Post, in `config.py`, `.env.example`, `docker-compose.yml`), `supersecretjwtkeyforverifyingincomingusers` (Chat), `postgres/postgres`, `post_user/post_password_secret`. | Anyone who has the code can forge a valid token for any user. | Remove defaults; the service must refuse to start in production without a real secret; load secrets from the environment/secret store; rotate the ones already committed. |
| X4 | **Two secrets that should be one**: Post and Chat use different JWT secrets, so a real login is rejected by Chat. | Chat unusable for real accounts. | Same secret (or, better, asymmetric keys: Post signs, others verify with the public key). *(Launcher now sets it in the project copy.)* |
| X5 | **No rate limiting** on Post (login, posting, likes) and Community/Explore. Chat has a Redis limiter that silently turns off if Redis is down. | Brute-force, spam, scraping. | Add a limiter (e.g. `slowapi` for FastAPI, Bucket4j/Resilience4j for Spring) and decide fail-open vs fail-closed for Chat. |
| X6 | **Duplicate social features**: Community has its own users, follows, posts, likes; Post has its own. | Two sources of truth; follower counts and profiles disagree. | Decide which service owns users/follows/profiles; the other should call it. |
| X7 | **Schema management is inconsistent**: Post/Chat rely on Alembic but have no way to create the tables on a fresh database (Post's `main.py` says "via Alembic"; Chat has no `create_all`); Community uses `ddl-auto=update` (unsafe in production); Explore uses Flyway (good). | Fresh install fails or drifts. | One approach per service: Alembic/Flyway migrations run at deploy time; no `create_all`/`update` in production. |
| X8 | **Swagger/docs open**, `include-binding-errors: always` / `include-message: always` (Community), actuator `show-details: always` plus `metrics`/`prometheus` exposed (Explore). | Information disclosure (internal URLs, disk paths, schema details). | Disable or protect in production; return generic errors. |
| X9 | **CORS**: Chat allows `*` together with credentials; Community has a fixed origin list (fine); Explore configures none. | Chat is callable from any website; Explore calls from a browser fail unless something else adds CORS. | Explicit origins everywhere. |

---

## 3. Post Service

### Working **[ran / code]**
Posts (create/read/update/soft-delete), nested comments, likes (with counters in one transaction), saves, shares, hashtags (extracted and linked), media upload (extension + MIME + size + magic-byte check, path-traversal-safe local storage), home feed, pagination caps (`limit ≤ 100`), correlation-id logging, 28 tests.

### Broken / missing
| # | Finding | Evidence | Severity |
|---|---|---|---|
| P1 | **Register and login crash (HTTP 500).** `auth_service` queries `User`, but `models/user.py` is a plain Pydantic class ("Post Service does NOT own a users table"), not a database model. | Ran it: register 500, login 500 **[ran]** | Critical (no one can sign up) |
| P2 | **Even if login worked, its token would be rejected.** Login puts the *email* in `sub`; every protected route requires an *integer* there. | Hand-made email-sub token → 401 "must be a valid canonical integer user ID" **[ran]** | Critical |
| P3 | **Private and followers-only posts were readable by anyone**: post detail (even logged out), list, search; strangers could like/comment/save/share them. Visibility was only enforced on the home feed and hashtag pages. | Found and reproduced with two real users earlier; fixed in the project copy. | High |
| P4 | **Media files are public regardless of post visibility.** Uploads are served by an open static mount (`/static/uploads/<uuid>.<ext>`); a private post's image is readable by anyone who has the URL. | `main.py` static mount **[code]** | Medium |
| P5 | **Upload is read fully into memory before the size check** (`await file.read()` then compare) so a huge upload can exhaust memory; no image re-encoding. | `media_service.py` **[code]** | Medium |
| P6 | **Following/mention features are stubs**: the "following" feed and `@mention` resolution call a `USER_SERVICE_URL` (`http://user-service:8000`) that does not exist, so they silently return nothing; mentions were never stored. | `integrations/user_client.py`, `feed_service.py` **[code]** | High (missing feature) |
| P7 | **No users, profiles, follows, search, notifications.** | No such code | High (missing feature) |
| P8 | **No rate limiting; no password rules; duplicate email/username not handled** (would be a 500 on the unique violation). | `auth_service.py` **[code]** | Medium |
| P9 | **Dead and broken legacy files**: `app/api/{bookmarks,comments,likes,posts,users,dependencies,health}.py` are duplicates of `routes/*` and not mounted; `users.py` imports `get_current_user`, which does not exist; `database/fake_db.py` is empty. | **[code]** | Low (confusing for new developers) |
| P10 | CI pins Python 3.9 while the rest of the stack uses newer versions; `/docs` open in production. | `ci.yml`, `main.py` | Low |

### Changes needed
1. Add a real `users` table (id UUID, unique username, unique email, hashed password, created_at) and make signup/login use it; put the user's UUID in `sub`; hash with bcrypt (already there); return 409 on duplicates; basic password rules.
2. Make protected routes read the UUID `sub` (or derive the integer id from it in one place).
3. Apply one visibility rule everywhere (public / followers / private) and protect media for non-public posts (signed URLs or an authenticated media route).
4. Stream uploads with a size limit instead of reading all into memory.
5. Own the social graph here (follows, profiles, search) or call the service that does; delete `USER_SERVICE_URL` stubs.
6. Delete the dead legacy files; add rate limiting; remove default secret.

*(Items 1–2, 3 (posts only), 5 and several features were done in the project copy; P4, P5, P8 rate limiting, P9, P10 are still open there.)*

---

## 4. Chat / E2E Service

### Working **[ran / code]**
Server stores **public keys only** (identity, signed prekey, one-time prekeys); signed-prekey signature verified on registration and rotation; per-device ciphertext "envelopes"; the sender must be a participant to send; device must belong to the user to read; WebSocket delivery plus offline flush; typing and read receipts; Redis sliding-window rate limits; security headers; 26 tests.

### Findings
| # | Finding | Evidence | Severity |
|---|---|---|---|
| E1 | **Anyone can add anyone to a conversation** (1-to-1 or group) — no consent, no block, no check that the users exist. Spam/harassment vector. | `ChatService.create_conversation` **[code]** | High |
| E2 | **Read-receipt IDOR**: `mark_envelope_read` checks the caller owns the *device* but then marks *any* envelope id as read/delivered, not just the caller's. | `chat_service.py` → `chat_repo.mark_envelope_status(envelope_id)` **[code]** | Medium |
| E3 | **Sender device not verified**: `X-Device-Id` on send is taken as-is (default `"unknown-device"`) and is not checked to belong to the sender; envelopes may name devices that belong to nobody in the conversation. | `chat.py` send_message **[code]** | Medium |
| E4 | **Typing indicator can be spoofed**: `broadcast_typing` does not check the sender is a participant of that conversation. | `websocket_manager.py` **[code]** | Low |
| E5 | **One-time-prekey draining**: any logged-in user can fetch another user's bundle repeatedly; each call consumes one prekey per device (rate limited, but still a known X3DH denial-of-service); a 404 vs 200 also reveals whether a user has devices. Prekey replenish accepts an unbounded list. | `key_service.py`, `keys.py` **[code]** | Medium |
| E6 | **No ratchet**: the architecture doc says "Double Ratchet", but `crypto/engine.py` has X3DH + AES-GCM and no ratchet code, so there is no per-message forward secrecy / post-compromise security. | grep for "ratchet" in `engine.py` finds nothing; doc claims it **[code]** | Medium (claim vs reality) |
| E7 | Token is passed in the WebSocket **query string** (lands in logs); `json.loads` / UUID parsing errors on WebSocket messages drop the connection; no message-size limit; `GET messages` returns all envelopes (no pagination). | `chat.py` **[code]** | Low–Medium |
| E8 | Default JWT secret; CORS `*` with credentials; `Strict-Transport-Security` sent over plain HTTP; startup check uses `conn.execute("SELECT 1")` as a raw string (fails on SQLAlchemy 2; error is only logged); no table creation outside Alembic; `test_temp.db` committed. | **[code]** | Low–Medium |
| E9 | Rate limiter **fails open** if Redis is down (comment says intentional) and tries Redis on every request. | `rate_limit.py` **[code]** | Low |

### Changes needed
Require an existing user and (ideally) an accepted request/follow before a conversation starts; scope `mark_*_read` to the caller's own envelopes; verify the sender device belongs to the sender and every envelope device belongs to a participant; verify participant on typing events; cap prekey batch size and use constant responses for key lookups; either implement the ratchet or correct the docs; pass the token via a header or a short-lived WebSocket ticket; add pagination and size limits; remove the default secret and `*` CORS.

---

## 5. Community Service (Java)

### Working **[ran / code]**
Create/list/update/delete communities with OWNER / MODERATOR / MEMBER roles (owner cannot leave; only owner deletes; owner/moderator edit); join/leave; member list; role change; remove member; posts with types (TRADE_IDEA validated: entry/target/stop-loss logic); comments with replies; likes; up/down votes; feeds (global, following, per community, per user); search; media upload (extension + content-type + size, path-traversal-safe storage); consistent error responses; 110 tests.

### Findings
| # | Finding | Evidence | Severity |
|---|---|---|---|
| C1 | **No authentication.** `UserContextFilter` reads `X-User-Id` from the request and trusts it. **With no header, the caller silently becomes user 1.** Anyone can post, vote, delete a community or remove members *as any user* by sending that header. | `security/UserContextFilter.java`; no Spring Security anywhere **[code]** | **Critical** |
| C2 | `X-User-Roles` is also parsed and stored but never used — misleading, and dangerous if someone starts using it. | **[code]** | Low |
| C3 | **Posting into a community does not require membership**, and the community id is not validated to exist. | `PostServiceImpl.createPost` **[code]** | Medium |
| C4 | **Default profile is `dev`** (`SPRING_PROFILES_ACTIVE` defaults to dev) → in-memory H2 with the **H2 web console enabled**, SQL logging on; production Postgres defaults are `postgres/postgres`; `ddl-auto=update`. | `application.yml`, `application-dev.yml` **[code]** | High if deployed as-is |
| C5 | Error responses include messages and binding errors (`include-message/include-binding-errors: always`). | **[code]** | Low |
| C6 | Uploaded media validated by extension and client-sent content type only (no magic-byte check, unlike the Post Service); files are public at `/api/v1/media/files/*`. | `MediaServiceImpl` **[code]** | Medium |
| C7 | Own user/follow/post tables (see X6); profile `userId` in the body is checked against the header identity, which is itself unverified. | **[code]** | Design |
| C8 | No rate limiting; no private communities; no moderation of content; no pagination cap check performed in this audit. | — | Medium (missing) |
| C9 | **Frontend coverage is small**: the app only lists, creates, joins and leaves communities. Posting, comments, votes, member management have API but no screens. | project frontend | Feature gap |

### Changes needed
Verify a JWT (Spring Security resource server) and take the user id from it; delete the "default to user 1" fallback and the roles header; require membership to post and validate the community; default profile must be production-safe (no H2 console, no SQL logging, migrations not `update`); magic-byte check on uploads; rate limit; decide who owns users/follows (X6).

---

## 6. Explore Service (Java)

### Working **[ran / code]**
Explore feed, trending, popular, recent, by-hashtag; scoring by engagement/recency/likes/comments/views with configurable weights; per-user interest tracking via an interactions endpoint; Redis caching with jittered TTLs; circuit breaker and retry around the Post Service; correlation id; Flyway schema; health indicator for the Post Service; 56 tests.

### Findings
| # | Finding | Evidence | Severity |
|---|---|---|---|
| S1 | **Returned an empty feed against the real Post Service.** It asks for `visibility=PUBLIC`; the Post Service's values are lower-case (`public`), so every call got HTTP 422 and the circuit breaker's fallback silently returned an empty list. Its tests mock the client, so nothing caught it. | Found live; fixed in the project copy | High |
| S2 | **Post timestamps have no timezone** (`2026-09-29T16:09:39`) but the DTO expects an `Instant`, so deserialisation failed. | Found live; fixed in project copy | High |
| S3 | **Identity is the `X-User-Id` header** ("only the gateway sets it") — there is no gateway. In dev mode the `userId` query parameter is also accepted. | `SecurityUtils.java` **[code]** | High |
| S4 | **Actuator exposed with details**: `health` details always, plus `metrics` and `prometheus`, unauthenticated (leaks Post Service URL, disk path). Overall health reports DOWN whenever Redis is absent. | `application.yml` **[code]**, observed live | Medium |
| S5 | **No CORS configuration**, so a browser app on another origin cannot call it. | grep: none **[code]** | Medium (works only with a proxy) |
| S6 | **Interactions endpoint** accepts unlimited events per user (table growth, ranking manipulation); free-text `category`; no check the post exists. | `UserInteractionRequest`, controller **[code]** | Medium |
| S7 | Ignores the follow graph (no "from people you follow" boost) and cannot see followers-only posts; default Post Service URL is port 8000 (collides with the News service in this project); requires Redis and Postgres to run as designed. | **[code]** | Low–Medium |

### Changes needed
Verify the JWT itself (as Community); use the Post Service's real enum values and a tolerant timestamp parser (done in project copy) and add an **integration test against the real Post Service contract**; lock down actuator; add CORS; rate-limit and validate interactions; optionally add follow-aware ranking.

---

## 7. Prioritised work list for the developer

**P0 — before anything is exposed**
1. One real login (Post Service users table; UUID in `sub`) — fixes P1, P2, X1.
2. Community and Explore verify that JWT instead of trusting `X-User-Id` (C1, S3, X2); remove "default user 1".
3. Remove every default secret; fail startup without one (X3, X4); rotate committed ones.
4. Enforce post visibility everywhere, including media (P3, P4).

**P1 — security hardening**
5. Chat: consent/existence for conversations, scope read receipts, verify devices, participant check on typing (E1–E4).
6. Rate limiting on login, posting, key lookup, interactions (X5, E5, S6).
7. Community: membership required to post; production profile; upload magic-byte check (C3, C4, C6).
8. Lock down actuator/docs/error detail; explicit CORS (X8, X9, S4, S5).

**P2 — correctness and structure**
9. Decide ownership of users/follows (X6); migrations only (X7).
10. Explore ↔ Post contract test (S1, S2 must never regress).
11. Replace stubbed integrations (P6); delete dead files (P9); fix or document the Double-Ratchet claim (E6).
12. Streamed uploads (P5); pagination and size limits on chat (E7).

**P3 — product gaps**
13. Frontend screens for community posts/comments/votes/members (C9); follow-aware Explore (S7); notifications (done in project copy for Post).

---

## 8. What this audit did not do
- Did not penetration-test running services (Community's header impersonation and the Chat checks are from code, not live attacks).
- Did not review the frontend source beyond what is noted, nor dependency versions for known CVEs (run `pip-audit` / OWASP dependency-check as a next step).
- Did not check Docker images, the Postgres setup, or the CI pipeline beyond reading the files.
- Findings marked **[code]** should be confirmed by a test before a fix is accepted as complete.
