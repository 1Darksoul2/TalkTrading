"""All HTTP routes of the Story Service.

Static paths (`/stories/tray`, `/stories/archive`, ...) are declared before `/stories/{story_id}`
so they are never captured by the id route.
"""
import os
import uuid
from typing import List, Optional

import boto3
from botocore.exceptions import NoCredentialsError
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from . import media as media_lib
from . import notifications as notif
from . import social_service as social
from . import stories_service as svc
from .access import Access
from .auth import Principal, get_principal
from .config import settings
from .database import get_db
from .graph import PostGraph, get_graph
from .models import StoryMedia
from .schemas import (
    HighlightCreate, HighlightDetail, HighlightOrder, HighlightOut, HighlightUpdate, NotificationList,
    NotificationOut, PollResults, PollVoteCreate, PresignRequest, PresignResponse, QuestionAnswer, QuizAnswer,
    ReactionSet, ReplyCreate, ReplyOut, ReportCreate, SliderAnswer, StickerResponseOut, StoryAnalytics, StoryCreate,
    StoryOut, StorySettingsOut, StorySettingsUpdate, StoryViewerOut, TrayItem, UploadOut, UserListItem, UserRef,
)
from .stories_service import user_summary


def _user_key(request: Request) -> str:
    """Rate-limit per account when logged in (the token is only decoded, never trusted here), else per IP."""
    auth = request.headers.get("authorization", "")
    return auth[-24:] if auth.startswith("Bearer ") else get_remote_address(request)


limiter = Limiter(key_func=_user_key)
router = APIRouter()


def get_access(
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
    graph: PostGraph = Depends(get_graph),
) -> Access:
    return Access(db, principal, graph)


# ── Media ────────────────────────────────────────────────────────────────────

@router.post("/stories/media", response_model=UploadOut, status_code=201, tags=["media"])
@limiter.limit(lambda: settings.upload_rate_limit)
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    principal: Principal = Depends(get_principal),
    db: Session = Depends(get_db),
):
    """Validate and store an image/video. Publish it with POST /stories using the returned `media_id`."""
    info = await media_lib.store_upload(file)
    asset = StoryMedia(owner_id=principal.user_id, storage_key=info["key"], media_type=info["media_type"],
                       mime_type=info["mime"], size_bytes=info["size"], width=info["width"],
                       height=info["height"], duration=info["duration"])
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return UploadOut(media_id=asset.id, media_type=asset.media_type, url=media_lib.signed_path(asset.storage_key),
                     width=asset.width, height=asset.height, duration=asset.duration, size_bytes=asset.size_bytes)


@router.get("/media/{key}", tags=["media"], include_in_schema=False)
def serve_media(key: str, t: str = Query(...)):
    """Serve a stored file to someone holding a valid, unexpired signed URL."""
    if not media_lib.verify_token(key, t):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Link expired or invalid")
    path = media_lib.media_path(key)
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Media not found")
    ext = key.rsplit(".", 1)[1]
    return FileResponse(path, media_type=media_lib.CONTENT_TYPES[ext], headers={
        "Cache-Control": f"private, max-age={settings.media_url_ttl_seconds}",
        "X-Content-Type-Options": "nosniff",
    })


@router.post("/stories/presign", response_model=PresignResponse, tags=["stories"])
def presign_upload(body: PresignRequest, principal: Principal = Depends(get_principal)):
    """S3 presigned PUT URL for deployments that use S3 (needs AWS credentials; not used by the web app)."""
    s3_key = f"stories/{principal.user_id}/{uuid.uuid4()}/{os.path.basename(body.filename)}"
    public_url = f"https://{settings.s3_bucket}.s3.{settings.aws_region}.amazonaws.com/{s3_key}"
    try:
        s3 = boto3.client("s3", region_name=settings.aws_region,
                          aws_access_key_id=settings.aws_access_key_id or None,
                          aws_secret_access_key=settings.aws_secret_access_key or None)
        presigned = s3.generate_presigned_url(
            "put_object", Params={"Bucket": settings.s3_bucket, "Key": s3_key, "ContentType": body.content_type},
            ExpiresIn=settings.presign_expiry_seconds)
    except NoCredentialsError:
        raise HTTPException(status_code=500, detail="S3 credentials not configured")
    return PresignResponse(upload_url=presigned, media_url=public_url, expires_in=settings.presign_expiry_seconds)


# ── Publishing and reading stories ───────────────────────────────────────────

@router.post("/stories", response_model=StoryOut, status_code=201, tags=["stories"])
@limiter.limit(lambda: f"{settings.rate_limit_per_minute}/minute")
def create_story(
    request: Request,
    data: StoryCreate,
    access: Access = Depends(get_access),
    db: Session = Depends(get_db),
    graph: PostGraph = Depends(get_graph),
):
    """Publish a story. The owner is always the logged-in user; any `user_id` in the body is ignored."""
    story = svc.create_story(db, access, graph, data)
    return svc.serialize(db, access, [story])[0]


