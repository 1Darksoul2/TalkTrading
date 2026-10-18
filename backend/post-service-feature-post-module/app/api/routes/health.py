from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.database.database import get_db
from app.core.config import settings

router = APIRouter(
    prefix="/health",
    tags=["Health"],
)


@router.get("/live", status_code=status.HTTP_200_OK)
def liveness_check():
    """Liveness probe: verifies that the service container is alive."""
    return {
        "status": "live",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
    }


@router.get("/ready", status_code=status.HTTP_200_OK)
def readiness_check(db: Session = Depends(get_db)):
    """Readiness probe: verifies that required dependencies (Database) are connected."""
    try:
        db.execute(text("SELECT 1"))
        db_status = "healthy"
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "database": f"unhealthy: {str(e)}",
                "service": settings.PROJECT_NAME,
            }
        )

    return {
        "status": "ready",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "database": db_status,
    }


@router.get("/", status_code=status.HTTP_200_OK)
def health_summary(db: Session = Depends(get_db)):
    """Summary health check endpoint."""
    return readiness_check(db)
