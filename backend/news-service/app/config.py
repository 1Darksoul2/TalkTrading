"""
Configuration for the News Service.

The key knob is NEWS_PROVIDER — swap it to switch between API providers
without touching any other code.

Supported providers and their required env vars:
  newsapi        → NEWS_API_KEY (https://newsapi.org)
  alphavantage   → NEWS_API_KEY (https://www.alphavantage.co)
  finnhub        → NEWS_API_KEY (https://finnhub.io)
  polygon        → NEWS_API_KEY (https://polygon.io)
  gnews          → NEWS_API_KEY (https://gnews.io)
  mediastack     → NEWS_API_KEY (https://mediastack.com)
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Database (own DB per microservice pattern) ────────────────────────────
    database_url: str = "postgresql://user:pass@localhost:5432/news_db"

    # ── News provider selection ────────────────────────────────────────────────
    # One of: newsapi | alphavantage | finnhub | polygon | gnews | mediastack
    news_provider: str = "finnhub"
    news_api_key: str = ""  # set in .env or the environment, never in source

    # ── Ingestion settings ────────────────────────────────────────────────────
    # Default search query sent to the provider
    news_query: str = "stock market OR crypto OR trading OR finance"
    news_page_size: int = 50  # articles per fetch (provider caps apply)
    # Category to tag articles with when the provider doesn't supply one
    default_category: str = "markets"

    # ── Security ──────────────────────────────────────────────────────────────
    # Must match the secret the Post Service signs login tokens with.
    jwt_secret: str = "CHANGE_ME_IN_PRODUCTION"
    jwt_algorithm: str = "HS256"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # ── API settings ──────────────────────────────────────────────────────────
    news_feed_default_limit: int = 20
    news_feed_max_limit: int = 100


settings = Settings()
