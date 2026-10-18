"""
Story media: validation, storage and signed access.

* The real file type is detected from the bytes (never trusted from the browser's MIME type or name).
* Images are decoded and re-encoded with Pillow: corrupt files and decompression bombs are rejected and
  metadata (EXIF, GPS) is stripped. GIFs are validated but kept as-is so they stay animated.
* Videos are limited by size and, for MP4/MOV, by duration read from the container.
* Files live outside any public static mount. Access is only through short-lived signed URLs that are
  handed to viewers who passed the story's privacy checks.
"""
import io
import logging
import os
import re
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple

import filetype
from fastapi import HTTPException, UploadFile, status
from jose import JWTError, jwt
from mutagen.mp4 import MP4
from PIL import Image, ImageOps, UnidentifiedImageError

from .config import settings
from .models import MediaType

logger = logging.getLogger(__name__)

IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
VIDEO_TYPES = {"video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm"}
CONTENT_TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif",
                 "mp4": "video/mp4", "mov": "video/quicktime", "webm": "video/webm"}
KEY_PATTERN = re.compile(r"^[0-9a-f]{32}\.(jpg|png|webp|gif|mp4|mov|webm)$")
CHUNK = 1024 * 1024


def media_root() -> str:
    root = os.path.realpath(settings.media_dir)
    os.makedirs(root, exist_ok=True)
    return root


def media_path(key: str) -> str:
    """Absolute path for a storage key; refuses anything that is not one of our generated names."""
    if not KEY_PATTERN.match(key):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media not found")
    return os.path.join(media_root(), key)


def _bad(detail: str, code: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


async def read_limited(upload: UploadFile, limit: int) -> bytes:
    """Read the upload in chunks and stop as soon as it exceeds `limit` (no unbounded memory use)."""
    buf = bytearray()
    while True:
        chunk = await upload.read(CHUNK)
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > limit:
            raise _bad(f"File is too large (limit {limit // (1024 * 1024)} MB)", 413)
    return bytes(buf)


def _process_image(data: bytes, ext: str) -> Tuple[bytes, int, int]:
    Image.MAX_IMAGE_PIXELS = settings.max_image_pixels
    try:
        with Image.open(io.BytesIO(data)) as probe:
            probe.verify()
        img = Image.open(io.BytesIO(data))
        width, height = img.size
        if ext == "gif":
            if getattr(img, "n_frames", 1) > 300:
                raise _bad("GIF has too many frames")
            img.seek(0)
            return data, width, height  # validated, kept as-is so it stays animated
        img = ImageOps.exif_transpose(img)
        if max(img.size) > settings.max_image_side:
            img.thumbnail((settings.max_image_side, settings.max_image_side))
        out = io.BytesIO()
        if ext == "jpg":
            img.convert("RGB").save(out, "JPEG", quality=88, optimize=True)
        elif ext == "png":
            img.save(out, "PNG", optimize=True)
        else:
            img.save(out, "WEBP", quality=88)
        return out.getvalue(), img.size[0], img.size[1]
    except HTTPException:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError, ValueError) as exc:
        logger.info("Rejected image upload: %s", type(exc).__name__)
        raise _bad("The image is corrupt or too large to process")


def _video_duration(data: bytes, ext: str) -> Optional[float]:
    if ext == "webm":
        return None  # WebM has no reader in the dependencies; the size limit still applies
    try:
        return float(MP4(io.BytesIO(data)).info.length)
    except Exception:  # noqa: BLE001 - any parse failure means an unusable video
        raise _bad("The video could not be read (use MP4, MOV or WebM)")


async def store_upload(upload: UploadFile) -> dict:
    """Validate and store an uploaded file. Returns the facts needed to create a StoryMedia row."""
    limit = max(settings.max_image_bytes, settings.max_video_bytes)
    data = await read_limited(upload, limit)
    if not data:
        raise _bad("The file is empty")

    kind = filetype.guess(data[:8192])
    mime = kind.mime if kind else None
    if mime in IMAGE_TYPES:
        media_type, ext = MediaType.image, IMAGE_TYPES[mime]
        if len(data) > settings.max_image_bytes:
            raise _bad(f"Image is too large (limit {settings.max_image_bytes // (1024 * 1024)} MB)", 413)
        data, width, height = _process_image(data, ext)
        duration = None
    elif mime in VIDEO_TYPES:
        media_type, ext = MediaType.video, VIDEO_TYPES[mime]
        if len(data) > settings.max_video_bytes:
            raise _bad(f"Video is too large (limit {settings.max_video_bytes // (1024 * 1024)} MB)", 413)
        duration = _video_duration(data, ext)
        if duration is not None and duration > settings.max_video_seconds:
            raise _bad(f"Video is too long (limit {int(settings.max_video_seconds)} seconds)")
        width = height = None
    else:
        raise _bad("Unsupported file type. Upload a JPEG, PNG, WebP, GIF, MP4, MOV or WebM file.", 415)

    key = f"{uuid.uuid4().hex}.{ext}"
    path = media_path(key)
    tmp = f"{path}.part"
    with open(tmp, "wb") as f:
        f.write(data)
    os.replace(tmp, path)
    return {"key": key, "media_type": media_type, "mime": CONTENT_TYPES[ext], "size": len(data),
            "width": width, "height": height, "duration": duration}


def delete_file(key: str) -> None:
    try:
        os.remove(media_path(key))
    except (FileNotFoundError, HTTPException):
        pass


# ── Signed URLs ──────────────────────────────────────────────────────────────

def signed_path(key: str) -> str:
    """A relative URL that works for `media_url_ttl_seconds`. Issued only to authorized viewers."""
    token = jwt.encode(
        {"typ": "story-media", "k": key,
         "exp": datetime.now(timezone.utc) + timedelta(seconds=settings.media_url_ttl_seconds)},
        settings.jwt_secret, algorithm=settings.jwt_algorithm,
    )
    return f"/media/{key}?t={token}"


def verify_token(key: str, token: str) -> bool:
    try:
        claims = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        return False
    return claims.get("typ") == "story-media" and claims.get("k") == key
