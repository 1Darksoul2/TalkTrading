"""
Expiry housekeeping.

Expiry itself is enforced in every read query (`expires_at > now`), so a story disappears for viewers the
moment it expires even if this job never ran. This job only reclaims storage:

  * expired stories are kept in the owner's archive (unless they turned archiving off) for
    `archive_retention_days`, and forever while they are part of a Highlight;
  * uploads that were never published are removed after `orphan_media_hours`.
"""
import logging
from datetime import timedelta
from typing import Dict

from sqlalchemy.orm import Session

from . import media as media_lib
from .models import HighlightItem, Story, StoryMedia, StorySettings
from .stories_service import delete_stories, now, send_countdown_reminders

logger = logging.getLogger(__name__)


def purge_expired(db: Session) -> Dict[str, int]:
    from .config import settings

    current = now()
    expired = db.query(Story).filter(Story.expires_at <= current).all()
    highlighted = {i.story_id for i in db.query(HighlightItem.story_id)} if expired else set()
    no_archive = {s.owner_id for s in db.query(StorySettings).filter(StorySettings.save_to_archive.is_(False))}
    cutoff = current - timedelta(days=settings.archive_retention_days)

    doomed = []
    for s in expired:
        if s.id in highlighted:
            continue
        expires = s.expires_at if s.expires_at.tzinfo else s.expires_at.replace(tzinfo=current.tzinfo)
        if s.user_id in no_archive or expires <= cutoff:
            doomed.append(s.id)
    stories_deleted = delete_stories(db, doomed)

    stale = db.query(StoryMedia).filter(
        StoryMedia.attached.is_(False),
        StoryMedia.created_at <= current - timedelta(hours=settings.orphan_media_hours)).all()
    for a in stale:
        media_lib.delete_file(a.storage_key)
        db.delete(a)
    db.commit()
    reminders = send_countdown_reminders(db)
    if stories_deleted or stale or reminders:
        logger.info("Purged %d expired stories and %d unused uploads; sent %d countdown reminders",
                    stories_deleted, len(stale), reminders)
    return {"stories": stories_deleted, "uploads": len(stale), "reminders": reminders}
