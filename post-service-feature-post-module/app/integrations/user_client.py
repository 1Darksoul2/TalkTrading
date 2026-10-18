from typing import List, Optional
import httpx
from app.core.config import settings


class UserServiceClient:
    """
    HTTP integration client for inter-service communication with external User/Social Graph Microservice.
    Microservice Principle: Never query another microservice's database directly.
    """
    def __init__(self, base_url: Optional[str] = None):
        self.base_url = (base_url or settings.USER_SERVICE_URL).rstrip("/")

    async def get_following_author_ids(self, user_id: int) -> List[int]:
        """Fetch list of user IDs that user_id follows."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/users/{user_id}/following")
                if res.status_code == 200:
                    return res.json().get("following_ids", [])
        except Exception:
            pass
        return []

    async def resolve_username_to_user_id(self, username: str) -> Optional[int]:
        """Resolve username string (from @mentions) to external user ID."""
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.get(f"{self.base_url}/users/by-username/{username}")
                if res.status_code == 200:
                    return res.json().get("user_id")
        except Exception:
            pass
        return None
