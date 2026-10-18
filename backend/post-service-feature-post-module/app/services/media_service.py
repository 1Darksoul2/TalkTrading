import os
from typing import List, Optional, Union
from sqlalchemy.orm import Session
from fastapi import UploadFile, HTTPException, status

from app.models.media import Media, MediaType
from app.repositories.media_repository import MediaRepository
from app.repositories.post_repository import PostRepository
from app.integrations.storage import get_storage_provider
from app.core.config import settings


def validate_magic_bytes(content: bytes, content_type: str) -> bool:
    """Validate file magic bytes signatures."""
    if len(content) < 4:
        return False
    if "jpeg" in content_type:
        return content.startswith(b"\xff\xd8\xff")
    if "png" in content_type:
        return content.startswith(b"\x89PNG\r\n\x1a\n")
    if "gif" in content_type:
        return content.startswith(b"GIF8")
    if "webp" in content_type:
        return content.startswith(b"RIFF") and b"WEBP" in content[:16]
    if "mp4" in content_type or "quicktime" in content_type or "webm" in content_type:
        return b"ftyp" in content[:32] or content.startswith(b"\x1a\x45\xdf\xa3")
    return True  # Fallback allowed for standard binary uploads in dev


async def add_media_to_post(
    db: Session,
    post_id: int,
    file: UploadFile,
    current_user_id: int,
    position: int = 0,
) -> Union[Media, str, None]:
    post_repo = PostRepository(db)
    post = post_repo.get_by_id(post_id)

    if post is None:
        return None

    if post.author_id != current_user_id:
        return "forbidden"

    filename = file.filename or "media_file"
    ext = os.path.splitext(filename)[1].lower()

    # 1. Extension Validation
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext}'. Allowed extensions: {settings.ALLOWED_EXTENSIONS}",
        )

    # 2. MIME Type Validation
    content_type = (file.content_type or "").lower()
    allowed_mimes = settings.ALLOWED_IMAGE_TYPES + settings.ALLOWED_VIDEO_TYPES
    if content_type not in allowed_mimes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported MIME type '{content_type}'. Allowed types: {allowed_mimes}",
        )

    # 3. File Size Validation
    content = await file.read()
    max_bytes = settings.MAX_MEDIA_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum limit of {settings.MAX_MEDIA_SIZE_MB}MB",
        )

    # 4. Magic Bytes Inspection
    if not validate_magic_bytes(content, content_type):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File header magic bytes do not match reported content-type",
        )

    media_type = MediaType.VIDEO if content_type in settings.ALLOWED_VIDEO_TYPES else MediaType.IMAGE

    storage_provider = get_storage_provider()
    storage_key, public_url = await storage_provider.upload(content, filename, content_type)

    media_repo = MediaRepository(db)
    return media_repo.create(
        post_id=post_id,
        media_type=media_type,
        storage_key=storage_key,
        url=public_url,
        position=position,
    )


async def delete_media(
    db: Session,
    media_id: int,
    current_user_id: int,
) -> Union[bool, str, None]:
    media_repo = MediaRepository(db)
    media = media_repo.get_by_id(media_id)

    if media is None:
        return None

    post_repo = PostRepository(db)
    post = post_repo.get_by_id(media.post_id, include_non_active=True)

    if post is None or post.author_id != current_user_id:
        return "forbidden"

    storage_provider = get_storage_provider()
    await storage_provider.delete(media.storage_key)

    return media_repo.delete(media)
