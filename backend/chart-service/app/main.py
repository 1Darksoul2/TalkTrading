import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import models, schemas, crud
from .config import settings
from .database import engine, SessionLocal, get_db
from .providers import tradingview as tradingview_provider

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_SYMBOLS = [
    {"symbol":"AAPL","name":"Apple Inc.","category":"stock","exchange":"NASDAQ","tv_symbol":"NASDAQ:AAPL"},
    {"symbol":"TSLA","name":"Tesla, Inc.","category":"stock","exchange":"NASDAQ","tv_symbol":"NASDAQ:TSLA"},
    {"symbol":"NVDA","name":"NVIDIA Corporation","category":"stock","exchange":"NASDAQ","tv_symbol":"NASDAQ:NVDA"},
    {"symbol":"AMZN","name":"Amazon.com, Inc.","category":"stock","exchange":"NASDAQ","tv_symbol":"NASDAQ:AMZN"},
    {"symbol":"META","name":"Meta Platforms, Inc.","category":"stock","exchange":"NASDAQ","tv_symbol":"NASDAQ:META"},
    {"symbol":"GOOGL","name":"Alphabet Inc.","category":"stock","exchange":"NASDAQ","tv_symbol":"NASDAQ:GOOGL"},
    {"symbol":"MSFT","name":"Microsoft Corporation","category":"stock","exchange":"NASDAQ","tv_symbol":"NASDAQ:MSFT"},
    {"symbol":"AMD","name":"Advanced Micro Devices","category":"stock","exchange":"NASDAQ","tv_symbol":"NASDAQ:AMD"},
    {"symbol":"SPY","name":"SPDR S&P 500 ETF","category":"stock","exchange":"AMEX","tv_symbol":"AMEX:SPY"},
    {"symbol":"BTC","name":"Bitcoin","category":"crypto","exchange":"BINANCE","tv_symbol":"BINANCE:BTCUSDT"},
    {"symbol":"ETH","name":"Ethereum","category":"crypto","exchange":"BINANCE","tv_symbol":"BINANCE:ETHUSDT"},
    {"symbol":"SOL","name":"Solana","category":"crypto","exchange":"BINANCE","tv_symbol":"BINANCE:SOLUSDT"},
    {"symbol":"XRP","name":"XRP","category":"crypto","exchange":"BINANCE","tv_symbol":"BINANCE:XRPUSDT"},
    {"symbol":"EUR/USD","name":"Euro / US Dollar","category":"forex","exchange":"FX","tv_symbol":"FX:EURUSD"},
    {"symbol":"GBP/USD","name":"British Pound / USD","category":"forex","exchange":"FX","tv_symbol":"FX:GBPUSD"},
    {"symbol":"USD/JPY","name":"US Dollar / Yen","category":"forex","exchange":"FX","tv_symbol":"FX:USDJPY"},
    {"symbol":"USD/INR","name":"US Dollar / Rupee","category":"forex","exchange":"FX","tv_symbol":"FX:USDINR"},
    {"symbol":"XAUUSD","name":"Gold Spot","category":"commodity","exchange":"TVC","tv_symbol":"TVC:GOLD"},
    {"symbol":"XAGUSD","name":"Silver Spot","category":"commodity","exchange":"TVC","tv_symbol":"TVC:SILVER"},
    {"symbol":"CL","name":"Crude Oil Futures","category":"commodity","exchange":"NYMEX","tv_symbol":"NYMEX:CL1!"},
]

@asynccontextmanager
async def lifespan(app: FastAPI):
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        crud.seed_symbols(db, DEFAULT_SYMBOLS)
    finally:
        db.close()
    yield

app = FastAPI(title="Chart Service", version="1.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)

@app.get("/health", tags=["ops"])
def health():
    return {"status":"ok","service":"chart-service","provider":"tradingview"}

@app.get("/symbols", response_model=schemas.SymbolList, tags=["symbols"])
def list_symbols(category: Optional[str] = Query(None), db: Session = Depends(get_db)):
    total, items = crud.get_all_symbols(db, category=category)
    return schemas.SymbolList(total=total, items=items)

@app.get("/symbols/{symbol:path}/quote", response_model=schemas.QuoteOut, tags=["quotes"])
def get_quote(symbol: str, db: Session = Depends(get_db)):
    symbol = symbol.upper()
    rec = crud.get_symbol(db, symbol)
    if not rec:
        raise HTTPException(404, f"Symbol '{symbol}' not found in registry")
    cached = crud.get_cached_quote(db, symbol)
    if cached:
        return cached
    data = tradingview_provider.fetch_quote(rec.tv_symbol, rec.category)
    if data:
        return crud.upsert_quote(db, symbol, data)
    stale = crud.get_quote_row(db, symbol)
    if stale and stale.price is not None:
        return stale
    raise HTTPException(503, f"Quote unavailable for '{symbol}'")

@app.get("/symbols/{symbol:path}/sparkline", response_model=schemas.SparklineOut, tags=["quotes"])
def get_sparkline(symbol: str, db: Session = Depends(get_db)):
    symbol = symbol.upper()
    rec = crud.get_symbol(db, symbol)
    if not rec:
        raise HTTPException(404, f"Symbol '{symbol}' not found in registry")
    row = crud.get_quote_row(db, symbol)
    cached = crud.get_sparkline(db, symbol)
    if cached and row and not crud.is_sparkline_stale(row.updated_at):
        return schemas.SparklineOut(symbol=symbol, prices=cached, updated_at=row.updated_at)
    prices = tradingview_provider.fetch_sparkline(rec.tv_symbol, rec.category, settings.sparkline_days)
    if prices:
        row = crud.upsert_quote(db, symbol, {}, sparkline=prices, touch_quote_timestamp=False)
        return schemas.SparklineOut(symbol=symbol, prices=prices, updated_at=row.updated_at)
    if cached and row:
        return schemas.SparklineOut(symbol=symbol, prices=cached, updated_at=row.updated_at)
    raise HTTPException(503, f"Sparkline unavailable for '{symbol}'")

@app.get("/quotes/batch", response_model=schemas.BatchQuoteResponse, tags=["quotes"])
def get_batch_quotes(symbols: str = Query(...), db: Session = Depends(get_db)):
    requested = list(dict.fromkeys(s.strip().upper() for s in symbols.split(",") if s.strip()))
    if not requested:
        return schemas.BatchQuoteResponse(quotes=[])
    if len(requested) > settings.batch_quote_max:
        raise HTTPException(400, f"Too many symbols. Max {settings.batch_quote_max} per request.")

    records = {r.symbol: r for r in crud.get_symbols_by_names(db, requested)}
    unknown = [s for s in requested if s not in records]
    if unknown:
        raise HTTPException(400, f"Unknown symbols: {', '.join(unknown)}")

    cached = {r.symbol:r for r in crud.get_batch_quotes(db, requested)}
    needs_fetch = [s for s in requested if s not in cached or crud._is_stale(cached[s].updated_at) or cached[s].price is None]

    if needs_fetch:
        tv_to_symbol = {records[s].tv_symbol:s for s in needs_fetch}
        fresh = tradingview_provider.fetch_batch_quotes(list(tv_to_symbol))
        for tv_symbol, data in fresh.items():
            internal = tv_to_symbol.get(tv_symbol)
            if internal and data:
                cached[internal] = crud.upsert_quote(db, internal, data)

    quotes = []
    for s in requested:
        row = cached.get(s) or crud.get_quote_row(db, s)
        if row and row.price is not None:
            quotes.append(schemas.BatchQuoteItem.model_validate(row))
    return schemas.BatchQuoteResponse(quotes=quotes)