@router.get("/stories/tray", response_model=List[TrayItem], tags=["stories"])
def get_tray(access: Access = Depends(get_access), db: Session = Depends(get_db), graph: PostGraph = Depends(get_graph)):
    """People you follow (and you) with stories you may see: yours first, unseen before seen, muted last."""
    return svc.tray(db, access, graph)


@router.get("/stories/archive", response_model=List[StoryOut], tags=["stories"])
def get_archive(page: int = Query(1, ge=1), size: int = Query(30, ge=1, le=60),
                access: Access = Depends(get_access), db: Session = Depends(get_db)):
    """Your own stories, newest first, including expired ones (kept unless you turn archiving off)."""
    return svc.archive_page(db, access, page, size)


@router.get("/stories/feed", response_model=List[StoryOut], tags=["stories"])
def get_feed(user_ids: List[uuid.UUID] = Query(...), access: Access = Depends(get_access), db: Session = Depends(get_db)):
    """Active stories of the listed accounts, limited to what you are allowed to see."""
    stories = []
    for owner in dict.fromkeys(user_ids[:50]):
        stories.extend(svc.list_user_stories(db, access, owner))
    stories.sort(key=lambda s: s.created_at, reverse=True)
    return svc.serialize(db, access, stories)


@router.get("/stories/user/{user_id}", response_model=List[StoryOut], tags=["stories"])
def get_user_stories(user_id: uuid.UUID, access: Access = Depends(get_access), db: Session = Depends(get_db)):
    """Active stories of one account that you may see, in watching order (oldest first)."""
    return svc.serialize(db, access, svc.list_user_stories(db, access, user_id))


@router.get("/stories/{story_id}", response_model=StoryOut, tags=["stories"])
def get_story(story_id: uuid.UUID, access: Access = Depends(get_access), db: Session = Depends(get_db)):
    return svc.serialize(db, access, [svc.require_visible_story(db, access, story_id, allow_highlighted=True)])[0]


@router.post("/stories/{story_id}/view", status_code=204, tags=["stories"])
def view_story(story_id: uuid.UUID, access: Access = Depends(get_access), db: Session = Depends(get_db)):
    """Record that you viewed a story. Idempotent; owners' own views are not counted."""
    svc.record_view(db, svc.require_visible_story(db, access, story_id, allow_highlighted=True), access.viewer.user_id)


@router.delete("/stories/{story_id}", status_code=204, tags=["stories"])
def delete_story(story_id: uuid.UUID, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Delete your own story, its replies/reactions, its highlight entries and its media file."""
    svc.delete_own_story(db, principal.user_id, story_id)


# ── Owner-only views of a story ──────────────────────────────────────────────

@router.get("/stories/{story_id}/viewers", response_model=List[StoryViewerOut], tags=["analytics"])
def get_viewers(story_id: uuid.UUID, page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=100),
                principal: Principal = Depends(get_principal), db: Session = Depends(get_db),
                graph: PostGraph = Depends(get_graph)):
    """Who viewed your story (with reactions and whether they replied), newest first. Owner only."""
    story = svc.require_own_story(db, principal.user_id, story_id)
    return svc.viewers_page(db, graph, story, page, size)


@router.get("/stories/{story_id}/analytics", response_model=StoryAnalytics, tags=["analytics"])
def get_analytics(story_id: uuid.UUID, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Views, unique viewers, replies, reactions, poll results and link taps. Owner only."""
    return svc.analytics(db, svc.require_own_story(db, principal.user_id, story_id))


@router.get("/stories/{story_id}/replies", response_model=List[ReplyOut], tags=["analytics"])
def get_replies(story_id: uuid.UUID, page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=100),
                principal: Principal = Depends(get_principal), db: Session = Depends(get_db),
                graph: PostGraph = Depends(get_graph)):
    """Replies sent to your story. Owner only."""
    story = svc.require_own_story(db, principal.user_id, story_id)
    return svc.replies_page(db, graph, story, page, size)


# ── Viewer interactions ──────────────────────────────────────────────────────

@router.post("/stories/{story_id}/replies", response_model=ReplyOut, status_code=201, tags=["interactions"])
@limiter.limit(lambda: settings.reply_rate_limit)
def reply_to_story(request: Request, story_id: uuid.UUID, body: ReplyCreate, access: Access = Depends(get_access),
                   db: Session = Depends(get_db)):
    story = svc.require_visible_story(db, access, story_id)
    reply = svc.add_reply(db, access, story, body.text)
    return ReplyOut(id=reply.id, story_id=reply.story_id, sender_id=reply.sender_id, text=reply.text,
                    created_at=reply.created_at)


