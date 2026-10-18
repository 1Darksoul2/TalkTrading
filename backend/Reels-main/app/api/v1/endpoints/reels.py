from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.api.v1.deps import get_current_user, get_current_user_optional
from app.core.security import TokenData
from app.schemas.reel import ReelCreate, ReelUpdate, ReelResponse
from app.schemas.common import APIResponse
from app.services.reel_service import ReelService

router = APIRouter()


@router.post("", response_model=APIResponse[ReelResponse], status_code=status.HTTP_201_CREATED)
def create_reel(
    reel_in: ReelCreate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Publish a new reel with media URLs from external storage / CDN."""
    reel = ReelService.create_reel(db, user_id=current_user.user_id, reel_in=reel_in)
    return APIResponse(data=ReelResponse.model_validate(reel))


@router.get("/{reel_id}", response_model=APIResponse[ReelResponse])
def get_reel(
    reel_id: str,
    db: Session = Depends(get_db),
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """Retrieve details for a single reel."""
    user_id = current_user.user_id if current_user else None
    reel = ReelService.get_reel_by_id(db, reel_id=reel_id, current_user_id=user_id)
    return APIResponse(data=ReelResponse.model_validate(reel))


@router.put("/{reel_id}", response_model=APIResponse[ReelResponse])
def update_reel(
    reel_id: str,
    update_in: ReelUpdate,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Update reel metadata (owner only)."""
    reel = ReelService.update_reel(db, reel_id=reel_id, user_id=current_user.user_id, update_in=update_in)
    return APIResponse(data=ReelResponse.model_validate(reel))


@router.delete("/{reel_id}", response_model=APIResponse[dict])
def delete_reel(
    reel_id: str,
    db: Session = Depends(get_db),
    current_user: TokenData = Depends(get_current_user)
):
    """Delete a reel (soft delete; owner or admin only)."""
    is_admin = "admin" in current_user.roles
    ReelService.delete_reel(db, reel_id=reel_id, user_id=current_user.user_id, is_admin=is_admin)
    return APIResponse(message="Reel deleted successfully")


@router.post("/{reel_id}/view", response_model=APIResponse[dict])
def register_view(
    reel_id: str,
    db: Session = Depends(get_db)
):
    """Increment reel views counter."""
    ReelService.increment_view(db, reel_id)
    return APIResponse(message="View recorded")
