from typing import List, Optional

from sqlalchemy.orm import Session

from app.models.notification import Notification


def notify(
    db: Session,
    user_id: int,
    actor_id: int,
    type: str,
    post_id: Optional[int] = None,
    comment_id: Optional[int] = None,
) -> None:
    """Record a notification. Never notifies you about your own actions, and never repeats
    the same event (e.g. like, unlike, like again) for the same recipient."""
    if user_id == actor_id:
        return
    same = db.query(Notification.id).filter_by(
        user_id=user_id, actor_id=actor_id, type=type, post_id=post_id, comment_id=comment_id
    )
    if same.first() is None:
        db.add(Notification(user_id=user_id, actor_id=actor_id, type=type, post_id=post_id, comment_id=comment_id))
        db.commit()


def list_for(db: Session, user_id: int, page: int, limit: int, unread_only: bool) -> List[Notification]:
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read.is_(False))
    return query.order_by(Notification.id.desc()).offset((page - 1) * limit).limit(limit).all()


def unread_count(db: Session, user_id: int) -> int:
    return db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read.is_(False)).count()


def mark_read(db: Session, user_id: int, notification_id: Optional[int] = None) -> int:
    """Mark one notification (or, without an id, all of them) as read. Returns how many changed."""
    query = db.query(Notification).filter(Notification.user_id == user_id, Notification.is_read.is_(False))
    if notification_id is not None:
        query = query.filter(Notification.id == notification_id)
    changed = query.update({Notification.is_read: True}, synchronize_session=False)
    db.commit()
    return changed
