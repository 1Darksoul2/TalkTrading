from typing import List, Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import get_current_user_id, get_optional_user_id
from app.database.database import get_db
from app.schemas.post import PostResponse
from app.services import mention_service, profile_service

router = APIRouter(prefix="/users", tags=["Profiles"])


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=64)
    bio: Optional[str] = Field(None, max_length=160)


# NOTE: fixed paths (/me, /search, /lookup, /by-username) must stay above /{user_id}.

@router.get("/me")
def read_me(db: Session = Depends(get_db), me: int = Depends(get_current_user_id)):
    user = profile_service.require_by_author_id(db, me)
    return profile_service.profile(db, user, me)


@router.put("/me")
def update_me(body: ProfileUpdate, db: Session = Depends(get_db), me: int = Depends(get_current_user_id)):
    user = profile_service.require_by_author_id(db, me)
    profile_service.update_me(db, user, body.display_name, body.bio)
    return profile_service.profile(db, user, me)


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    me: int = Depends(get_current_user_id),
):
    user = profile_service.require_by_author_id(db, me)
    await profile_service.set_avatar(db, user, file)
    return profile_service.profile(db, user, me)


@router.get("/search")
def search_users(q: str = Query(..., min_length=1, max_length=64), limit: int = Query(20, ge=1, le=50), db: Session = Depends(get_db)):
    return {"users": profile_service.search(db, q, limit)}


@router.get("/lookup")
def lookup_users(ids: str = Query(..., description="Comma separated author ids"), db: Session = Depends(get_db)):
    wanted = [int(x) for x in ids.split(",") if x.strip().isdigit()]  # skip invalid tokens individually
    return {"users": {str(k): v for k, v in profile_service.lookup(db, wanted).items()}}


@router.get("/by-username/{username}")
def read_by_username(username: str, db: Session = Depends(get_db), viewer: Optional[int] = Depends(get_optional_user_id)):
    return profile_service.profile(db, profile_service.get_by_username(db, username), viewer)


@router.get("/{user_id}")
def read_profile(user_id: int, db: Session = Depends(get_db), viewer: Optional[int] = Depends(get_optional_user_id)):
    return profile_service.profile(db, profile_service.require_by_author_id(db, user_id), viewer)


@router.get("/{user_id}/mentions", response_model=List[PostResponse])
def mentions(
    user_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    viewer_id: Optional[int] = Depends(get_optional_user_id),
):
    """Posts that @mention this user, limited to what the caller may see."""
    return mention_service.posts_mentioning(db, user_id, viewer_id, page, limit)
