from typing import List, Optional, Union
from sqlalchemy.orm import Session

from app.models.comment import Comment
from app.models.post import PostStatus
from app.schemas.comment import CommentCreate, CommentUpdate
from app.repositories.comment_repository import CommentRepository
from app.repositories.post_repository import PostRepository
from app.models.notification import NotificationType
from app.services import mention_service, notification_service


def add_comment(
    db: Session,
    post_id: int,
    comment_data: CommentCreate,
    author_id: int,
) -> Union[Comment, str, None]:
    post_repo = PostRepository(db)
    post = post_repo.get_by_id(post_id)

    if post is None or post.status != PostStatus.ACTIVE:
        return None

    comment_repo = CommentRepository(db)

    # Validate parent_comment_id if replying
    if comment_data.parent_comment_id is not None:
        parent_comment = comment_repo.get_by_id(comment_data.parent_comment_id)
        if parent_comment is None or parent_comment.post_id != post_id:
            return "invalid_parent"

    try:
        # Atomic Transaction: Create comment + increment counter in single transaction boundary
        comment = comment_repo.create(
            post_id=post_id,
            author_id=author_id,
            content=comment_data.content,
            parent_comment_id=comment_data.parent_comment_id,
            commit=False,
        )
        post_repo.increment_counter(post_id, "comment_count", delta=1, commit=False)
        db.commit()
        db.refresh(comment)
        mention_service.sync_mentions(db, comment.content, author_id, comment_id=comment.id)
        notification_service.notify(db, post.author_id, author_id, NotificationType.COMMENT, post_id=post_id, comment_id=comment.id)
        return comment
    except Exception:
        db.rollback()
        raise


def get_comments_for_post(
    db: Session,
    post_id: int,
    page: int = 1,
    limit: int = 20,
) -> List[Comment]:
    comment_repo = CommentRepository(db)
    return comment_repo.get_by_post_id(post_id, page=page, limit=limit)


def get_comment_by_id(db: Session, comment_id: int) -> Optional[Comment]:
    comment_repo = CommentRepository(db)
    return comment_repo.get_by_id(comment_id)


def update_comment(
    db: Session,
    comment_id: int,
    comment_data: CommentUpdate,
    current_user_id: int,
) -> Union[Comment, str, None]:
    comment_repo = CommentRepository(db)
    comment = comment_repo.get_by_id(comment_id)

    if comment is None:
        return None

    if comment.author_id != current_user_id:
        return "forbidden"

    updated = comment_repo.update(comment, comment_data.content)
    mention_service.sync_mentions(db, updated.content, current_user_id, comment_id=updated.id)
    return updated


def delete_comment(
    db: Session,
    comment_id: int,
    current_user_id: int,
) -> Union[bool, str, None]:
    comment_repo = CommentRepository(db)
    comment = comment_repo.get_by_id(comment_id)

    if comment is None:
        return None

    if comment.author_id != current_user_id:
        return "forbidden"

    post_id = comment.post_id
    try:
        # Atomic Transaction: Delete comment + decrement counter in single transaction boundary
        comment_repo.delete(comment, soft_delete=True, commit=False)
        post_repo = PostRepository(db)
        post_repo.increment_counter(post_id, "comment_count", delta=-1, commit=False)
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise