# Story Service

Stories, Highlights, Close Friends, story privacy and settings, and story notifications for **TalkTrading**.
Python / FastAPI. Identity comes from the login JWT (signed by the Post Service); who-follows-whom is read through
the Post Service's **existing public API** with the viewer's own token. This service never touches another
service's database and no other service had to change for it.

---

## What it does

| Area | Behaviour |
|---|---|
| Publishing | Upload a photo or video (`POST /stories/media`), then publish it with a caption, an audience and overlays (text, @mention, #hashtag, link, poll, question, emoji slider, quiz, countdown, shared post). The owner is always the logged-in user. |
| Media | Real file type detected from the bytes; images are decoded and re-encoded (EXIF/GPS stripped, decompression bombs rejected, long side capped); videos limited by size and (MP4/MOV) duration. Files are stored outside any public mount and served only through short-lived signed URLs given to viewers who passed the privacy checks. |
| Privacy | Audience: Everyone or Close Friends. Account rules: who can see (everyone / followers), who can reply (everyone / people I follow / off), who can @mention you. Hide-from list. Mentioned people can always open the story they are mentioned in (unless hidden). Hidden content is indistinguishable from missing content (uniform 404). |
| Viewing | Tray (yours first, unseen before seen, muted last), per-person list, idempotent view tracking, viewer list with reactions and replies, analytics (views, unique viewers, replies, reactions, link taps, poll results). All owner-only. |
| Interactions | Replies, one reaction per viewer from a fixed palette, one-time poll votes, link-tap counting, report. Rate limited. |
| Expiry | Enforced in every query (`expires_at > now`), so a story disappears the moment it expires even if no job ran. A periodic purge (and `python -m app.worker`) reclaims storage. |
| Archive | Expired stories stay in the owner's private archive (switchable) for `ARCHIVE_RETENTION_DAYS`; stories that belong to a Highlight are kept for as long as the Highlight exists. |
| Highlights | Create, rename, reorder stories, choose a cover, reorder highlights, delete. Entries a viewer may not see are left out. |
| Lists & settings | Close Friends, hide-from, muted stories, story settings, notification preferences (enforced when a notification is created). |
| Data | `GET /export` (your data as JSON), `DELETE /account-data` (needs `{"confirm":"DELETE"}`). |

---

## Running locally

```bash
cd story-service
pip install -r requirements.txt
set DATABASE_URL=sqlite:///./stories.db
set JWT_SECRET=<same secret the Post Service signs with>
set POST_SERVICE_URL=http://127.0.0.1:8004
uvicorn app.main:app --port 8001
```

`python start_all.py` (project root) starts everything with these values. Docs: http://localhost:8001/docs

Existing databases are upgraded automatically at start-up (additive columns only, nothing is dropped).

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@localhost:5432/stories_db` | SQLAlchemy URL (SQLite works for local use) |
| `AUTH_ENABLED` | `true` | Login required. Only switch off for local experiments (everyone becomes one shared dev user) |
| `JWT_SECRET` / `JWT_ALGORITHM` | `CHANGE_ME_IN_PRODUCTION` / `HS256` | Must match the service that signs login tokens. Also signs media URLs. Set a real secret. |
| `POST_SERVICE_URL` | `http://127.0.0.1:8004` | Where follows are read from. If unreachable, nobody counts as a follower (fails closed) |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000` | Browser origins allowed |
| `MEDIA_DIR` | `./uploads` | Where uploaded files are stored |
| `MEDIA_URL_TTL_SECONDS` | `3600` | Lifetime of a signed media URL |
| `MAX_IMAGE_BYTES` / `MAX_VIDEO_BYTES` / `MAX_VIDEO_SECONDS` | 10 MB / 50 MB / 60 | Upload limits |
| `STORY_DURATION_HOURS` | `24` | Story lifetime |
| `ARCHIVE_RETENTION_DAYS` | `365` | How long expired stories stay archived |
| `ORPHAN_MEDIA_HOURS` | `24` | Unpublished uploads are removed after this |
| `PURGE_INTERVAL_MINUTES` | `15` | How often the API runs the purge |
| `RATE_LIMIT_PER_MINUTE` | `5` | Story publishes per account per minute |
| `UPLOAD_RATE_LIMIT`, `REPLY_RATE_LIMIT`, `REACTION_RATE_LIMIT` | `20/minute`, `30/minute`, `60/minute` | Per-account limits |
| `BROKER_TYPE`, `RABBITMQ_URL`, `KAFKA_BOOTSTRAP_SERVERS`, `STORY_EXPIRY_TOPIC` | see `config.py` | Optional: `python -m app.worker` publishes a `story.expired` event |
| `AWS_*`, `S3_BUCKET` | empty | Only for the optional S3 presign endpoint (not used by the web app) |

---

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/stories/media` | Upload and validate a file; returns `media_id` and a signed preview URL |
| POST | `/stories` | Publish (`media_id`, `caption`, `audience`, `overlays`) |
| GET | `/stories/tray` | People you follow (and you) with stories you may see |
| GET | `/stories/user/{user_id}` | One person's active stories you may see, oldest first |
| GET | `/stories/feed?user_ids=` | Same rules for a list of people |
| GET | `/stories/archive` | Your own stories, live and expired (paged) |
| GET | `/stories/{id}` | One story you may see |
| POST | `/stories/{id}/view` | Record a view (idempotent) |
| DELETE | `/stories/{id}` | Owner only; removes replies, reactions, highlight entries and the media file |
| GET | `/stories/{id}/viewers`, `/analytics`, `/replies` | Owner only |
| POST | `/stories/{id}/replies` | Reply (needs reply permission) |
| PUT / DELETE | `/stories/{id}/reaction` | Set / remove your reaction |
| POST | `/stories/{id}/poll/vote`, `/link-click`, `/report` | |
| POST | `/stories/{id}/question` | Answer a question sticker (owner reads answers at `GET /stories/{id}/question/answers`) |
| POST | `/stories/{id}/slider`, `/stories/{id}/quiz` | Answer once; returns the results you may now see (quiz answer stays hidden until you answer) |
| PUT / DELETE | `/stories/{id}/countdown/reminder` | Be notified when a countdown sticker ends |
| GET/POST/PATCH/DELETE | `/highlights...`, `PUT /highlights/order` | Highlights |
| GET/POST/DELETE | `/close-friends`, `/story-hidden`, `/story-mutes` | Account lists |
| GET/PUT | `/story-settings` | Settings |
| GET/POST | `/notifications`, `/notifications/unread-count`, `/notifications/read-all`, `/notifications/{id}/read` | Story notifications |
| GET / DELETE | `/export`, `/account-data` | Your data |
| GET | `/media/{key}?t=` | Serves a file to a holder of a valid signed URL |
| GET | `/health` | Liveness |

---

## Tests

```bash
cd story-service
pytest tests/ -v
```

Uses a throwaway SQLite database and media folder, and an in-memory stand-in for the Post Service's follow graph.
Covers: authentication on every endpoint, the whole privacy matrix, media validation and signed URLs, publishing and
overlay validation, interactions and notifications, expiry, archive, purge, deletion cascades, highlights, lists,
settings, export, data removal and the migration of an existing database.
