"""Story notifications. Created here (never by the client) and filtered by the recipient's preferences."""
import uuid
from typing import Dict, Optional

from sqlalchemy.orm import Session

from .models import StoryNotification, StorySettings

# notification type -> StorySettings column that must be on for it to be created
PREFERENCE_FOR = {
    "story_reply": "notify_replies",
    "story_reaction": "notify_reactions",
    "story_mention": "notify_mentions",
    "story_poll_vote": "notify_poll_votes",
    "story_question": "notify_replies",     # answers to a question sticker are a kind of reply
    "story_countdown": None,                # you asked for this reminder yourself, so it is always delivered
}


def notify(db: Session, user_id: uuid.UUID, actor_id: uuid.UUID, type: str, story_id: Optional[uuid.UUID],
           text: Optional[str] = None) -> bool:
    """Record a notification unless it is to yourself or the recipient switched this kind off."""
    if user_id == actor_id:
        return False
    preference = PREFERENCE_FOR[type]
    prefs = db.get(StorySettings, user_id) if preference else None
    if prefs is not None and not getattr(prefs, preference):
        return False
    db.add(StoryNotification(user_id=user_id, actor_id=actor_id, type=type, story_id=story_id, text=text))
    db.commit()
    return True


def unread_count(db: Session, user_id: uuid.UUID) -> int:
    return db.query(StoryNotification).filter(
        StoryNotification.user_id == user_id, StoryNotification.is_read.is_(False)).count()


def page(db: Session, user_id: uuid.UUID, page: int, size: int, unread_only: bool = False):
    query = db.query(StoryNotification).filter(StoryNotification.user_id == user_id)
    if unread_only:
        query = query.filter(StoryNotification.is_read.is_(False))
    return query.order_by(StoryNotification.id.desc()).offset((page - 1) * size).limit(size).all()


def mark_read(db: Session, user_id: uuid.UUID, notification_id: Optional[int] = None) -> int:
    query = db.query(StoryNotification).filter(
        StoryNotification.user_id == user_id, StoryNotification.is_read.is_(False))
    if notification_id is not None:
        query = query.filter(StoryNotification.id == notification_id)
    changed = query.update({StoryNotification.is_read: True}, synchronize_session=False)
    db.commit()
    return changed
