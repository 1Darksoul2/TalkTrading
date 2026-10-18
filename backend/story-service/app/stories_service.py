"""Story business logic: publish, read (always through Access), interact, archive, delete."""
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import media as media_lib
from .access import Access
from .config import settings
from .graph import PostGraph
from .models import (
    Audience, Highlight, HighlightItem, MediaType, Story, StoryCountdownReminder, StoryMedia, StoryMention,
    StoryMute, StoryNotification, StoryPollVote, StoryReaction, StoryReply, StoryReport, StoryStickerResponse,
    StoryView,
)
from .notifications import notify
from .schemas import (
    INTERACTIVE_STICKERS, PollResults, ReplyOut, StickerResponseOut, StoryAnalytics, StoryCreate, StoryOut,
    StoryViewerOut, TrayItem, UserSummary,
)


def now() -> datetime:
    return datetime.now(timezone.utc)


def not_found(what: str = "Story") -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{what} not found")


def user_summary(user_id: uuid.UUID, known: Dict[uuid.UUID, dict]) -> UserSummary:
    info = known.get(user_id) or {}
    return UserSummary(user_id=user_id, username=info.get("username"),
                       display_name=info.get("display_name"), avatar_url=info.get("avatar_url"))


# ── Loading helpers ──────────────────────────────────────────────────────────

def get_story(db: Session, story_id: uuid.UUID) -> Optional[Story]:
    return db.get(Story, story_id)


def require_visible_story(db: Session, access: Access, story_id: uuid.UUID, *, allow_highlighted: bool = False) -> Story:
    """A story the viewer may see right now. Anything else is a uniform 404 (existence is not revealed).

    Expired stories are visible only to their owner (archive) and, with `allow_highlighted`, to anyone
    allowed to see them while they are part of a Highlight."""
    story = get_story(db, story_id)
    if story is None:
        raise not_found()
    if story.user_id != access.viewer.user_id and _as_utc(story.expires_at) <= now():
        in_highlight = allow_highlighted and db.query(HighlightItem.id).filter(HighlightItem.story_id == story.id).first()
        if not in_highlight:
            raise not_found()
    if not access.can_view(story):
        raise not_found()
    return story


def require_own_story(db: Session, viewer: uuid.UUID, story_id: uuid.UUID, *, allow_expired: bool = True) -> Story:
    story = get_story(db, story_id)
    if story is None or story.user_id != viewer:
        raise not_found()
    if not allow_expired and _as_utc(story.expires_at) <= now():
        raise not_found()
    return story


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


# ── Serialising ──────────────────────────────────────────────────────────────

def _media_key(story: Story) -> Optional[str]:
    return story.media_url[len("media:"):] if story.media_url.startswith("media:") else None


def story_media_url(story: Story) -> str:
    key = _media_key(story)
    return media_lib.signed_path(key) if key else story.media_url


def _poll_options(story: Story) -> Optional[List[str]]:
    for o in story.overlays or []:
        if o.get("type") == "poll":
            return o["options"]
    return None


