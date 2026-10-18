# TalkTrading Community Microservice

Production-ready Community microservice for TalkTrading combining Instagram social feeds & profiles, Reddit communities & voting, and trading-specific domain data (trade setups, price signals, symbols, and charts).

---

## Architecture

```
Frontend (React + Vite)
   ↓
Community REST API (/api/v1)
   ↓
Controllers (Spring MVC)
   ↓
Services & Domain Logic
   ↓
Repositories (Spring Data JPA)
   ↓
Database (H2 / PostgreSQL)
```

---

## Requirements

- **Java**: 23 (JDK 23)
- **Maven**: 3.9+ (or included `./mvnw` wrapper)
- **Docker**: Docker & Docker Compose v2+
- **Node.js**: 18+ (for dummy frontend)

---

## Run with Docker

To start the full stack (PostgreSQL 16 + Community Service + Persistent Volumes):

```bash
docker compose up --build
```

The microservice will be available at `http://localhost:8080`.

---

## Run Backend Locally

To run locally with the in-memory H2 database (`dev` profile):

```bash
# On Linux / macOS
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# On Windows PowerShell / CMD
.\mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=dev"
```

H2 Console available at `http://localhost:8080/h2-console` (JDBC URL: `jdbc:h2:mem:talktrading_community`).

---

## Run Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

The frontend will run at `http://localhost:5173`.

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Microservice port | `8080` |
| `SPRING_PROFILES_ACTIVE` | Active Spring profile (`dev` or `prod`) | `dev` |
| `POSTGRES_DB` | Database name | `talktrading_community` |
| `POSTGRES_USER` | Database username | `postgres` |
| `POSTGRES_PASSWORD` | Database password | `postgrespassword` |
| `DB_URL` | PostgreSQL JDBC connection URL | `jdbc:postgresql://localhost:5432/talktrading_community` |
| `STORAGE_TYPE` | Storage strategy (`local`) | `local` |
| `STORAGE_LOCAL_DIR` | Local directory for file uploads | `./uploads` |
| `CORS_ALLOWED_ORIGINS` | Permitted frontend origins | `http://localhost:5173,http://localhost:3000` |
| `VITE_API_BASE_URL` | Frontend target API URL | `http://localhost:8080` |

---

## Database

- **Local Development**: In-memory H2 database (`dev` profile) with auto schema generation.
- **Docker / Production**: PostgreSQL 16 container (`postgres` service) with persistent Docker volume `postgres_data`.

---

## Backend URL

`http://localhost:8080`

---

## Health Check

```http
GET /api/v1/health
```

Sample Response:
```json
{
  "status": "UP",
  "service": "community-service",
  "timestamp": 1789010000000
}
```

---

## Authentication / User Context

Authentication is handled via header injection:
- `X-User-Id`: User ID string/number (e.g., `X-User-Id: 101`)
- `X-User-Roles`: Optional user roles header (e.g., `X-User-Roles: ROLE_USER`)

If `X-User-Id` is omitted, the `UserContextFilter` defaults to User ID `1` for development convenience.

---

## API Documentation

- **Swagger UI**: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- **OpenAPI v3 JSON**: [http://localhost:8080/v3/api-docs](http://localhost:8080/v3/api-docs)

---

## Main Features

- **Communities**: Create, update, search, join/leave communities, update member roles.
- **Posts & Signals**: Publish posts across types (`CHART`, `MARKET_ANALYSIS`, `TRADE_IDEA`, `MARKET_OPINION`, `EDUCATIONAL`, `SCREENSHOT`, `VIDEO`) with price validation for trade setups (entry, target, stop loss, symbol, timeframe, direction).
- **Feed Engine**: Global feed sorted by `NEW`, `TOP`, or `HOT`, and personalized `Following` feed.
- **Comments**: Post root comments and nested threaded reply trees.
- **Likes & Voting**: Like/unlike posts and Reddit-style UPVOTE / DOWNVOTE scoring.
- **Global Search**: Search users, communities, and posts simultaneously.
- **User Profiles**: Manage bio, username, avatar, and follow/unfollow users.
- **Media Attachments**: Upload, delete, and serve media attachments (images/charts/videos).
- **Pagination**: Paginated responses (`PageResponse<T>`) across all listing endpoints.

---

## API Endpoints

| Category | Method | Endpoint | Description |
|---|---|---|---|
| **Health** | `GET` | `/api/v1/health` | Health status check |
| **Communities** | `POST` | `/api/v1/communities` | Create community |
| | `GET` | `/api/v1/communities` | List/search communities |
| | `GET` | `/api/v1/communities/{id}` | Get community by ID |
| | `PUT` | `/api/v1/communities/{id}` | Update community |
| | `DELETE` | `/api/v1/communities/{id}` | Delete community |
| | `POST` | `/api/v1/communities/{id}/join` | Join community |
| | `DELETE` | `/api/v1/communities/{id}/join` | Leave community |
| | `GET` | `/api/v1/communities/{id}/members` | Get community members |
| | `PUT` | `/api/v1/communities/{id}/members/{userId}/role` | Update member role |
| **Posts** | `POST` | `/api/v1/posts` | Create post/trade setup |
| | `GET` | `/api/v1/posts/{id}` | Get post by ID |
| | `PUT` | `/api/v1/posts/{id}` | Update post |
| | `DELETE` | `/api/v1/posts/{id}` | Delete post |
| | `GET` | `/api/v1/posts` | Get posts by user or post type |
| **Feed** | `GET` | `/api/v1/feed` | Get global feed (NEW/TOP/HOT) |
| | `GET` | `/api/v1/feed/following` | Get personalized following feed |
| | `GET` | `/api/v1/communities/{id}/posts` | Get community posts |
| | `GET` | `/api/v1/users/{id}/posts` | Get user posts |
| **Comments** | `POST` | `/api/v1/posts/{postId}/comments` | Add comment / reply |
| | `GET` | `/api/v1/posts/{postId}/comments` | Get post comments tree |
| | `GET` | `/api/v1/comments/{commentId}/replies` | Get comment replies |
| | `PUT` | `/api/v1/comments/{commentId}` | Update comment |
| | `DELETE` | `/api/v1/comments/{commentId}` | Delete comment |
| **Likes** | `POST` | `/api/v1/posts/{postId}/like` | Like post |
| | `DELETE` | `/api/v1/posts/{postId}/like` | Unlike post |
| | `GET` | `/api/v1/posts/{postId}/likes` | Get post likers list |
| **Voting** | `POST` | `/api/v1/posts/{postId}/vote` | Upvote/downvote post |
| | `DELETE` | `/api/v1/posts/{postId}/vote` | Remove vote |
| **User Profiles**| `POST` | `/api/v1/users` | Create user profile |
| | `GET` | `/api/v1/users/{id}` | Get user profile |
| | `PUT` | `/api/v1/users/{id}` | Update user profile |
| | `POST` | `/api/v1/users/{id}/follow` | Follow user |
| | `DELETE` | `/api/v1/users/{id}/follow` | Unfollow user |
| | `GET` | `/api/v1/users/{id}/followers` | Get followers list |
| | `GET` | `/api/v1/users/{id}/following` | Get following list |
| **Search** | `GET` | `/api/v1/search` | Search users, communities, posts |
| **Media** | `POST` | `/api/v1/posts/{postId}/media` | Upload post media |
| | `GET` | `/api/v1/posts/{postId}/media` | Get post media attachments |
| | `DELETE` | `/api/v1/posts/{postId}/media/{mediaId}` | Delete post media attachment |
| | `GET` | `/api/v1/media/files/{filename}` | Serve media file content |
