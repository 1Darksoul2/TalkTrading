import os
from pydantic_settings import BaseSettings, SettingsConfigDict

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_SERVICE_DIR = os.path.dirname(_THIS_DIR)
_ENV_FILE = os.path.join(_SERVICE_DIR, ".env")

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, env_file_encoding="utf-8", extra="ignore")
    database_url: str = "sqlite:///./chart.db"
    chart_provider: str = "tradingview"
    quote_cache_ttl: int = 60
    sparkline_cache_ttl: int = 900
    sparkline_days: int = 7
    batch_quote_max: int = 50
    cors_origins_raw: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def cors_origins(self):
        return [x.strip() for x in self.cors_origins_raw.split(",") if x.strip()]

settings = Settings()