def serialize(db: Session, access: Access, stories: List[Story]) -> List[StoryOut]:
    if not stories:
        return []
    me = access.viewer.user_id
    ids = [s.id for s in stories]
    seen = {v.story_id for v in db.query(StoryView.story_id).filter(StoryView.viewer_id == me, StoryView.story_id.in_(ids))}
    reactions = {r.story_id: r.emoji for r in db.query(StoryReaction).filter(
        StoryReaction.user_id == me, StoryReaction.story_id.in_(ids))}
    poll_ids = [s.id for s in stories if _poll_options(s)]
    my_votes = {v.story_id: v.option for v in db.query(StoryPollVote).filter(
        StoryPollVote.user_id == me, StoryPollVote.story_id.in_(poll_ids))} if poll_ids else {}
    counts: Dict[uuid.UUID, List[int]] = {}
    if poll_ids:
        for story_id, option, n in db.query(StoryPollVote.story_id, StoryPollVote.option, func.count()).filter(
                StoryPollVote.story_id.in_(poll_ids)).group_by(StoryPollVote.story_id, StoryPollVote.option):
            counts.setdefault(story_id, [0, 0])[option] = n
    sticker_ids = [s.id for s in stories if sticker_of(s)]
    responses = _responses(db, sticker_ids)
    reminders: Dict[uuid.UUID, List[StoryCountdownReminder]] = {}
    if sticker_ids:
        for r in db.query(StoryCountdownReminder).filter(StoryCountdownReminder.story_id.in_(sticker_ids)):
            reminders.setdefault(r.story_id, []).append(r)
    access.preload({s.user_id for s in stories})
    out: List[StoryOut] = []
    for s in stories:
        owner = s.user_id == me
        sticker = sticker_of(s)
        rows = responses.get(s.id, [])
        answered = any(r.user_id == me for r in rows)
        reminded = any(r.user_id == me for r in reminders.get(s.id, []))
        state = sticker_state(sticker, rows, me, owner, reminded, len(reminders.get(s.id, []))) if sticker else None
        poll = None
        if _poll_options(s) and (owner or s.id in my_votes):
            c = counts.get(s.id, [0, 0])
            poll = PollResults(counts=c, total=sum(c), my_vote=my_votes.get(s.id))
        out.append(StoryOut(
            id=s.id, user_id=s.user_id, media_url=story_media_url(s), media_type=s.media_type,
            caption=s.caption, created_at=s.created_at, expires_at=s.expires_at,
            audience=s.audience or "everyone", overlays=_overlays_for(s, answered, owner),
            width=s.width, height=s.height, duration=s.duration,
            seen=s.id in seen or owner, my_reaction=reactions.get(s.id),
            can_reply=access.can_reply(s), poll=poll, sticker=state,
            view_count=s.view_count if owner else None,
            expired=_as_utc(s.expires_at) <= now(),
        ))
    return out


# ── Publishing ───────────────────────────────────────────────────────────────

def create_story(db: Session, access: Access, graph: PostGraph, data: StoryCreate) -> Story:
    me = access.viewer.user_id
    media_url, media_type, width, height, duration, asset = None, data.media_type, None, None, None, None

    if data.media_id:
        asset = db.get(StoryMedia, data.media_id)
        if asset is None or asset.owner_id != me or asset.attached:
            raise HTTPException(status_code=400, detail="Upload the media first, then publish it (it may already be used)")
        media_url, media_type = f"media:{asset.storage_key}", asset.media_type
        width, height, duration = asset.width, asset.height, asset.duration
    elif data.media_url and not settings.require_uploaded_media:
        if not data.media_url.lower().startswith(("http://", "https://")) or data.media_type is None:
            raise HTTPException(status_code=422, detail="media_url must be http(s) and media_type is required")
        media_url = data.media_url
    else:
        raise HTTPException(status_code=422, detail="Upload an image or video first (media_id is required)")

    overlays = [o.model_dump(mode="json", exclude_none=True) for o in data.overlays]
    if sum(1 for o in overlays if o["type"] in INTERACTIVE_STICKERS) > 1:
        raise HTTPException(status_code=422, detail="A story can have only one poll, question, slider, quiz or countdown")
    shared = [o for o in overlays if o["type"] == "post"]
    if len(shared) > 1:
        raise HTTPException(status_code=422, detail="A story can share only one post")
    if shared and not graph.post_visible(access.viewer, shared[0]["post_id"]):
        raise HTTPException(status_code=422, detail="That post is not available to share")

    mentioned = _resolve_mentions(access, graph, overlays)

    story = Story(
        user_id=me, media_url=media_url, media_type=media_type, caption=(data.caption or None),
        audience=data.audience.value, overlays=overlays or None, media_id=asset.id if asset else None,
        width=width, height=height, duration=duration,
    )
    db.add(story)
    db.flush()
    if asset:
        asset.attached = True
    for user_id in mentioned:
        db.add(StoryMention(story_id=story.id, user_id=user_id))
    db.commit()
    db.refresh(story)
    for user_id in mentioned:
        notify(db, user_id, me, "story_mention", story.id)
    return story


# ── Question / slider / quiz / countdown stickers ───────────────────────────

def sticker_of(story: Story) -> Optional[dict]:
    return next((o for o in story.overlays or [] if o.get("type") in INTERACTIVE_STICKERS - {"poll"}), None)


def _responses(db: Session, story_ids: List[uuid.UUID]) -> Dict[uuid.UUID, List[StoryStickerResponse]]:
    out: Dict[uuid.UUID, List[StoryStickerResponse]] = {}
    if story_ids:
        for r in db.query(StoryStickerResponse).filter(StoryStickerResponse.story_id.in_(story_ids)):
            out.setdefault(r.story_id, []).append(r)
    return out


