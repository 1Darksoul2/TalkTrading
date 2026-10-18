import time
from collections import defaultdict
from fastapi import HTTPException, Request, status
from app.core.config import settings


class InMemoryRateLimiter:
    """Sliding window rate limiter keeping track of requests per key in memory.
    
    Zero external dependencies (no Redis needed for local runs), can be substituted
    seamlessly with Redis when deployed at scale.
    """
    def __init__(self, limit_per_minute: int = None):
        self.limit = limit_per_minute or settings.RATE_LIMIT_PER_MINUTE
        self.requests = defaultdict(list)

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        window_start = now - 60.0

        # Purge entries older than 60 seconds
        timestamps = self.requests[key]
        self.requests[key] = [ts for ts in timestamps if ts > window_start]

        if len(self.requests[key]) >= self.limit:
            return False

        self.requests[key].append(now)
        return True


rate_limiter = InMemoryRateLimiter()


def check_rate_limit(request: Request):
    """FastAPI dependency to enforce rate limiting based on client IP."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    if not rate_limiter.is_allowed(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please retry after a few moments."
        )
