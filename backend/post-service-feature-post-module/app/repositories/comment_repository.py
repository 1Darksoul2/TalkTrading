from typing import List, Optional
from sqlalchemy.orm import Session, selectinload

from app.models.comment import Comment, CommentStatus


class CommentRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, comment_id: int) -> Optional[Comment]:
        return (
            self.db.query(Comment)
            .filter(Comment.id == comment_id, Comment.status == CommentStatus.ACTIVE)
            .first()
        )

    def create(
        self,
        post_id: int,
        author_id: int,
        content: str,
        parent_comment_id: Optional[int] = None,
        commit: bool = True,
    ) -> Comment:
        comment = Comment(
            post_id=post_id,
            author_id=author_id,
            content=content,
            parent_comment_id=parent_comment_id,
            status=CommentStatus.ACTIVE,
        )
        self.db.add(comment)
        if commit:
            self.db.commit()
            self.db.refresh(comment)
        else:
            self.db.flush()
        return comment

    def get_by_post_id(
        self,
        post_id: int,
        page: int = 1,
        limit: int = 20,
    ) -> List[Comment]:
        # Return top-level comments (parent_comment_id IS NULL).
        # Include deleted parents if child replies exist so the reply tree hierarchy is preserved.
        offset = (page - 1) * limit
        top_comments = (
            self.db.query(Comment)
            .filter(
                Comment.post_id == post_id,
                Comment.parent_comment_id.is_(None),
            )
            .order_by(Comment.created_at.asc())
            .offset(offset)
            .limit(limit)
            .all()
        )

        result = []
        for c in top_comments:
            if c.status == CommentStatus.DELETED:
                # If deleted parent has active child replies, return placeholder comment node
                active_replies = [r for r in c.replies if r.status == CommentStatus.ACTIVE]
                if active_replies:
                    c.content = "[Comment deleted]"
                    c.author_id = 0
                    c.replies = active_replies
                    result.append(c)
            else:
                c.replies = [r for r in c.replies if r.status == CommentStatus.ACTIVE]
                result.append(c)

        return result

    def update(self, comment: Comment, content: str, commit: bool = True) -> Comment:
        comment.content = content
        if commit:
            self.db.commit()
            self.db.refresh(comment)
        else:
            self.db.flush()
        return comment

    def delete(self, comment: Comment, soft_delete: bool = True, commit: bool = True) -> bool:
        if soft_delete:
            comment.status = CommentStatus.DELETED
        else:
            self.db.delete(comment)

        if commit:
            self.db.commit()
        else:
            self.db.flush()
        return True
