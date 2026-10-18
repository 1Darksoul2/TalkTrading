import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.reel import Reel, ReelStatus
from app.models.comment import Comment
from app.schemas.comment import CommentCreate


class CommentService:
    @staticmethod
    def add_comment(db: Session, reel_id: str, user_id: str, comment_in: CommentCreate) -> Comment:
        reel = db.query(Reel).filter(Reel.id == reel_id, Reel.status == ReelStatus.ACTIVE).first()
        if not reel:
            raise HTTPException(status_code=404, detail="Reel not found")

        if not reel.allow_comments:
            raise HTTPException(status_code=403, detail="Comments are disabled on this reel")

        # If parent_id specified, check that parent comment exists
        if comment_in.parent_id:
            parent = db.query(Comment).filter(
                Comment.id == comment_in.parent_id,
                Comment.reel_id == reel_id,
                Comment.is_deleted == False
            ).first()
            if not parent:
                raise HTTPException(status_code=404, detail="Parent comment not found")
            parent.replies_count += 1

        comment = Comment(
            id=str(uuid.uuid4()),
            reel_id=reel_id,
            user_id=user_id,
            parent_id=comment_in.parent_id,
            content=comment_in.content
        )
        db.add(comment)
        reel.comments_count += 1
        db.commit()
        db.refresh(comment)
        return comment

    @staticmethod
    def get_comments(db: Session, reel_id: str, skip: int = 0, limit: int = 20) -> List[Comment]:
        # Return top-level comments with replies attached
        comments = (
            db.query(Comment)
            .filter(
                Comment.reel_id == reel_id,
                Comment.parent_id == None,
                Comment.is_deleted == False
            )
            .order_by(Comment.is_pinned.desc(), Comment.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return comments

    @staticmethod
    def delete_comment(db: Session, comment_id: str, user_id: str, is_admin: bool = False) -> bool:
        comment = db.query(Comment).filter(Comment.id == comment_id).first()
        if not comment or comment.is_deleted:
            raise HTTPException(status_code=404, detail="Comment not found")

        # Can delete if owner of comment OR owner of reel OR admin
        reel = db.query(Reel).filter(Reel.id == comment.reel_id).first()
        if comment.user_id != user_id and (not reel or reel.user_id != user_id) and not is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to delete this comment")

        comment.is_deleted = True
        if reel and reel.comments_count > 0:
            reel.comments_count -= 1
        db.commit()
        return True
