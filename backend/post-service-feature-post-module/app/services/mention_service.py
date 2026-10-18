import re
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.visibility import can_view, viewable_filter
from app.models.comment import Comment
from app.models.mention import Mention
from app.models.post import Post, PostStatus
from app.models.notification import NotificationType
from app.models.user import User
from app.services import notification_service

MENTION_PATTERN = re.compile(r"@(\w+)")


def sync_mentions(
    db: Session,
    text: Optional[str],
    author_id: int,
    post_id: Optional[int] = None,
    comment_id: Optional[int] = None,
) -> List[int]:
    """Store who `text` mentions, replacing earlier rows for the same post/comment.

    Only usernames that belong to real accounts are stored; mentioning yourself is ignored.
    """
    owner = Mention.post_id == post_id if post_id is not None else Mention.comment_id == comment_id
    db.query(Mention).filter(owner).delete(synchronize_session=False)

    names = {name.lower() for name in MENTION_PATTERN.findall(text or "")}
    ids = []
    if names:
        users = db.query(User).filter(func.lower(User.username).in_(names), User.author_id != author_id).all()
        ids = [u.author_id for u in users]
    db.add_all(Mention(post_id=post_id, comment_id=comment_id, mentioned_user_id=uid) for uid in ids)
    db.commit()
    _notify_mentioned(db, ids, author_id, post_id, comment_id)
    return ids


def _notify_mentioned(db: Session, ids: List[int], author_id: int, post_id: Optional[int], comment_id: Optional[int]) -> None:
    # A comment mention points at the comment's post; people who cannot see that post are not told about it.
    if post_id is None:
        comment = db.get(Comment, comment_id)
        post_id = comment.post_id if comment else None
    post = db.get(Post, post_id) if post_id is not None else None
    for uid in ids:
        if post and can_view(post, uid, db):
            notification_service.notify(db, uid, author_id, NotificationType.MENTION, post_id=post.id, comment_id=comment_id)


def posts_mentioning(db: Session, user_id: int, viewer_id: Optional[int], page: int, limit: int) -> List[Post]:
    """Posts that mention `user_id` and that `viewer_id` is allowed to see, newest first."""
    return (
        db.query(Post)
        .join(Mention, Mention.post_id == Post.id)
        .filter(Mention.mentioned_user_id == user_id, Post.status == PostStatus.ACTIVE, viewable_filter(viewer_id))
        .order_by(Post.created_at.desc(), Post.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
