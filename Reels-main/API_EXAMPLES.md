# Reel Microservice API Examples

This document provides copyable, tested examples using `curl` and `Python (requests)` for all key endpoints.

---

## 1. Environment & Setup Variables

```bash
# Set your environment variables for testing
BASE_URL="http://127.0.0.1:8000"
JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
SERVICE_API_KEY="dev_internal_service_key_reel_2026"
```

---

## 2. Health & Readiness Checks

### Liveness Check
```bash
curl -X GET "${BASE_URL}/api/v1/health"
```
**Response (200 OK):**
```json
{
  "status": "healthy",
  "app_name": "Reel Microservice",
  "environment": "development"
}
```

### Readiness Check (Live Database Ping)
```bash
curl -X GET "${BASE_URL}/api/v1/ready"
```
**Response (200 OK):**
```json
{
  "status": "ready",
  "database": "connected"
}
```

---

## 3. Reel Management

### Create / Register a Reel
```bash
curl -X POST "${BASE_URL}/api/v1/reels" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "Exploring breathtaking mountain peaks! #nature #travel",
    "tags": ["nature", "travel", "mountains"],
    "visibility": "public",
    "allow_comments": true,
    "allow_duet": true,
    "allow_sharing": true,
    "media": {
      "video_url": "https://storage.example.com/videos/mountains_1080p.mp4",
      "thumbnail_url": "https://storage.example.com/thumbnails/mountains_thumb.jpg",
      "duration": 42.5,
      "width": 1080,
      "height": 1920,
      "aspect_ratio": "9:16",
      "mime_type": "video/mp4"
    },
    "audio": {
      "title": "Mountain Wind",
      "artist": "Nature Beats",
      "audio_url": "https://storage.example.com/audio/mountain_wind.mp3",
      "duration": 42.5,
      "is_original": false
    }
  }'
```

**Python (requests):**
```python
import requests

url = "http://127.0.0.1:8000/api/v1/reels"
headers = {
    "Authorization": f"Bearer {jwt_token}",
    "Content-Type": "application/json"
}
payload = {
    "caption": "Exploring breathtaking mountain peaks! #nature #travel",
    "tags": ["nature", "travel"],
    "visibility": "public",
    "media": {
        "video_url": "https://storage.example.com/videos/mountains_1080p.mp4",
        "thumbnail_url": "https://storage.example.com/thumbnails/mountains_thumb.jpg",
        "duration": 42.5,
        "aspect_ratio": "9:16",
        "mime_type": "video/mp4"
    }
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

### Retrieve Single Reel
```bash
curl -X GET "${BASE_URL}/api/v1/reels/REEL_UUID_HERE" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Update Reel (Owner Only)
```bash
curl -X PUT "${BASE_URL}/api/v1/reels/REEL_UUID_HERE" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "caption": "Updated caption with more detail!",
    "allow_comments": false
  }'
```

### Delete Reel (Soft Delete - Owner or Admin Only)
```bash
curl -X DELETE "${BASE_URL}/api/v1/reels/REEL_UUID_HERE" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Record View
```bash
curl -X POST "${BASE_URL}/api/v1/reels/REEL_UUID_HERE/view"
```

---

## 4. Feed Consumption

### Paginated Public & Interleaved Ad Feed
```bash
# Anonymous request
curl -X GET "${BASE_URL}/api/v1/feed?page=1&page_size=10&include_ads=true"

# Authenticated request (populates is_liked and is_bookmarked flags)
curl -X GET "${BASE_URL}/api/v1/feed?page=1&page_size=10&include_ads=true" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

---

## 5. Interactions (Likes, Bookmarks, Shares)

### Toggle Like (Idempotent Toggle)
```bash
curl -X POST "${BASE_URL}/api/v1/reels/REEL_UUID_HERE/like" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```
**Response (200 OK):**
```json
{
  "success": true,
  "message": null,
  "data": {
    "reel_id": "REEL_UUID_HERE",
    "liked": true,
    "likes_count": 1
  }
}
```

### Toggle Bookmark
```bash
curl -X POST "${BASE_URL}/api/v1/reels/REEL_UUID_HERE/bookmark" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### Record Share Event
```bash
curl -X POST "${BASE_URL}/api/v1/reels/REEL_UUID_HERE/share" \
  -H "Content-Type: application/json" \
  -d '{"platform": "whatsapp"}'
```

---

## 6. Comments & Nested Replies

### Add Top-Level Comment
```bash
curl -X POST "${BASE_URL}/api/v1/reels/REEL_UUID_HERE/comments" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"content": "This timelapse looks incredible!"}'
```

### Reply to an Existing Comment
```bash
curl -X POST "${BASE_URL}/api/v1/reels/REEL_UUID_HERE/comments" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Which camera lens was used for this?",
    "parent_id": "PARENT_COMMENT_UUID_HERE"
  }'
```

### Retrieve Comments
```bash
curl -X GET "${BASE_URL}/api/v1/reels/REEL_UUID_HERE/comments?skip=0&limit=20"
```

### Delete Comment (Author, Reel Owner, or Admin)
```bash
curl -X DELETE "${BASE_URL}/api/v1/reels/comments/COMMENT_UUID_HERE" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

---

## 7. Advertisements & Analytics

### Create Ad Campaign
```bash
curl -X POST "${BASE_URL}/api/v1/ads/campaigns" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Spring Footwear Drop",
    "start_date": "2026-03-01T00:00:00Z",
    "end_date": "2026-05-01T00:00:00Z",
    "budget": 1000.0,
    "max_impressions": 100000,
    "creatives": [
      {
        "title": "Trail Runner Pro",
        "description": "Engineered for mountain hiking.",
        "video_url": "https://storage.example.com/ads/trail_runner.mp4",
        "thumbnail_url": "https://storage.example.com/ads/trail_runner_thumb.jpg",
        "cta_text": "Shop Now",
        "cta_url": "https://brand.example.com/shoes",
        "sponsor_name": "TrailWear Outdoor"
      }
    ]
  }'
```

### Track Ad Impression
```bash
curl -X POST "${BASE_URL}/api/v1/ads/track/impression" \
  -H "Content-Type: application/json" \
  -d '{"creative_id": "CREATIVE_UUID_HERE"}'
```

### Track Ad Click
```bash
curl -X POST "${BASE_URL}/api/v1/ads/track/click" \
  -H "Content-Type: application/json" \
  -d '{"creative_id": "CREATIVE_UUID_HERE"}'
```

### View Campaign Analytics (Advertiser or Admin)
```bash
curl -X GET "${BASE_URL}/api/v1/ads/campaigns/CAMPAIGN_UUID_HERE/analytics" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

---

## 8. Moderation & Trust/Safety

### Report a Reel (User)
```bash
curl -X POST "${BASE_URL}/api/v1/moderation/reels/REEL_UUID_HERE/report" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "spam",
    "description": "Repetitive promotional bots commenting link."
  }'
```

### Retrieve Moderation Reports (Admin / Moderator)
```bash
curl -X GET "${BASE_URL}/api/v1/moderation/reports?status_filter=pending" \
  -H "Authorization: Bearer ${JWT_TOKEN_WITH_ADMIN_ROLE}"
```

### Internal Service-to-Service Moderation Action
```bash
curl -X POST "${BASE_URL}/api/v1/moderation/reels/REEL_UUID_HERE/action" \
  -H "X-Service-API-Key: ${SERVICE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "takedown",
    "reason": "DMCA violation verified",
    "new_reel_status": "restricted"
  }'
```
