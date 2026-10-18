"""Close Friends, hide-from, muted stories, story settings, highlights, data export and account data removal."""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import media as media_lib
from .access import Access
from .graph import PostGraph
from .models import (
    CloseFriend, Highlight, HighlightItem, Story, StoryCountdownReminder, StoryHidden, StoryMedia, StoryMute,
    StoryNotification, StoryReaction, StoryReply, StorySettings, StoryStickerResponse,
)
from .schemas import (
    HighlightCreate, HighlightDetail, HighlightOut, HighlightUpdate, StorySettingsOut, StorySettingsUpdate,
    UserListItem,
)
from .stories_service import delete_stories, not_found, serialize, story_media_url, user_summary


# ── Generic "list of accounts" (close friends / hidden / muted) ──────────────

LISTS = {
    "close_friends": (CloseFriend, "owner_id", "friend_id"),
    "hidden": (StoryHidden, "owner_id", "hidden_id"),
    "muted": (StoryMute, "viewer_id", "owner_id"),
}


def list_members(db: Session, graph: PostGraph, kind: str, me: uuid.UUID, page: int, size: int) -> List[UserListItem]:
    model, owner_col, member_col = LISTS[kind]
    rows = (db.query(model).filter(getattr(model, owner_col) == me).order_by(model.created_at.desc())
            .offset((page - 1) * size).limit(size).all())
    people = graph.summaries([getattr(r, member_col) for r in rows])
    return [UserListItem(user=user_summary(getattr(r, member_col), people), added_at=r.created_at) for r in rows]


def add_member(db: Session, graph: PostGraph, kind: str, me: uuid.UUID, target: uuid.UUID) -> None:
    if target == me:
        raise HTTPException(status_code=400, detail="You cannot add yourself")
    if target not in graph.summaries([target]):
        raise HTTPException(status_code=404, detail="User not found")
    model, owner_col, member_col = LISTS[kind]
    db.add(model(**{owner_col: me, member_col: target}))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # already on the list: adding twice is a no-op


def remove_member(db: Session, kind: str, me: uuid.UUID, target: uuid.UUID) -> None:
    model, owner_col, member_col = LISTS[kind]
    deleted = db.query(model).filter(getattr(model, owner_col) == me, getattr(model, member_col) == target).delete()
    db.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Not on the list")


# ── Settings ─────────────────────────────────────────────────────────────────

def get_settings(db: Session, me: uuid.UUID) -> StorySettingsOut:
    row = db.get(StorySettings, me)
    if row is None:
        return StorySettingsOut()
    return StorySettingsOut.model_validate({c: getattr(row, c) for c in StorySettingsOut.model_fields})


def update_settings(db: Session, me: uuid.UUID, changes: StorySettingsUpdate) -> StorySettingsOut:
    row = db.get(StorySettings, me)
    if row is None:
        row = StorySettings(owner_id=me)
        db.add(row)
    for field, value in changes.model_dump(exclude_none=True).items():
        setattr(row, field, value)
    db.commit()
    return get_settings(db, me)


# ── Highlights ───────────────────────────────────────────────────────────────

def _own_stories(db: Session, me: uuid.UUID, story_ids: List[uuid.UUID]) -> Dict[uuid.UUID, Story]:
    found = {s.id: s for s in db.query(Story).filter(Story.id.in_(story_ids), Story.user_id == me)}
    missing = [i for i in story_ids if i not in found]
    if missing:
        raise HTTPException(status_code=400, detail="Highlights can only contain your own stories")
    return found


def _cover_url(db: Session, highlight: Highlight) -> Optional[str]:
    cover = db.get(Story, highlight.cover_story_id) if highlight.cover_story_id else None
    if cover is None and highlight.items:
        cover = db.get(Story, highlight.items[0].story_id)
    return story_media_url(cover) if cover else None


