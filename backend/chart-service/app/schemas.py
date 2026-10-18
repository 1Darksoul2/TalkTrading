from __future__ import annotations
import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel

class SymbolOut(BaseModel):
    id: uuid.UUID; symbol: str; name: str; category: str; exchange: Optional[str]; tv_symbol: str; is_active: bool
    model_config={"from_attributes":True}
class SymbolList(BaseModel):
    total:int; items:List[SymbolOut]
class QuoteOut(BaseModel):
    symbol:str; price:Optional[float]; open:Optional[float]; high:Optional[float]; low:Optional[float]; prev_close:Optional[float]; change:Optional[float]; change_percent:Optional[float]; volume:Optional[int]; updated_at:datetime
    model_config={"from_attributes":True}
class BatchQuoteItem(BaseModel):
    symbol:str; price:Optional[float]; change:Optional[float]; change_percent:Optional[float]; updated_at:datetime
    model_config={"from_attributes":True}
class BatchQuoteResponse(BaseModel):
    quotes:List[BatchQuoteItem]
class SparklineOut(BaseModel):
    symbol:str; prices:List[float]; updated_at:datetime
