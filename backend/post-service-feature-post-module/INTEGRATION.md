# Post Microservice Integration Guide

This guide explains how to run, integrate, and communicate with the **Social Content & Post Microservice** in any developer's local environment or multi-container system.

---

## 1. Quickstart: Starting the Microservice

The Post Service is completely containerized and independent. No local Python, virtual environment, or local database installations are required.

```bash
git clone <repository-url>
cd post-service
copy .env.example .env
docker compose up --build
```

---

## 2. API Endpoints & Base URLs

Depending on where your caller application runs, use the appropriate base URL:

| Context | Base URL / Documentation | Purpose |
| :--- | :--- | :--- |
| **Host Machine (Browser / Postman / Mobile App)** | `http://localhost:8004/api/v1` | Interacting with the microservice from outside Docker |
| **Swagger UI Documentation** | `http://localhost:8004/docs` | Interactive OpenAPI documentation and endpoint testing |
| **OpenAPI Schema Specification** | `http://localhost:8000/openapi.json` | Programmatic API client generation |
| **Container-to-Container (Docker Network)** | `http://post-service:8000` | Inter-service HTTP REST communication within Docker |

---

## 3. Container-to-Container Docker Network Integration

When integrating your **Main Project** (or frontend/backend container) with the Post Service, you have two primary options:

### Option A: Shared Docker Network (Recommended)

Both containers communicate directly over Docker's internal network using high-speed DNS service discovery (`post-service`).

In your Main Project's `docker-compose.yml`, join the `post-network`:

```yaml
version: '3.8'

services:
  main-app:
    build: .
    environment:
      - POST_SERVICE_URL=http://post-service:8000
    networks:
      - post-network

networks:
  post-network:
    external: true
```

*Note: Start `post-service` first (`docker compose up -d`), which creates the `post-network` bridge network.*

### Option B: Host Binding Access

If your Main Project is running directly on the host machine (outside Docker), point your Main Project's configuration to the host binding:

```env
POST_SERVICE_URL=http://localhost:8000
```

---

## 4. Authentication & JWT Validation

The Post Service does **not** manage user credentials or logins. Authentication is delegated to the Main Project / Auth Microservice.

### Handling Authentication Requests
- The Auth/Main service issues a standard JWT token to signed-in users.
- When calling the Post Service, attach the token in the `Authorization` header:

```http
Authorization: Bearer <JWT_TOKEN>
```

### JWT Claims Structure
The Post Service decodes the JWT using the shared `SECRET_KEY` and extracts the canonical User ID from either the `sub` or `user_id` claim:

```json
{
  "sub": "101",
  "user_id": 101,
  "exp": 1757468400
}
```

---

## 5. Media Uploads & Static Media Access

- **Upload Endpoint**: `POST /api/v1/posts/media/upload` (accepts `multipart/form-data`)
- **Returned Storage Key**: `storage_key` and relative `url` (e.g. `/static/uploads/<filename>.jpg`)
- **Static Media URL**: When using local Docker storage, uploaded files are served statically at:
  - `http://localhost:8000/static/uploads/<filename>.jpg` (from host)
  - `http://post-service:8000/static/uploads/<filename>.jpg` (from other containers)

Uploaded media persists across container restarts via the `media_data` Docker volume.

---

## 6. Health & Readiness Monitoring

Integrate health checks in your load balancer or gateway:

- **Liveness Probe**: `GET http://localhost:8004/api/v1/health/live`
- **Readiness Probe (DB Check)**: `GET http://localhost:8004/api/v1/health/ready`

```json
{
  "status": "ready",
  "service": "Social Content & Post Microservice",
  "version": "1.0.0",
  "database": "healthy"
}
```