def highlight_out(db: Session, h: Highlight) -> HighlightOut:
    return HighlightOut(id=h.id, owner_id=h.owner_id, title=h.title, cover_url=_cover_url(db, h),
                        story_count=len(h.items), position=h.position, created_at=h.created_at)


def create_highlight(db: Session, me: uuid.UUID, data: HighlightCreate) -> Highlight:
    ids = list(dict.fromkeys(data.story_ids))  # drop duplicates, keep order
    _own_stories(db, me, ids)
    if data.cover_story_id and data.cover_story_id not in ids:
        raise HTTPException(status_code=400, detail="The cover must be one of the highlight's stories")
    top = db.query(func.max(Highlight.position)).filter(Highlight.owner_id == me).scalar()
    h = Highlight(owner_id=me, title=data.title, cover_story_id=data.cover_story_id or ids[0],
                  position=(top + 1) if top is not None else 0)
    db.add(h)
    db.flush()
    for pos, story_id in enumerate(ids):
        db.add(HighlightItem(highlight_id=h.id, story_id=story_id, position=pos))
    db.commit()
    db.refresh(h)
    return h


def own_highlight(db: Session, me: uuid.UUID, highlight_id: uuid.UUID) -> Highlight:
    h = db.get(Highlight, highlight_id)
    if h is None or h.owner_id != me:
        raise not_found("Highlight")
    return h


def update_highlight(db: Session, me: uuid.UUID, highlight_id: uuid.UUID, data: HighlightUpdate) -> Highlight:
    h = own_highlight(db, me, highlight_id)
    if data.title is not None:
        h.title = data.title
    if data.story_ids is not None:
        ids = list(dict.fromkeys(data.story_ids))
        _own_stories(db, me, ids)
        db.query(HighlightItem).filter(HighlightItem.highlight_id == h.id).delete(synchronize_session=False)
        db.flush()
        for pos, story_id in enumerate(ids):
            db.add(HighlightItem(highlight_id=h.id, story_id=story_id, position=pos))
        if h.cover_story_id not in ids:
            h.cover_story_id = ids[0]
    if data.cover_story_id is not None:
        current = {i.story_id for i in db.query(HighlightItem).filter(HighlightItem.highlight_id == h.id)}
        if data.story_ids is not None:
            current = set(data.story_ids)
        if data.cover_story_id not in current:
            raise HTTPException(status_code=400, detail="The cover must be one of the highlight's stories")
        h.cover_story_id = data.cover_story_id
    db.commit()
    db.refresh(h)
    return h


def delete_highlight(db: Session, me: uuid.UUID, highlight_id: uuid.UUID) -> None:
    h = own_highlight(db, me, highlight_id)
    db.delete(h)  # the stories stay in the archive; only the highlight and its entries go
    db.commit()


def reorder_highlights(db: Session, me: uuid.UUID, ids: List[uuid.UUID]) -> None:
    owned = {h.id: h for h in db.query(Highlight).filter(Highlight.owner_id == me)}
    if any(i not in owned for i in ids):
        raise not_found("Highlight")
    order = list(dict.fromkeys(ids)) + [i for i in sorted(owned, key=lambda k: owned[k].position) if i not in ids]
    for pos, h_id in enumerate(order):
        owned[h_id].position = pos
    db.commit()


def list_highlights(db: Session, access: Access, owner: uuid.UUID) -> List[HighlightOut]:
    """Highlights of `owner`; entries the viewer may not see are left out, empty highlights are hidden."""
    rows = db.query(Highlight).filter(Highlight.owner_id == owner).order_by(Highlight.position).all()
    out = []
    for h in rows:
        stories = [db.get(Story, i.story_id) for i in h.items]
        visible = [s for s in stories if s is not None and access.can_view(s)]
        if not visible:
            continue
        cover = next((s for s in visible if s.id == h.cover_story_id), visible[0])
        out.append(HighlightOut(id=h.id, owner_id=h.owner_id, title=h.title, cover_url=story_media_url(cover),
                                story_count=len(visible), position=h.position, created_at=h.created_at))
    return out


