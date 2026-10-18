"""
Configuration for the Story Service.
All values can be overridden via environment variables.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = "postgresql://user:pass@localhost:5432/stories_db"

    # ── JWT (shared public key / secret with Auth service) ────────────────────
    jwt_secret: str = "CHANGE_ME_IN_PRODUCTION"
    jwt_algorithm: str = "HS256"
    # Login is required by default. Only turn this off for local experiments
    # without an Auth service: every caller then acts as one shared dev user.
    auth_enabled: bool = True

    # Browser origins allowed to call this service (comma separated).
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    # ── Social graph (read through the Post Service's existing public API) ────
    post_service_url: str = "http://127.0.0.1:8004"
    post_service_timeout_seconds: float = 3.0

    # ── Story lifetime and archive ────────────────────────────────────────────
    story_duration_hours: int = 24
    archive_retention_days: int = 365
    orphan_media_hours: int = 24
    purge_interval_minutes: int = 15

    # ── Uploaded media (stored on local disk; served through signed URLs) ─────
    media_dir: str = "./uploads"
    media_url_ttl_seconds: int = 3600
    max_image_bytes: int = 10 * 1024 * 1024
    max_video_bytes: int = 50 * 1024 * 1024
    max_video_seconds: float = 60.0
    max_image_pixels: int = 40_000_000
    max_image_side: int = 2560
    # New stories must use media uploaded through this service (no hot-linked URLs).
    require_uploaded_media: bool = True

    # ── Media / presigned URLs (S3 flow, unused unless AWS is configured) ─────
    aws_access_key_id: str = ""
    aws_secret_access_key: str = ""
    aws_region: str = "us-east-1"
    s3_bucket: str = "talktrading-stories"
    presign_expiry_seconds: int = 900  # 15 minutes

    # ── Message broker ────────────────────────────────────────────────────────
    # "rabbitmq" or "kafka"
    broker_type: str = "rabbitmq"
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"
    kafka_bootstrap_servers: str = "localhost:9092"
    story_expiry_topic: str = "story.expired"

    # ── Rate limiting ─────────────────────────────────────────────────────────
    rate_limit_per_minute: int = 5  # max story uploads per user per minute
    upload_rate_limit: str = "20/minute"
    reply_rate_limit: str = "30/minute"
    reaction_rate_limit: str = "60/minute"


settings = Settings()
