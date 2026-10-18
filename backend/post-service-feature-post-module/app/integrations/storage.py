import os
import uuid
from abc import ABC, abstractmethod
from typing import Tuple

from app.core.config import settings


class StorageProvider(ABC):
    @abstractmethod
    async def upload(self, file_content: bytes, filename: str, content_type: str) -> Tuple[str, str]:
        """Returns (storage_key, public_url)"""
        pass

    @abstractmethod
    async def delete(self, storage_key: str) -> bool:
        pass


class LocalStorageProvider(StorageProvider):
    def __init__(self, upload_dir: str = settings.LOCAL_STORAGE_DIR):
        self.upload_dir = os.path.realpath(upload_dir)
        os.makedirs(self.upload_dir, exist_ok=True)

    async def upload(self, file_content: bytes, filename: str, content_type: str) -> Tuple[str, str]:
        ext = os.path.splitext(filename)[1].lower()
        unique_name = f"{uuid.uuid4()}{ext}"
        
        # Enforce canonical path containment
        file_path = os.path.realpath(os.path.join(self.upload_dir, unique_name))
        if not file_path.startswith(self.upload_dir):
            raise ValueError("Path traversal violation in media upload")

        with open(file_path, "wb") as f:
            f.write(file_content)

        storage_key = unique_name
        public_url = f"/static/uploads/{unique_name}"
        return storage_key, public_url

    async def delete(self, storage_key: str) -> bool:
        # Sanitize storage_key against path traversal
        safe_key = os.path.basename(storage_key)
        file_path = os.path.realpath(os.path.join(self.upload_dir, safe_key))

        if not file_path.startswith(self.upload_dir):
            raise ValueError("Path traversal violation in media delete")

        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False


class S3StorageProvider(StorageProvider):
    """Production S3-compatible object storage provider stub."""
    def __init__(self, bucket_name: str = settings.S3_BUCKET_NAME, region: str = settings.S3_REGION):
        self.bucket_name = bucket_name or "my-bucket"
        self.region = region or "us-east-1"

    async def upload(self, file_content: bytes, filename: str, content_type: str) -> Tuple[str, str]:
        ext = os.path.splitext(filename)[1].lower()
        key = f"media/{uuid.uuid4()}{ext}"
        public_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{key}"
        return key, public_url

    async def delete(self, storage_key: str) -> bool:
        return True


def get_storage_provider() -> StorageProvider:
    if settings.STORAGE_TYPE.lower() == "s3":
        return S3StorageProvider()
    return LocalStorageProvider()
