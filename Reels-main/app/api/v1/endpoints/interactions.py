from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.v1.deps import get_current_user, get_current_user_optional
from app.core.security import TokenData
from app.schemas.interaction import LikeResponse, BookmarkResponse, ShareCreate, ShareResponse
from app.schemas.common import APIResponse
from app.services.interaction_service import InteractionService

router = APIRouter()


@router.post("/{reel_id}/like", response_model=APIResponse[LikeResponse])
def toggle_like(
    reel_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Toggle like state on a reel."""
    res = InteractionService.toggle_like(db, reel_id=reel_id, user_id=current_user.user_id)
    return APIResponse(data=res)


@router.post("/{reel_id}/bookmark", response_model=APIResponse[BookmarkResponse])
def toggle_bookmark(
    reel_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Toggle bookmark state on a reel."""
    res = InteractionService.toggle_bookmark(db, reel_id=reel_id, user_id=current_user.user_id)
    return APIResponse(data=res)


@router.post("/{reel_id}/share", response_model=APIResponse[ShareResponse])
def record_share(
    reel_id: str,
    share_in: ShareCreate,
    db: Session = Depends(get_db),
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """Record an external share event (supports anonymous or logged-in)."""
    user_id = current_user.user_id if current_user else None
    res = InteractionService.record_share(db, reel_id=reel_id, user_id=user_id, platform=share_in.platform)
    return APIResponse(data=res)
