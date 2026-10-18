import logging
from typing import Optional, Dict, List
import requests

logger=logging.getLogger(__name__)
SCANNER="https://scanner.tradingview.com/global/scan"
HEADERS={"User-Agent":"Mozilla/5.0","Content-Type":"application/json"}
COLUMNS=["close","open","high","low","change","change_abs","volume"]

def _parse(item):
    vals=item.get("d",[])
    if len(vals)<6 or vals[0] is None: return None
    price=float(vals[0]); change=float(vals[5] or 0)
    return {
        "price":price,
        "open":float(vals[1]) if vals[1] is not None else price,
        "high":float(vals[2]) if vals[2] is not None else price,
        "low":float(vals[3]) if vals[3] is not None else price,
        "change_percent":float(vals[4] or 0),
        "change":change,
        "prev_close":price-change,
        "volume":int(vals[6]) if len(vals)>6 and vals[6] is not None else None,
    }

def fetch_batch_quotes(tv_symbols: List[str]) -> Dict[str,Dict]:
    if not tv_symbols: return {}
    try:
        r=requests.post(SCANNER,json={"symbols":{"tickers":tv_symbols},"columns":COLUMNS},headers=HEADERS,timeout=10)
        r.raise_for_status()
        out={}
        for item in r.json().get("data",[]):
            parsed=_parse(item)
            if parsed and item.get("s"): out[item["s"]]=parsed
        return out
    except Exception as exc:
        logger.warning("TradingView batch quote failed: %s",exc); return {}

def fetch_quote(tv_symbol: str, category: str) -> Optional[Dict]:
    return fetch_batch_quotes([tv_symbol]).get(tv_symbol)

def _yahoo_symbol(tv_symbol: str, category: str) -> str:
    s=tv_symbol.split(":")[-1]
    if category=="crypto" and s.endswith("USDT"): return s[:-4]+"-USD"
    if category=="forex" and len(s)==6: return s+"=X"
    if category=="commodity": return {"GOLD":"GC=F","SILVER":"SI=F","CL1!":"CL=F"}.get(s,s)
    return s

def fetch_sparkline(tv_symbol: str, category: str, days: int=7) -> List[float]:
    # The hosted TradingView widget supplies its own chart history.
    # This endpoint is only for TalkTrading's small market-card sparklines.
    ticker=_yahoo_symbol(tv_symbol,category)
    try:
        r=requests.get(f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}",params={"range":f"{max(days,7)}d","interval":"1d"},headers=HEADERS,timeout=8)
        r.raise_for_status()
        result=r.json().get("chart",{}).get("result") or []
        if not result: return []
        closes=result[0].get("indicators",{}).get("quote",[{}])[0].get("close",[])
        return [round(float(v),4) for v in closes if v is not None][-days:]
    except Exception as exc:
        logger.warning("Sparkline failed for %s: %s",tv_symbol,exc); return []