def highlight_detail(db: Session, access: Access, highlight_id: uuid.UUID) -> HighlightDetail:
    h = db.get(Highlight, highlight_id)
    if h is None:
        raise not_found("Highlight")
    stories = [s for s in (db.get(Story, i.story_id) for i in h.items) if s is not None and access.can_view(s)]
    if not stories:
        raise not_found("Highlight")
    base = HighlightOut(id=h.id, owner_id=h.owner_id, title=h.title, story_count=len(stories), position=h.position,
                        created_at=h.created_at,
                        cover_url=story_media_url(next((s for s in stories if s.id == h.cover_story_id), stories[0])))
    return HighlightDetail(**base.model_dump(), stories=serialize(db, access, stories))


# ── Export and removal of the account's story data ───────────────────────────

def export_data(db: Session, me: uuid.UUID) -> dict:
    def iso(dt: Optional[datetime]):
        return dt.isoformat() if dt else None

    stories = db.query(Story).filter(Story.user_id == me).order_by(Story.created_at).all()
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "settings": get_settings(db, me).model_dump(),
        "stories": [{"id": str(s.id), "media_type": s.media_type.value, "caption": s.caption, "audience": s.audience,
                     "overlays": s.overlays, "created_at": iso(s.created_at), "expires_at": iso(s.expires_at),
                     "views": s.view_count} for s in stories],
        "highlights": [{"id": str(h.id), "title": h.title, "story_ids": [str(i.story_id) for i in h.items]}
                       for h in db.query(Highlight).filter(Highlight.owner_id == me).order_by(Highlight.position)],
        "close_friends": [str(r.friend_id) for r in db.query(CloseFriend).filter(CloseFriend.owner_id == me)],
        "hidden_from": [str(r.hidden_id) for r in db.query(StoryHidden).filter(StoryHidden.owner_id == me)],
        "muted_stories": [str(r.owner_id) for r in db.query(StoryMute).filter(StoryMute.viewer_id == me)],
        "replies_sent": [{"story_id": str(r.story_id), "text": r.text, "created_at": iso(r.created_at)}
                         for r in db.query(StoryReply).filter(StoryReply.sender_id == me)],
        "reactions_sent": [{"story_id": str(r.story_id), "emoji": r.emoji}
                           for r in db.query(StoryReaction).filter(StoryReaction.user_id == me)],
        "sticker_answers_sent": [{"story_id": str(r.story_id), "kind": r.kind, "value": r.value, "created_at": iso(r.created_at)}
                                 for r in db.query(StoryStickerResponse).filter(StoryStickerResponse.user_id == me)],
    }


def delete_all_my_data(db: Session, me: uuid.UUID) -> dict:
    """Permanently remove every story, highlight, list, setting and notification the account has here."""
    story_ids = [s.id for s in db.query(Story.id).filter(Story.user_id == me)]
    stories_deleted = delete_stories(db, story_ids)
    orphans = db.query(StoryMedia).filter(StoryMedia.owner_id == me).all()
    for a in orphans:
        media_lib.delete_file(a.storage_key)
        db.delete(a)
    db.query(Highlight).filter(Highlight.owner_id == me).delete(synchronize_session=False)
    for model, col in ((CloseFriend, "owner_id"), (StoryHidden, "owner_id"), (StoryMute, "viewer_id"),
                       (StoryReply, "sender_id"), (StoryReaction, "user_id"),
                       (StoryStickerResponse, "user_id"), (StoryCountdownReminder, "user_id")):
        db.query(model).filter(getattr(model, col) == me).delete(synchronize_session=False)
    db.query(StoryNotification).filter((StoryNotification.user_id == me) | (StoryNotification.actor_id == me)) \
        .delete(synchronize_session=False)
    db.query(StorySettings).filter(StorySettings.owner_id == me).delete(synchronize_session=False)
    db.commit()
    return {"stories_deleted": stories_deleted}
