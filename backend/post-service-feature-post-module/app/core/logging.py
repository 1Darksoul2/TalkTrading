import logging
import sys
import uuid
from contextvars import ContextVar
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# The id of the request being handled; "-" outside a request (startup, migrations).
# A ContextVar keeps concurrent requests apart and needs no per-request factory swapping.
_correlation_id: ContextVar[str] = ContextVar("correlation_id", default="-")

_base_record_factory = logging.getLogRecordFactory()


def _record_factory(*args, **kwargs):
    record = _base_record_factory(*args, **kwargs)
    record.correlation_id = _correlation_id.get()
    return record


logging.setLogRecordFactory(_record_factory)

# Configure root logger
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [correlation_id=%(correlation_id)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

logger = logging.getLogger("post_service")


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-ID", str(uuid.uuid4()))
        request.state.correlation_id = correlation_id
        token = _correlation_id.set(correlation_id)
        try:
            response = await call_next(request)
        finally:
            _correlation_id.reset(token)
        response.headers["X-Correlation-ID"] = correlation_id
        return response
