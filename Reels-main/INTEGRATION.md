# Reel Microservice Integration Guide

This document describes how an external application (web frontend, mobile app, or backend service) integrates with the **Reel Microservice**.

---

## 1. Architectural Overview & Boundaries

The Reel Microservice is designed as an autonomous, decoupled microservice:
- **No Shared Database**: The Reel Microservice manages its own database (SQLite locally, PostgreSQL in staging/production). The main application should never query the Reel database directly.
- **No Shared Code or Runtime**: Communication occurs strictly over standard HTTP REST APIs (`/api/v1`).
- **No Video Storage on this Service**: This service does **not** handle raw binary multipart video uploads, video encoding, or transcoding pipelines. Video assets are hosted on an external Object Storage / CDN (e.g., AWS S3, Cloudflare R2, Google Cloud Storage). Only public or CDN URLs and media metadata are stored in this microservice.

---

## 2. Authentication & User Identity

### A. How the Main App Passes User Identity
Authentication is **stateless JWT-based**:
1. When a user logs into your main application, your primary Authentication Service generates a JWT signed with a shared secret (`JWT_SECRET_KEY`).
2. The client or backend passes this token in the standard HTTP header:
   ```http
   Authorization: Bearer <JWT_TOKEN>
   ```
3. The Reel Microservice verifies the cryptographic signature of the token using `JWT_SECRET_KEY` and algorithm `JWT_ALGORITHM` (`HS256`).
4. **Header Spoofing Protection**: The microservice does **not** trust unverified headers such as `X-User-Id` or `X-Authenticated-User`. User identity is extracted exclusively from the decoded JWT payload claims:
   - `sub` (or `user_id`): The persistent unique identifier of the user (e.g., UUID or string).
   - `roles`: An optional list of strings, e.g. `["user", "creator", "admin"]` or `["admin"]`.
   - `email`: Optional user email address.

### B. Anonymous vs. Authenticated Feed Browsing
- The feed endpoint `GET /api/v1/feed` supports anonymous browsing. If no `Authorization` header is present, public reels are returned without error.
- If a valid `Authorization: Bearer <token>` is provided, the feed automatically personalizes each reel item by populating `is_liked` and `is_bookmarked` for the calling user.

### C. Service-to-Service (S2S) Internal Communication
Internal administrative actions (such as automated content takedowns from an AI moderation worker or an admin dashboard) authenticate using a dedicated API key rather than a user JWT:
- **Header**: `X-Service-API-Key: <SERVICE_API_KEY>`
- **Constant-Time Verification**: Validated using constant-time comparison (`secrets.compare_digest`) to prevent timing side-channel attacks.

---

## 3. End-to-End Media Flow

```
[ Mobile / Web Client ]       [ Main App Backend / S3 ]       [ Reel Microservice ]
         |                                |                            |
         | 1. Request presigned upload    |                            |
         |------------------------------->|                            |
         | 2. Returns S3 Presigned URL    |                            |
         |<-------------------------------|                            |
         |                                |                            |
         | 3. PUT raw video file directly |                            |
         |------------------------------->| (Object Storage / CDN)     |
         |                                |                            |
         | 4. POST /api/v1/reels (with CDN video_url & metadata)       |
         |------------------------------------------------------------>|
         |                                |                            |
         | 5. 201 Created (Reel Registered)                            |
         |<------------------------------------------------------------|
```

### Video Upload Integration Responsibilities:
- **Client / Main App**: Uploads video bytes to S3/GCS/R2 and runs thumbnail generation or FFmpeg transcoding if desired.
- **Reel Microservice**: Registers the metadata (`video_url`, `thumbnail_url`, `duration`, `width`, `height`, `aspect_ratio`, `mime_type`, `caption`, `tags`) and manages the feed, likes, bookmarks, and comments.

---

## 4. Cross-Origin Resource Sharing (CORS)

For web frontends (e.g. Next.js, React, Vue, Svelte):
Configure `BACKEND_CORS_ORIGINS` in `.env`:
```bash
BACKEND_CORS_ORIGINS=["https://myapp.com", "https://staging.myapp.com", "http://localhost:3000"]
```
All standard methods (`GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`) and headers (`Authorization`, `Content-Type`, `X-Service-API-Key`) are permitted.

---

## 5. Standard Error and Response Formats

### Successful Response Format
All JSON responses follow a uniform wrapper:
```json
{
  "success": true,
  "message": "Optional descriptive status message",
  "data": { ... }
}
```

### Error Response Format
```json
{
  "success": false,
  "message": "Description of the error",
  "data": null
}
```

### Common HTTP Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Entity created (e.g., Reel, Comment, Campaign, Report).
- `400 Bad Request`: Invalid request data or domain rule violation.
- `401 Unauthorized`: Missing, invalid, or expired JWT token.
- `403 Forbidden`: Authenticated user lacks permission (e.g., editing someone else's reel, non-admin viewing reports queue).
- `404 Not Found`: Reel, comment, or resource does not exist.
- `422 Unprocessable Entity`: Request body failed Pydantic schema validation.
- `429 Too Many Requests`: Client exceeded the rate limit threshold (default: 120 req/min).
