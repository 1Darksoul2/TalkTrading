from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db
from app.core.config import settings

router = APIRouter()


@router.get("/health", summary="Basic health status")
def health_check():
    """Returns general microservice status."""
    return {
        "status": "healthy",
        "app_name": settings.APP_NAME,
        "environment": settings.APP_ENV
    }


@router.get("/ready", summary="Readiness check including database ping")
def readiness_check(db: Session = Depends(get_db)):
    """Verifies that the microservice can communicate with its database."""
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ready",
            "database": "connected"
        }
    except Exception as e:
        return {
            "status": "unready",
            "database": f"connection failed: {str(e)}"
        }