def sticker_state(sticker: dict, rows: List[StoryStickerResponse], me: uuid.UUID, owner: bool, reminded: bool, reminders: int) -> dict:
    """What this viewer may know about a sticker: results only after answering (or for the owner)."""
    kind = sticker["type"]
    mine = [r for r in rows if r.user_id == me]
    if kind == "question":
        state = {"kind": kind, "my_answers": len(mine)}
        if owner:
            state["answers"] = len(rows)
        return state
    if kind == "slider":
        values = [int(r.value) for r in rows]
        state = {"kind": kind, "my_value": int(mine[0].value) if mine else None}
        if owner or mine:
            state.update(average=round(sum(values) / len(values)) if values else None, count=len(values))
        return state
    if kind == "quiz":
        counts = [0] * len(sticker["options"])
        for r in rows:
            counts[int(r.value)] += 1
        state = {"kind": kind, "my_answer": int(mine[0].value) if mine else None}
        if owner or mine:
            state.update(correct=sticker["correct"], counts=counts)
        return state
    state = {"kind": kind, "reminded": reminded}
    if owner:
        state["reminders"] = reminders
    return state


def _overlays_for(story: Story, viewer_answered: bool, owner: bool) -> List[dict]:
    """Never send a quiz's correct answer to someone who has not answered it yet."""
    out = []
    for o in story.overlays or []:
        if o.get("type") == "quiz" and not owner and not viewer_answered:
            o = {k: v for k, v in o.items() if k != "correct"}
        out.append(o)
    return out


def _answerable(story: Story, viewer: uuid.UUID, kind: str) -> dict:
    sticker = sticker_of(story)
    if not sticker or sticker["type"] != kind:
        raise HTTPException(status_code=400, detail=f"This story has no {kind} sticker")
    if story.user_id == viewer:
        raise HTTPException(status_code=400, detail="You cannot answer your own sticker")
    return sticker


def answer_question(db: Session, viewer: uuid.UUID, story: Story, text: str) -> None:
    _answerable(story, viewer, "question")
    db.add(StoryStickerResponse(story_id=story.id, user_id=viewer, kind="question", value=text))
    db.commit()
    notify(db, story.user_id, viewer, "story_question", story.id, text[:100])


def _answer_once(db: Session, viewer: uuid.UUID, story: Story, kind: str, value: str) -> None:
    taken = db.query(StoryStickerResponse.id).filter_by(story_id=story.id, user_id=viewer, kind=kind).first()
    if taken:
        raise HTTPException(status_code=409, detail="You have already answered")
    db.add(StoryStickerResponse(story_id=story.id, user_id=viewer, kind=kind, value=value))
    db.commit()


def answer_slider(db: Session, viewer: uuid.UUID, story: Story, value: int) -> dict:
    sticker = _answerable(story, viewer, "slider")
    _answer_once(db, viewer, story, "slider", str(value))
    return sticker_state(sticker, _responses(db, [story.id]).get(story.id, []), viewer, False, False, 0)


def answer_quiz(db: Session, viewer: uuid.UUID, story: Story, option: int) -> dict:
    sticker = _answerable(story, viewer, "quiz")
    if option >= len(sticker["options"]):
        raise HTTPException(status_code=422, detail="That answer is not one of the options")
    _answer_once(db, viewer, story, "quiz", str(option))
    return sticker_state(sticker, _responses(db, [story.id]).get(story.id, []), viewer, False, False, 0)


def countdown_end(sticker: dict) -> datetime:
    return _as_utc(datetime.fromisoformat(sticker["ends_at"].replace("Z", "+00:00")))


def set_countdown_reminder(db: Session, viewer: uuid.UUID, story: Story, on: bool) -> dict:
    sticker = _answerable(story, viewer, "countdown")
    row = db.query(StoryCountdownReminder).filter_by(story_id=story.id, user_id=viewer).first()
    if on and row is None:
        if countdown_end(sticker) <= now():
            raise HTTPException(status_code=400, detail="This countdown has already ended")
        db.add(StoryCountdownReminder(story_id=story.id, user_id=viewer, ends_at=countdown_end(sticker)))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    elif not on and row is not None:
        db.delete(row)
        db.commit()
    return {"kind": "countdown", "reminded": on}


