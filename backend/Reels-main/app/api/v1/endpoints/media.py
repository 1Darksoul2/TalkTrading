import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.v1.deps import get_current_user
from app.core.config import settings
from app.core.security import TokenData
from app.schemas.common import APIResponse

router = APIRouter()

CHUNK = 1024 * 1024


def _video_kind(head: bytes):
    """Recognise the container from the file's first bytes, never from the name the browser sent."""
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return ".webm", "video/webm"
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand == b"qt  ":
            return ".mov", "video/quicktime"
        return ".mp4", "video/mp4"
    return None


def _image_kind(head: bytes):
    if head[:3] == b"\xff\xd8\xff":
        return ".jpg", "image/jpeg"
    if head[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png", "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return ".webp", "image/webp"
    return None


async def _save(upload: UploadFile, detect, max_bytes: int, what: str):
    head = await upload.read(16)
    kind = detect(head)
    if kind is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, f"Unsupported {what} format.")
    ext, mime = kind
    os.makedirs(settings.MEDIA_DIR, exist_ok=True)
    name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.MEDIA_DIR, name)
    size = len(head)
    try:
        with open(path, "wb") as out:
            out.write(head)
            while chunk := await upload.read(CHUNK):
                size += len(chunk)
                if size > max_bytes:
                    raise HTTPException(
                        status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        f"The {what} is larger than {max_bytes // (1024 * 1024)} MB.",
                    )
                out.write(chunk)
    except BaseException:
        if os.path.exists(path):
            os.remove(path)
        raise
    return f"{settings.API_V1_PREFIX}/media/files/{name}", mime, size


@router.post("", status_code=status.HTTP_201_CREATED)
async def upload_reel_media(
    video: UploadFile = File(...),
    poster: UploadFile | None = File(None),
    current_user: TokenData = Depends(get_current_user),
):
    """Store a reel's video (and optional poster frame). The returned URLs go into POST /reels."""
    video_url, mime, size = await _save(video, _video_kind, settings.MAX_VIDEO_MB * 1024 * 1024, "video")
    poster_url = None
    if poster is not None:
        poster_url, _, _ = await _save(poster, _image_kind, 5 * 1024 * 1024, "poster image")
    return APIResponse(data={
        "video_url": video_url,
        "thumbnail_url": poster_url,
        "mime_type": mime,
        "file_size_bytes": size,
    })
