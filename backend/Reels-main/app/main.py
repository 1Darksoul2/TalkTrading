from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.config import settings
from app.api.v1.api import api_router
from app.core.exceptions import (
    ReelServiceException,
    http_exception_handler,
    validation_exception_handler,
    custom_exception_handler,
    generic_exception_handler
)
from app.core.rate_limit import check_rate_limit
from app.db.base import Base
from app.db.session import engine


def create_application() -> FastAPI:
    # Ensure database tables exist (useful for SQLite dev & automated tests)
    Base.metadata.create_all(bind=engine)

    app = FastAPI(
        title=settings.APP_NAME,
        version="1.0.0",
        description="High-performance Reel & Short Video Microservice for Web & Mobile Platforms.",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        dependencies=[Depends(check_rate_limit)]
    )

    # CORS configuration
    if settings.BACKEND_CORS_ORIGINS:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    # Global Exception Handlers
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(ReelServiceException, custom_exception_handler)

    # Mount API routers
    app.include_router(api_router, prefix=settings.API_V1_PREFIX)
    os.makedirs(settings.MEDIA_DIR, exist_ok=True)
    app.mount(f"{settings.API_V1_PREFIX}/media/files", StaticFiles(directory=settings.MEDIA_DIR), name="media")

    # Root health endpoint
    @app.get("/", tags=["Root"])
    def root():
        return {
            "message": f"Welcome to {settings.APP_NAME}",
            "documentation": "/docs",
            "version": "1.0.0",
            "status": "operational"
        }

    return app


app = create_application()