def question_answers(db: Session, graph: PostGraph, story: Story, page: int, size: int) -> List[StickerResponseOut]:
    rows = (db.query(StoryStickerResponse).filter_by(story_id=story.id, kind="question")
            .order_by(StoryStickerResponse.created_at.desc()).offset((page - 1) * size).limit(size).all())
    people = graph.summaries({r.user_id for r in rows})
    return [StickerResponseOut(user=user_summary(r.user_id, people), value=r.value, created_at=r.created_at) for r in rows]


def send_countdown_reminders(db: Session) -> int:
    """Tell everyone who asked that a countdown has ended (run periodically)."""
    due = db.query(StoryCountdownReminder).filter(
        StoryCountdownReminder.notified.is_(False), StoryCountdownReminder.ends_at <= now()).all()
    for r in due:
        story = db.get(Story, r.story_id)
        r.notified = True
        db.commit()
        if story is not None:
            title = (sticker_of(story) or {}).get("title", "")
            notify(db, r.user_id, story.user_id, "story_countdown", story.id, title[:100])
    return len(due)


def _resolve_mentions(access: Access, graph: PostGraph, overlays: List[dict]) -> Set[uuid.UUID]:
    mentioned: Set[uuid.UUID] = set()
    me = access.viewer.user_id
    for overlay in overlays:
        if overlay["type"] != "mention":
            continue
        profile = graph.resolve_username(overlay["username"])
        if not profile or not profile.get("uuid"):
            raise HTTPException(status_code=422, detail=f"@{overlay['username']} was not found")
        target = uuid.UUID(str(profile["uuid"]))
        if target == me:
            continue
        mode = access.settings(target).allow_mentions
        if mode == "none":
            raise HTTPException(status_code=403, detail=f"@{overlay['username']} does not allow story mentions")
        if mode == "following" and not graph.relationship(access.viewer, target).owner_follows_viewer:
            raise HTTPException(status_code=403, detail=f"@{overlay['username']} only allows mentions from people they follow")
        mentioned.add(target)
    return mentioned


# ── Reading ──────────────────────────────────────────────────────────────────

def list_user_stories(db: Session, access: Access, owner: uuid.UUID) -> List[Story]:
    """Active stories of `owner` that the viewer may see, oldest first (the order they are watched)."""
    rows = (db.query(Story).filter(Story.user_id == owner, Story.expires_at > now())
            .order_by(Story.created_at.asc()).all())
    return [s for s in rows if access.can_view(s)]


def tray(db: Session, access: Access, graph: PostGraph) -> List[TrayItem]:
    me = access.viewer.user_id
    following = graph.following(access.viewer)
    people: Dict[uuid.UUID, dict] = {}
    for u in following:
        try:
            people[uuid.UUID(str(u["uuid"]))] = u
        except (KeyError, ValueError):
            continue
    owners = set(people) | {me}
    for o in people:
        access.known_following(o)
    access.preload(owners)

    rows = (db.query(Story).filter(Story.user_id.in_(owners), Story.expires_at > now())
            .order_by(Story.created_at.asc()).all())
    by_owner: Dict[uuid.UUID, List[Story]] = {}
    for s in rows:
        if access.can_view(s):
            by_owner.setdefault(s.user_id, []).append(s)
    if not by_owner:
        return []

    seen = {v.story_id for v in db.query(StoryView.story_id).filter(
        StoryView.viewer_id == me, StoryView.story_id.in_([s.id for v in by_owner.values() for s in v]))}
    muted = {m.owner_id for m in db.query(StoryMute).filter(StoryMute.viewer_id == me)}
    if me in by_owner and me not in people:
        people.update(graph.summaries([me]))

    items = []
    for owner, stories in by_owner.items():
        items.append(TrayItem(
            user=user_summary(owner, people),
            story_count=len(stories),
            has_unseen=owner != me and any(s.id not in seen for s in stories),
            latest_at=max(s.created_at for s in stories),
            is_me=owner == me,
            muted=owner in muted,
            close_friends=any(s.audience == Audience.close_friends.value for s in stories),
        ))
    # me first, then unseen before seen, muted last; newest first inside each group
    items.sort(key=lambda t: (not t.is_me, t.muted, not t.has_unseen, -_as_utc(t.latest_at).timestamp()))
    return items


