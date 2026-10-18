from typing import List, Union
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator


INSECURE_DEFAULT_JWT_KEY = "default_secret_key_change_in_production"
INSECURE_DEFAULT_SERVICE_KEY = "dev_internal_service_key_reel_2026"


class Settings(BaseSettings):
    APP_NAME: str = "Reel Microservice"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Database
    DATABASE_URL: str = "sqlite:///./reel.db"
    DB_ECHO: bool = False

    # Security & JWT
    JWT_SECRET_KEY: str = INSECURE_DEFAULT_JWT_KEY
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Service-to-Service API Key
    SERVICE_API_KEY: str = INSECURE_DEFAULT_SERVICE_KEY

    # CORS
    BACKEND_CORS_ORIGINS: List[str] = ["*"]

    # Media / Storage
    MEDIA_BASE_URL: str = "https://storage.example.com/videos"
    ALLOWED_MEDIA_DOMAINS: List[str] = ["storage.example.com", "cdn.example.com", "localhost"]

    # Rate limiting & Ad settings
    RATE_LIMIT_PER_MINUTE: int = 120
    AD_FREQUENCY_INTERVAL: int = 4  # Insert 1 ad every 4 organic reels

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    @model_validator(mode="after")
    def validate_production_secrets(self) -> "Settings":
        """Strictly prohibit default or weak fallback secrets in production environments."""
        is_prod = self.APP_ENV.lower() in ("production", "prod", "staging")
        if is_prod:
            if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY == INSECURE_DEFAULT_JWT_KEY:
                raise ValueError(
                    "CRITICAL: JWT_SECRET_KEY must be explicitly provided in production and cannot use default value."
                )
            if len(self.JWT_SECRET_KEY) < 32:
                raise ValueError("CRITICAL: JWT_SECRET_KEY in production must be at least 32 characters long.")
            if not self.SERVICE_API_KEY or self.SERVICE_API_KEY == INSECURE_DEFAULT_SERVICE_KEY:
                raise ValueError(
                    "CRITICAL: SERVICE_API_KEY must be explicitly configured in production and cannot use default value."
                )
            if self.DATABASE_URL.startswith("sqlite"):
                raise ValueError("CRITICAL: SQLite is not permitted for production deployment. Use PostgreSQL.")
        return self


settings = Settings()
