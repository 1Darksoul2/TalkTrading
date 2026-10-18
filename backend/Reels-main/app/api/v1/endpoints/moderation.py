from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.v1.deps import get_current_user, verify_service_api_key
from app.core.security import TokenData
from app.schemas.moderation import ReportCreate, ReportResponse, ModerationAction
from app.schemas.reel import ReelResponse
from app.schemas.common import APIResponse
from app.services.moderation_service import ModerationService

router = APIRouter()


@router.post("/reels/{reel_id}/report", response_model=APIResponse[ReportResponse], status_code=status.HTTP_201_CREATED)
def report_reel(
    reel_id: str,
    report_in: ReportCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Submit a report against a reel for community guidelines violation."""
    report = ModerationService.report_reel(
        db,
        reel_id=reel_id,
        reporter_id=current_user.user_id,
        report_in=report_in
    )
    return APIResponse(data=ReportResponse.model_validate(report))


@router.get("/reports", response_model=APIResponse[List[ReportResponse]])
def get_reports(
    status_filter: Optional[str] = Query(None, description="Filter by pending, resolved, dismissed"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Retrieve moderation queue reports (Admin role or Service Key required)."""
    if "admin" not in current_user.roles and "moderator" not in current_user.roles:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Moderator privileges required to view reports queue."
        )
    reports = ModerationService.get_reports(db, status_filter=status_filter, limit=limit)
    return APIResponse(data=[ReportResponse.model_validate(r) for r in reports])


@router.post("/reels/{reel_id}/action", response_model=APIResponse[ReelResponse])
def moderate_reel(
    reel_id: str,
    action_in: ModerationAction,
    db: Session = Depends(get_db),
    _authorized: bool = Depends(verify_service_api_key)
):
    """Service-to-Service internal moderation endpoint for automated or admin actions."""
    reel = ModerationService.apply_moderation_action(
        db,
        reel_id=reel_id,
        moderator_id="system_service",
        action_in=action_in
    )
    return APIResponse(data=ReelResponse.model_validate(reel))