@router.put("/stories/{story_id}/reaction", status_code=204, tags=["interactions"])
@limiter.limit(lambda: settings.reaction_rate_limit)
def react(request: Request, story_id: uuid.UUID, body: ReactionSet, access: Access = Depends(get_access),
          db: Session = Depends(get_db)):
    svc.set_reaction(db, access, svc.require_visible_story(db, access, story_id), body.emoji)


@router.delete("/stories/{story_id}/reaction", status_code=204, tags=["interactions"])
def unreact(story_id: uuid.UUID, access: Access = Depends(get_access), db: Session = Depends(get_db)):
    svc.remove_reaction(db, access.viewer.user_id, svc.require_visible_story(db, access, story_id))


@router.post("/stories/{story_id}/poll/vote", response_model=PollResults, tags=["interactions"])
def vote_in_poll(story_id: uuid.UUID, body: PollVoteCreate, access: Access = Depends(get_access),
                 db: Session = Depends(get_db)):
    return svc.vote(db, access.viewer.user_id, svc.require_visible_story(db, access, story_id), body.option)


@router.post("/stories/{story_id}/question", status_code=201, tags=["stickers"])
@limiter.limit(lambda: settings.reply_rate_limit)
def answer_question(request: Request, story_id: uuid.UUID, body: QuestionAnswer, access: Access = Depends(get_access),
                    db: Session = Depends(get_db)):
    """Send an answer to a question sticker. Only the story's owner can read answers."""
    svc.answer_question(db, access.viewer.user_id, svc.require_visible_story(db, access, story_id), body.text)
    return {"sent": True}


@router.get("/stories/{story_id}/question/answers", response_model=List[StickerResponseOut], tags=["stickers"])
def question_answers(story_id: uuid.UUID, page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=100),
                     principal: Principal = Depends(get_principal), db: Session = Depends(get_db),
                     graph: PostGraph = Depends(get_graph)):
    """Answers to your question sticker, newest first. Owner only."""
    return svc.question_answers(db, graph, svc.require_own_story(db, principal.user_id, story_id), page, size)


@router.post("/stories/{story_id}/slider", tags=["stickers"])
def answer_slider(story_id: uuid.UUID, body: SliderAnswer, access: Access = Depends(get_access), db: Session = Depends(get_db)):
    """Answer an emoji slider once (0-100); returns the average so far."""
    return svc.answer_slider(db, access.viewer.user_id, svc.require_visible_story(db, access, story_id), body.value)


@router.post("/stories/{story_id}/quiz", tags=["stickers"])
def answer_quiz(story_id: uuid.UUID, body: QuizAnswer, access: Access = Depends(get_access), db: Session = Depends(get_db)):
    """Answer a quiz once; the response reveals the correct answer and how everyone answered."""
    return svc.answer_quiz(db, access.viewer.user_id, svc.require_visible_story(db, access, story_id), body.option)


@router.put("/stories/{story_id}/countdown/reminder", tags=["stickers"])
def remind_me(story_id: uuid.UUID, access: Access = Depends(get_access), db: Session = Depends(get_db)):
    """Get a notification when this story's countdown ends."""
    return svc.set_countdown_reminder(db, access.viewer.user_id, svc.require_visible_story(db, access, story_id), True)


@router.delete("/stories/{story_id}/countdown/reminder", tags=["stickers"])
def stop_reminding(story_id: uuid.UUID, access: Access = Depends(get_access), db: Session = Depends(get_db)):
    return svc.set_countdown_reminder(db, access.viewer.user_id, svc.require_visible_story(db, access, story_id), False)


@router.post("/stories/{story_id}/link-click", status_code=204, tags=["interactions"])
def link_click(story_id: uuid.UUID, access: Access = Depends(get_access), db: Session = Depends(get_db)):
    story = svc.require_visible_story(db, access, story_id)
    if story.user_id != access.viewer.user_id:
        svc.count_link_click(db, story)


@router.post("/stories/{story_id}/report", status_code=204, tags=["interactions"])
def report_story(story_id: uuid.UUID, body: ReportCreate, access: Access = Depends(get_access),
                 db: Session = Depends(get_db)):
    svc.report(db, access.viewer.user_id, svc.require_visible_story(db, access, story_id), body.reason, body.details)


# ── Highlights ───────────────────────────────────────────────────────────────

