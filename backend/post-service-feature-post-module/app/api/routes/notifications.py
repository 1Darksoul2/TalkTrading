from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user_id
from app.database.database import get_db
from app.services import notification_service, profile_service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
def list_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id),
):
    """Your notifications, newest first, each with the profile of the person who triggered it."""
    rows = notification_service.list_for(db, current_user_id, page, limit, unread_only)
    actors = profile_service.lookup(db, [n.actor_id for n in rows])
    return {
        "unread_count": notification_service.unread_count(db, current_user_id),
        "notifications": [
            {
                "id": n.id,
                "type": n.type,
                "post_id": n.post_id,
                "comment_id": n.comment_id,
                "is_read": n.is_read,
                "created_at": n.created_at,
                "actor": actors.get(n.actor_id),
            }
            for n in rows
        ],
    }


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user_id: int = Depends(get_current_user_id)):
    return {"unread_count": notification_service.unread_count(db, current_user_id)}


@router.post("/read-all")
def read_all(db: Session = Depends(get_db), current_user_id: int = Depends(get_current_user_id)):
    return {"marked": notification_service.mark_read(db, current_user_id)}


@router.post("/{notification_id}/read")
def read_one(notification_id: int, db: Session = Depends(get_db), current_user_id: int = Depends(get_current_user_id)):
    if notification_service.mark_read(db, current_user_id, notification_id) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found or already read")
    return {"marked": 1}