def record_view(db: Session, story: Story, viewer: uuid.UUID) -> None:
    """Idempotent. Owners' own views are not counted."""
    if story.user_id == viewer:
        return
    if db.query(StoryView.id).filter_by(story_id=story.id, viewer_id=viewer).first():
        return
    db.add(StoryView(story_id=story.id, viewer_id=viewer))
    db.query(Story).filter(Story.id == story.id).update({Story.view_count: Story.view_count + 1})
    try:
        db.commit()
    except IntegrityError:  # a concurrent identical view won the race: nothing to do
        db.rollback()


def viewers_page(db: Session, graph: PostGraph, story: Story, page: int, size: int) -> List[StoryViewerOut]:
    views = (db.query(StoryView).filter(StoryView.story_id == story.id)
             .order_by(StoryView.viewed_at.desc()).offset((page - 1) * size).limit(size).all())
    ids = [v.viewer_id for v in views]
    reactions = {r.user_id: r.emoji for r in db.query(StoryReaction).filter(
        StoryReaction.story_id == story.id, StoryReaction.user_id.in_(ids))} if ids else {}
    replied = {r.sender_id for r in db.query(StoryReply.sender_id).filter(
        StoryReply.story_id == story.id, StoryReply.sender_id.in_(ids))} if ids else set()
    people = graph.summaries(ids)
    return [StoryViewerOut(viewer_id=v.viewer_id, viewed_at=v.viewed_at, user=user_summary(v.viewer_id, people),
                           reaction=reactions.get(v.viewer_id), replied=v.viewer_id in replied) for v in views]


def analytics(db: Session, story: Story) -> StoryAnalytics:
    unique = db.query(func.count(func.distinct(StoryView.viewer_id))).filter(StoryView.story_id == story.id).scalar() or 0
    replies = db.query(func.count()).select_from(StoryReply).filter(StoryReply.story_id == story.id).scalar() or 0
    reactions = {e: n for e, n in db.query(StoryReaction.emoji, func.count()).filter(
        StoryReaction.story_id == story.id).group_by(StoryReaction.emoji)}
    poll = None
    if _poll_options(story):
        counts = [0, 0]
        for option, n in db.query(StoryPollVote.option, func.count()).filter(
                StoryPollVote.story_id == story.id).group_by(StoryPollVote.option):
            counts[option] = n
        poll = PollResults(counts=counts, total=sum(counts))
    sticker = sticker_of(story)
    state = None
    if sticker:
        count = db.query(func.count()).select_from(StoryCountdownReminder).filter(StoryCountdownReminder.story_id == story.id).scalar() or 0
        state = sticker_state(sticker, _responses(db, [story.id]).get(story.id, []), story.user_id, True, False, count)
    return StoryAnalytics(story_id=story.id, views=story.view_count, unique_viewers=unique, replies=replies,
                          reactions=reactions, link_clicks=story.link_clicks, poll=poll, sticker=state,
                          expires_at=story.expires_at)


def archive_page(db: Session, access: Access, page: int, size: int) -> List[StoryOut]:
    rows = (db.query(Story).filter(Story.user_id == access.viewer.user_id)
            .order_by(Story.created_at.desc()).offset((page - 1) * size).limit(size).all())
    return serialize(db, access, rows)


# ── Interactions ─────────────────────────────────────────────────────────────

def add_reply(db: Session, access: Access, story: Story, text: str) -> StoryReply:
    if not access.can_reply(story):
        raise HTTPException(status_code=403, detail="Replies are turned off for this story")
    reply = StoryReply(story_id=story.id, sender_id=access.viewer.user_id, text=text)
    db.add(reply)
    db.commit()
    db.refresh(reply)
    notify(db, story.user_id, access.viewer.user_id, "story_reply", story.id, text[:100])
    return reply


def replies_page(db: Session, graph: PostGraph, story: Story, page: int, size: int) -> List[ReplyOut]:
    rows = (db.query(StoryReply).filter(StoryReply.story_id == story.id)
            .order_by(StoryReply.created_at.desc()).offset((page - 1) * size).limit(size).all())
    people = graph.summaries({r.sender_id for r in rows})
    return [ReplyOut(id=r.id, story_id=r.story_id, sender_id=r.sender_id, text=r.text, created_at=r.created_at,
                     user=user_summary(r.sender_id, people)) for r in rows]


