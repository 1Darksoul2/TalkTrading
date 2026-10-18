import logging
import sys
import uuid
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# Log lines emitted outside a request (startup, migrations) have no correlation id yet;
# give every record a default so the format string below never fails. The middleware
# below wraps this factory and overrides it with the real id during requests.
_base_record_factory = logging.getLogRecordFactory()


def _default_record_factory(*args, **kwargs):
    record = _base_record_factory(*args, **kwargs)
    record.correlation_id = "-"
    return record


logging.setLogRecordFactory(_default_record_factory)

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

        # Attach correlation_id to logger context
        old_factory = logging.getLogRecordFactory()

        def record_factory(*args, **kwargs):
            record = old_factory(*args, **kwargs)
            record.correlation_id = correlation_id
            return record

        logging.setLogRecordFactory(record_factory)

        response = await call_next(request)
        response.headers["X-Correlation-ID"] = correlation_id
        return response
