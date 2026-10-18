import json, uuid
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from . import models
from .config import settings

def get_all_symbols(db: Session, category: Optional[str]=None) -> Tuple[int, List[models.Symbol]]:
    q = db.query(models.Symbol).filter(models.Symbol.is_active.is_(True))
    if category:
        q = q.filter(models.Symbol.category == category)
    items = q.order_by(models.Symbol.symbol).all()
    return len(items), items

def get_symbol(db: Session, symbol: str):
    return db.query(models.Symbol).filter(models.Symbol.symbol==symbol, models.Symbol.is_active.is_(True)).first()

def get_symbols_by_names(db: Session, symbols: List[str]):
    return db.query(models.Symbol).filter(models.Symbol.symbol.in_(symbols), models.Symbol.is_active.is_(True)).all()

def seed_symbols(db: Session, symbol_list: List[dict]) -> int:
    inserted=0
    for s in symbol_list:
        if not db.query(models.Symbol).filter(models.Symbol.symbol==s["symbol"]).first():
            db.add(models.Symbol(id=uuid.uuid4(), **s, is_active=True)); inserted += 1
    if inserted: db.commit()
    return inserted

def _is_stale(updated_at: datetime) -> bool:
    return datetime.utcnow() - updated_at > timedelta(seconds=settings.quote_cache_ttl)

def is_sparkline_stale(updated_at: datetime) -> bool:
    return datetime.utcnow() - updated_at > timedelta(seconds=settings.sparkline_cache_ttl)

def get_quote_row(db: Session, symbol: str):
    return db.query(models.QuoteCache).filter(models.QuoteCache.symbol==symbol).first()

def get_cached_quote(db: Session, symbol: str):
    row = get_quote_row(db, symbol)
    return row if row and row.price is not None and not _is_stale(row.updated_at) else None

def upsert_quote(db: Session, symbol: str, quote_data: dict, sparkline=None, touch_quote_timestamp=True):
    row = get_quote_row(db, symbol)
    now = datetime.utcnow()
    if not row:
        row=models.QuoteCache(id=uuid.uuid4(), symbol=symbol, updated_at=now)
        db.add(row)
    for field in ("price","open","high","low","prev_close","change","change_percent","volume"):
        if field in quote_data and quote_data[field] is not None:
            setattr(row, field, quote_data[field])
    if sparkline is not None:
        row.sparkline_json=json.dumps(sparkline)
    if quote_data and touch_quote_timestamp:
        row.updated_at=now
    elif row.updated_at is None:
        row.updated_at=now
    db.commit(); db.refresh(row); return row

def get_sparkline(db: Session, symbol: str):
    row=get_quote_row(db,symbol)
    if not row or not row.sparkline_json: return None
    try: return json.loads(row.sparkline_json)
    except (TypeError, ValueError): return None

def get_batch_quotes(db: Session, symbols: List[str]):
    return db.query(models.QuoteCache).filter(models.QuoteCache.symbol.in_(symbols)).all()