@router.put("/highlights/order", status_code=204, tags=["highlights"])
def order_highlights(body: HighlightOrder, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    social.reorder_highlights(db, principal.user_id, body.ids)


@router.get("/highlights/user/{user_id}", response_model=List[HighlightOut], tags=["highlights"])
def user_highlights(user_id: uuid.UUID, access: Access = Depends(get_access), db: Session = Depends(get_db)):
    return social.list_highlights(db, access, user_id)


@router.post("/highlights", response_model=HighlightOut, status_code=201, tags=["highlights"])
def create_highlight(body: HighlightCreate, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return social.highlight_out(db, social.create_highlight(db, principal.user_id, body))


@router.get("/highlights/{highlight_id}", response_model=HighlightDetail, tags=["highlights"])
def get_highlight(highlight_id: uuid.UUID, access: Access = Depends(get_access), db: Session = Depends(get_db)):
    return social.highlight_detail(db, access, highlight_id)


@router.patch("/highlights/{highlight_id}", response_model=HighlightOut, tags=["highlights"])
def update_highlight(highlight_id: uuid.UUID, body: HighlightUpdate, principal: Principal = Depends(get_principal),
                     db: Session = Depends(get_db)):
    return social.highlight_out(db, social.update_highlight(db, principal.user_id, highlight_id, body))


@router.delete("/highlights/{highlight_id}", status_code=204, tags=["highlights"])
def delete_highlight(highlight_id: uuid.UUID, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    social.delete_highlight(db, principal.user_id, highlight_id)


# ── Close Friends, hide-from and muted stories ───────────────────────────────

def _list_routes(path: str, kind: str, tag: str):
    @router.get(path, response_model=List[UserListItem], tags=[tag], name=f"list_{kind}")
    def _list(page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=100),
              principal: Principal = Depends(get_principal), db: Session = Depends(get_db),
              graph: PostGraph = Depends(get_graph)):
        return social.list_members(db, graph, kind, principal.user_id, page, size)

    @router.post(path, status_code=204, tags=[tag], name=f"add_{kind}")
    def _add(body: UserRef, principal: Principal = Depends(get_principal), db: Session = Depends(get_db),
             graph: PostGraph = Depends(get_graph)):
        social.add_member(db, graph, kind, principal.user_id, body.user_id)

    @router.delete(path + "/{user_id}", status_code=204, tags=[tag], name=f"remove_{kind}")
    def _remove(user_id: uuid.UUID, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
        social.remove_member(db, kind, principal.user_id, user_id)


_list_routes("/close-friends", "close_friends", "close-friends")
_list_routes("/story-hidden", "hidden", "privacy")
_list_routes("/story-mutes", "muted", "privacy")


# ── Settings, notifications, data ────────────────────────────────────────────

@router.get("/story-settings", response_model=StorySettingsOut, tags=["settings"])
def read_settings(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return social.get_settings(db, principal.user_id)


@router.put("/story-settings", response_model=StorySettingsOut, tags=["settings"])
def write_settings(body: StorySettingsUpdate, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return social.update_settings(db, principal.user_id, body)


@router.get("/notifications", response_model=NotificationList, tags=["notifications"])
def list_notifications(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=50), unread_only: bool = False,
                       principal: Principal = Depends(get_principal), db: Session = Depends(get_db),
                       graph: PostGraph = Depends(get_graph)):
    rows = notif.page(db, principal.user_id, page, size, unread_only)
    people = graph.summaries({r.actor_id for r in rows})
    return NotificationList(
        unread_count=notif.unread_count(db, principal.user_id),
        notifications=[NotificationOut(id=r.id, type=r.type, story_id=r.story_id, text=r.text, is_read=r.is_read,
                                       created_at=r.created_at, actor=user_summary(r.actor_id, people)) for r in rows])


@router.get("/notifications/unread-count", tags=["notifications"])
def unread_count(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return {"unread_count": notif.unread_count(db, principal.user_id)}


@router.post("/notifications/read-all", tags=["notifications"])
def read_all(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    return {"marked": notif.mark_read(db, principal.user_id)}


@router.post("/notifications/{notification_id}/read", tags=["notifications"])
def read_one(notification_id: int, principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    if notif.mark_read(db, principal.user_id, notification_id) == 0:
        raise HTTPException(status_code=404, detail="Notification not found or already read")
    return {"marked": 1}


@router.get("/export", tags=["account"])
def export_my_data(principal: Principal = Depends(get_principal), db: Session = Depends(get_db)):
    """Everything this service stores about you, as a downloadable JSON document."""
    return JSONResponse(social.export_data(db, principal.user_id),
                        headers={"Content-Disposition": 'attachment; filename="story-data.json"'})


class ConfirmDelete(BaseModel):
    confirm: str


@router.delete("/account-data", tags=["account"])
def delete_my_story_data(body: ConfirmDelete, principal: Principal = Depends(get_principal),
                         db: Session = Depends(get_db)):
    """Permanently delete all your stories, highlights, lists, settings and notifications. Needs {"confirm": "DELETE"}."""
    if body.confirm != "DELETE":
        raise HTTPException(status_code=400, detail='Type "DELETE" to confirm')
    return social.delete_all_my_data(db, principal.user_id)
