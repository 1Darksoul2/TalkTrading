import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.reel import Reel, ReelMedia, AudioTrack, ReelStatus, ReelVisibility
from app.models.interaction import ReelLike, ReelBookmark
from app.schemas.reel import ReelCreate, ReelUpdate


class ReelService:
    @staticmethod
    def create_reel(db: Session, user_id: str, reel_in: ReelCreate) -> Reel:
        reel_id = str(uuid.uuid4())
        
        # Format tags
        tags_str = ",".join([t.strip().lstrip("#") for t in reel_in.tags]) if reel_in.tags else None

        # Audio Track handling
        audio_id = None
        if reel_in.audio:
            audio_track = AudioTrack(
                id=str(uuid.uuid4()),
                title=reel_in.audio.title,
                artist=reel_in.audio.artist,
                audio_url=reel_in.audio.audio_url,
                duration=reel_in.audio.duration,
                is_original=reel_in.audio.is_original
            )
            db.add(audio_track)
            audio_id = audio_track.id

        # Reel entity
        reel = Reel(
            id=reel_id,
            user_id=user_id,
            caption=reel_in.caption,
            tags=tags_str,
            status=ReelStatus.ACTIVE,
            visibility=reel_in.visibility,
            allow_comments=reel_in.allow_comments,
            allow_duet=reel_in.allow_duet,
            allow_sharing=reel_in.allow_sharing,
            audio_id=audio_id
        )
        db.add(reel)

        # Reel Media (URLs only, video stored in external S3/CDN)
        media = ReelMedia(
            id=str(uuid.uuid4()),
            reel_id=reel_id,
            video_url=reel_in.media.video_url,
            thumbnail_url=reel_in.media.thumbnail_url,
            preview_gif_url=reel_in.media.preview_gif_url,
            duration=reel_in.media.duration,
            width=reel_in.media.width,
            height=reel_in.media.height,
            aspect_ratio=reel_in.media.aspect_ratio,
            file_size_bytes=reel_in.media.file_size_bytes,
            mime_type=reel_in.media.mime_type,
            video_codec=reel_in.media.video_codec
        )
        db.add(media)
        
        db.commit()
        db.refresh(reel)
        return reel

    @staticmethod
    def get_reel_by_id(db: Session, reel_id: str, current_user_id: Optional[str] = None) -> Reel:
        reel = db.query(Reel).filter(Reel.id == reel_id).first()
        if not reel or reel.status == ReelStatus.DELETED:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reel not found"
            )
        
        # Check privacy
        if reel.visibility == ReelVisibility.PRIVATE and reel.user_id != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This reel is private"
            )

        # Attach personalization flags dynamically
        if current_user_id:
            reel.is_liked = db.query(ReelLike).filter_by(reel_id=reel_id, user_id=current_user_id).first() is not None
            reel.is_bookmarked = db.query(ReelBookmark).filter_by(reel_id=reel_id, user_id=current_user_id).first() is not None
        else:
            reel.is_liked = False
            reel.is_bookmarked = False

        return reel

    @staticmethod
    def update_reel(db: Session, reel_id: str, user_id: str, update_in: ReelUpdate) -> Reel:
        reel = db.query(Reel).filter(Reel.id == reel_id, Reel.status != ReelStatus.DELETED).first()
        if not reel:
            raise HTTPException(status_code=404, detail="Reel not found")
        
        # Strict ownership check
        if reel.user_id != user_id:
            raise HTTPException(status_code=403, detail="You do not have permission to edit this reel")

        update_data = update_in.model_dump(exclude_unset=True)
        if "tags" in update_data and update_data["tags"] is not None:
            update_data["tags"] = ",".join([t.strip().lstrip("#") for t in update_data["tags"]])
        
        for field, value in update_data.items():
            setattr(reel, field, value)

        db.commit()
        db.refresh(reel)
        return reel

    @staticmethod
    def delete_reel(db: Session, reel_id: str, user_id: str, is_admin: bool = False) -> bool:
        reel = db.query(Reel).filter(Reel.id == reel_id, Reel.status != ReelStatus.DELETED).first()
        if not reel:
            raise HTTPException(status_code=404, detail="Reel not found")
        
        if reel.user_id != user_id and not is_admin:
            raise HTTPException(status_code=403, detail="You do not have permission to delete this reel")

        # Soft delete
        reel.status = ReelStatus.DELETED
        db.commit()
        return True

    @staticmethod
    def increment_view(db: Session, reel_id: str):
        reel = db.query(Reel).filter(Reel.id == reel_id, Reel.status == ReelStatus.ACTIVE).first()
        if reel:
            reel.views_count += 1
            db.commit()
            return True
        return False
