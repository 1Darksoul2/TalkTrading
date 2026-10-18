import uuid
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from app.models.reel import Reel, ReelStatus
from app.models.interaction import ReelLike, ReelBookmark, ReelShare
from app.schemas.interaction import LikeResponse, BookmarkResponse, ShareResponse


class InteractionService:
    @staticmethod
    def toggle_like(db: Session, reel_id: str, user_id: str) -> LikeResponse:
        reel = db.query(Reel).filter(Reel.id == reel_id, Reel.status == ReelStatus.ACTIVE).first()
        if not reel:
            raise HTTPException(status_code=404, detail="Reel not found")

        existing = db.query(ReelLike).filter_by(reel_id=reel_id, user_id=user_id).first()
        if existing:
            db.delete(existing)
            db.flush()
            # Recalculate or atomically decrement safely
            reel.likes_count = db.query(ReelLike).filter_by(reel_id=reel_id).count()
            liked = False
        else:
            try:
                new_like = ReelLike(
                    id=str(uuid.uuid4()),
                    reel_id=reel_id,
                    user_id=user_id
                )
                db.add(new_like)
                db.flush()
                reel.likes_count = db.query(ReelLike).filter_by(reel_id=reel_id).count()
                liked = True
            except IntegrityError:
                # Handled race condition: unique constraint triggered
                db.rollback()
                reel = db.query(Reel).filter(Reel.id == reel_id).first()
                return LikeResponse(
                    reel_id=reel_id,
                    liked=True,
                    likes_count=db.query(ReelLike).filter_by(reel_id=reel_id).count()
                )

        db.commit()
        db.refresh(reel)
        return LikeResponse(reel_id=reel_id, liked=liked, likes_count=reel.likes_count)

    @staticmethod
    def toggle_bookmark(db: Session, reel_id: str, user_id: str) -> BookmarkResponse:
        reel = db.query(Reel).filter(Reel.id == reel_id, Reel.status == ReelStatus.ACTIVE).first()
        if not reel:
            raise HTTPException(status_code=404, detail="Reel not found")

        existing = db.query(ReelBookmark).filter_by(reel_id=reel_id, user_id=user_id).first()
        if existing:
            db.delete(existing)
            db.flush()
            reel.bookmarks_count = db.query(ReelBookmark).filter_by(reel_id=reel_id).count()
            bookmarked = False
        else:
            try:
                new_bm = ReelBookmark(
                    id=str(uuid.uuid4()),
                    reel_id=reel_id,
                    user_id=user_id
                )
                db.add(new_bm)
                db.flush()
                reel.bookmarks_count = db.query(ReelBookmark).filter_by(reel_id=reel_id).count()
                bookmarked = True
            except IntegrityError:
                db.rollback()
                reel = db.query(Reel).filter(Reel.id == reel_id).first()
                return BookmarkResponse(
                    reel_id=reel_id,
                    bookmarked=True,
                    bookmarks_count=db.query(ReelBookmark).filter_by(reel_id=reel_id).count()
                )

        db.commit()
        db.refresh(reel)
        return BookmarkResponse(reel_id=reel_id, bookmarked=bookmarked, bookmarks_count=reel.bookmarks_count)

    @staticmethod
    def record_share(db: Session, reel_id: str, user_id: str = None, platform: str = "direct") -> ShareResponse:
        reel = db.query(Reel).filter(Reel.id == reel_id, Reel.status == ReelStatus.ACTIVE).first()
        if not reel:
            raise HTTPException(status_code=404, detail="Reel not found")

        share = ReelShare(
            id=str(uuid.uuid4()),
            reel_id=reel_id,
            user_id=user_id,
            platform=platform
        )
        db.add(share)
        db.flush()
        reel.shares_count = db.query(ReelShare).filter_by(reel_id=reel_id).count()
        db.commit()
        db.refresh(reel)
        return ShareResponse(reel_id=reel_id, shares_count=reel.shares_count, platform=platform)
