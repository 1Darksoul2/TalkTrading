from typing import Optional
from fastapi import Query
from pydantic import BaseModel


class CommonPagination(BaseModel):
    page: int = 1
    limit: int = 10


def get_pagination_params(
    page: int = Query(1, ge=1, description="Page number starting from 1"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
) -> CommonPagination:
    return CommonPagination(page=page, limit=limit)