def set_reaction(db: Session, access: Access, story: Story, emoji: str) -> None:
    me = access.viewer.user_id
    if story.user_id == me:
        raise HTTPException(status_code=400, detail="You cannot react to your own story")
    row = db.query(StoryReaction).filter_by(story_id=story.id, user_id=me).first()
    if row:
        row.emoji = emoji
        db.commit()
        return
    db.add(StoryReaction(story_id=story.id, user_id=me, emoji=emoji))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        db.query(StoryReaction).filter_by(story_id=story.id, user_id=me).update({StoryReaction.emoji: emoji})
        db.commit()
        return
    notify(db, story.user_id, me, "story_reaction", story.id, emoji)


def remove_reaction(db: Session, viewer: uuid.UUID, story: Story) -> None:
    db.query(StoryReaction).filter_by(story_id=story.id, user_id=viewer).delete()
    db.commit()


def vote(db: Session, viewer: uuid.UUID, story: Story, option: int) -> PollResults:
    options = _poll_options(story)
    if not options:
        raise HTTPException(status_code=400, detail="This story has no poll")
    if story.user_id == viewer:
        raise HTTPException(status_code=400, detail="You cannot vote on your own poll")
    db.add(StoryPollVote(story_id=story.id, user_id=viewer, option=option))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You have already voted")
    notify(db, story.user_id, viewer, "story_poll_vote", story.id, options[option][:100])
    counts = [0, 0]
    for opt, n in db.query(StoryPollVote.option, func.count()).filter(
            StoryPollVote.story_id == story.id).group_by(StoryPollVote.option):
        counts[opt] = n
    return PollResults(counts=counts, total=sum(counts), my_vote=option)


def count_link_click(db: Session, story: Story) -> None:
    db.query(Story).filter(Story.id == story.id).update({Story.link_clicks: Story.link_clicks + 1})
    db.commit()


def report(db: Session, viewer: uuid.UUID, story: Story, reason: str, details: Optional[str]) -> None:
    if story.user_id == viewer:
        raise HTTPException(status_code=400, detail="You cannot report your own story")
    db.add(StoryReport(story_id=story.id, reporter_id=viewer, reason=reason, details=details))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()  # already reported by this person: treat as success, keep one report


# ── Deleting ─────────────────────────────────────────────────────────────────

def delete_stories(db: Session, story_ids: List[uuid.UUID]) -> int:
    """Remove stories and everything attached to them (rows, highlight entries, media files)."""
    if not story_ids:
        return 0
    stories = db.query(Story).filter(Story.id.in_(story_ids)).all()
    media_ids = [s.media_id for s in stories if s.media_id]
    assets = db.query(StoryMedia).filter(StoryMedia.id.in_(media_ids)).all() if media_ids else []
    affected = {i.highlight_id for i in db.query(HighlightItem).filter(HighlightItem.story_id.in_(story_ids))}
    for model in (StoryView, StoryReply, StoryReaction, StoryPollVote, StoryMention, HighlightItem,
                  StoryStickerResponse, StoryCountdownReminder):
        db.query(model).filter(model.story_id.in_(story_ids)).delete(synchronize_session=False)
    db.query(StoryNotification).filter(StoryNotification.story_id.in_(story_ids)).delete(synchronize_session=False)
    db.query(StoryReport).filter(StoryReport.story_id.in_(story_ids)).delete(synchronize_session=False)
    for s in stories:
        db.delete(s)
    for h_id in affected:  # a highlight with no stories left disappears; a lost cover falls back to the first story
        remaining = db.query(HighlightItem).filter(HighlightItem.highlight_id == h_id).order_by(HighlightItem.position).all()
        highlight = db.get(Highlight, h_id)
        if highlight is None:
            continue
        if not remaining:
            db.delete(highlight)
        elif highlight.cover_story_id in story_ids:
            highlight.cover_story_id = remaining[0].story_id
    for a in assets:
        db.delete(a)
    db.commit()
    for a in assets:
        media_lib.delete_file(a.storage_key)
    return len(stories)


def delete_own_story(db: Session, viewer: uuid.UUID, story_id: uuid.UUID) -> None:
    story = require_own_story(db, viewer, story_id)
    delete_stories(db, [story.id])
