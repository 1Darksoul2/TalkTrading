"""
Unit tests for the Chart Service.

Run with:
  python -m pytest chart-service/tests/ -v

Uses SQLite in-memory DB and mocked Finnhub calls — no real API calls.
"""
import sys
import os
import json
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

# Make 'app' importable from chart-service/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app import models, crud

# ── In-memory SQLite test DB ───────────────────────────────────────────────────
TEST_DATABASE_URL = "sqlite:///./test_chart.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    """Create tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)

# ── Sample data ────────────────────────────────────────────────────────────────
SAMPLE_SYMBOLS = [
    {"symbol": "AAPL", "name": "Apple Inc.", "category": "stock", "exchange": "NASDAQ", "tv_symbol": "NASDAQ:AAPL"},
    {"symbol": "BTC",  "name": "Bitcoin",    "category": "crypto","exchange": "BINANCE","tv_symbol": "BINANCE:BTCUSDT"},
]

MOCK_QUOTE = {
    "price": 185.50, "open": 183.00, "high": 186.00, "low": 182.50,
    "prev_close": 184.00, "change": 1.50, "change_percent": 0.815, "volume": None,
}


# ── Test: Health ───────────────────────────────────────────────────────────────

def test_health():
    """GET /health returns 200 with service info."""
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["service"] == "chart-service"
    assert "provider" in data


# ── Test: Symbol Registry ──────────────────────────────────────────────────────

def test_list_symbols_empty():
    """GET /symbols returns empty list when no symbols seeded."""
    resp = client.get("/symbols")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "items" in data


def test_list_symbols_seeded():
    """GET /symbols returns seeded symbols correctly."""
    db = TestingSessionLocal()
    crud.seed_symbols(db, SAMPLE_SYMBOLS)
    db.close()

    resp = client.get("/symbols")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    symbols_found = {s["symbol"] for s in data["items"]}
    assert "AAPL" in symbols_found
    assert "BTC" in symbols_found


def test_list_symbols_filtered_by_category():
    """GET /symbols?category=stock returns only stocks."""
    db = TestingSessionLocal()
    crud.seed_symbols(db, SAMPLE_SYMBOLS)
    db.close()

    resp = client.get("/symbols?category=stock")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["items"][0]["symbol"] == "AAPL"


def test_seed_symbols_idempotent():
    """Seeding twice does not create duplicate records."""
    db = TestingSessionLocal()
    inserted1 = crud.seed_symbols(db, SAMPLE_SYMBOLS)
    inserted2 = crud.seed_symbols(db, SAMPLE_SYMBOLS)
    db.close()
    assert inserted1 == 2
    assert inserted2 == 0  # Already inserted, no duplicates


# ── Test: Quote ────────────────────────────────────────────────────────────────

def test_get_quote_symbol_not_found():
    """GET /symbols/UNKNOWN/quote returns 404."""
    resp = client.get("/symbols/UNKNOWN/quote")
    assert resp.status_code == 404


@patch("app.providers.tradingview.fetch_quote", return_value=MOCK_QUOTE)
def test_get_quote_fresh_from_api(mock_fetch):
    """GET /symbols/AAPL/quote fetches from TradingView when cache is empty."""
    db = TestingSessionLocal()
    crud.seed_symbols(db, SAMPLE_SYMBOLS)
    db.close()

    resp = client.get("/symbols/AAPL/quote")
    assert resp.status_code == 200
    data = resp.json()
    assert data["symbol"] == "AAPL"
    assert data["price"] == pytest.approx(185.50)
    assert data["change_percent"] == pytest.approx(0.815)
    mock_fetch.assert_called_once()


@patch("app.providers.tradingview.fetch_quote", return_value=MOCK_QUOTE)
def test_get_quote_cached(mock_fetch):
    """Second call to /symbols/AAPL/quote uses cache, no second API call."""
    db = TestingSessionLocal()
    crud.seed_symbols(db, SAMPLE_SYMBOLS)
    crud.upsert_quote(db, "AAPL", MOCK_QUOTE)
    db.close()

    resp = client.get("/symbols/AAPL/quote")
    assert resp.status_code == 200
    # With fresh cache, tradingview should NOT be called
    mock_fetch.assert_not_called()


@patch("app.providers.tradingview.fetch_quote", return_value=None)
def test_get_quote_api_failure_no_cache(mock_fetch):
    """GET /symbols/AAPL/quote returns 503 when API fails and no cache exists."""
    db = TestingSessionLocal()
    crud.seed_symbols(db, SAMPLE_SYMBOLS)
    db.close()

    resp = client.get("/symbols/AAPL/quote")
    assert resp.status_code == 503


# ── Test: Batch Quotes ─────────────────────────────────────────────────────────

def test_batch_quotes_returns_cached():
    """GET /quotes/batch returns cached quotes for known symbols."""
    db = TestingSessionLocal()
    crud.seed_symbols(db, SAMPLE_SYMBOLS)
    crud.upsert_quote(db, "AAPL", MOCK_QUOTE)
    crud.upsert_quote(db, "BTC", {**MOCK_QUOTE, "price": 45000.0})
    db.close()

    resp = client.get("/quotes/batch?symbols=AAPL,BTC")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["quotes"]) == 2
    syms = {q["symbol"] for q in data["quotes"]}
    assert "AAPL" in syms
    assert "BTC" in syms


def test_batch_quotes_too_many_symbols():
    """GET /quotes/batch with >50 symbols returns 400."""
    many = ",".join([f"SYM{i}" for i in range(51)])
    resp = client.get(f"/quotes/batch?symbols={many}")
    assert resp.status_code == 400


# ── Test: Sparkline ────────────────────────────────────────────────────────────

@patch("app.providers.tradingview.fetch_sparkline", return_value=[180.0, 181.5, 183.0, 185.5, 184.0, 186.0, 185.5])
@patch("app.providers.tradingview.fetch_quote", return_value=MOCK_QUOTE)
def test_get_sparkline(mock_quote, mock_sparkline):
    """GET /symbols/AAPL/sparkline returns 7 price points."""
    db = TestingSessionLocal()
    crud.seed_symbols(db, SAMPLE_SYMBOLS)
    db.close()

    resp = client.get("/symbols/AAPL/sparkline")
    assert resp.status_code == 200
    data = resp.json()
    assert data["symbol"] == "AAPL"
    assert len(data["prices"]) == 7
    assert data["prices"][0] == pytest.approx(180.0)
