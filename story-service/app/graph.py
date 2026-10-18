"""
Social-graph lookups, read through the Post Service's existing public API.

The Story Service never touches the Post Service's database. It asks the same public
endpoints the browser uses, forwarding the *viewer's own* token, so the Post Service
decides what that viewer may know. Everything fails closed: if the Post Service cannot be
reached, nobody is treated as a follower.
"""
import logging
import uuid
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional

import httpx
from fastapi import Request

from .auth import Principal, derive_author_id
from .config import settings

logger = logging.getLogger(__name__)

MAX_FOLLOWING = 500
PAGE = 100


@dataclass(frozen=True)
class Relationship:
    viewer_follows_owner: bool = False
    owner_follows_viewer: bool = False


class PostGraph:
    """Thin HTTP client for the few Post Service reads the Story Service needs."""

    def __init__(self, base_url: Optional[str] = None, timeout: Optional[float] = None):
        self.base_url = (base_url or settings.post_service_url).rstrip("/")
        self.timeout = timeout or settings.post_service_timeout_seconds

    def _get(self, path: str, token: Optional[str], params: Optional[dict] = None) -> Optional[dict]:
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        try:
            r = httpx.get(f"{self.base_url}{path}", headers=headers, params=params, timeout=self.timeout)
            if r.status_code == 200:
                return r.json()
        except httpx.HTTPError as exc:
            logger.warning("Post Service unreachable for %s: %s", path, type(exc).__name__)
        return None

    def following(self, who: Principal) -> List[dict]:
        """Accounts `who` follows: [{uuid, username, display_name, avatar_url, ...}]."""
        users: List[dict] = []
        aid = derive_author_id(who.user_id)
        for page in range(1, MAX_FOLLOWING // PAGE + 1):
            data = self._get(f"/api/v1/users/{aid}/following", who.token, {"page": page, "limit": PAGE})
            batch = (data or {}).get("users", [])
            users.extend(batch)
            if len(batch) < PAGE:
                break
        return users

    def relationship(self, viewer: Principal, owner: uuid.UUID) -> Relationship:
        data = self._get(f"/api/v1/users/{derive_author_id(owner)}/follow-stats", viewer.token)
        if not data:
            return Relationship()
        return Relationship(bool(data.get("is_following")), bool(data.get("follows_you")))

    def post_visible(self, viewer: Principal, post_id: int) -> bool:
        """True when the Post Service lets this viewer open the post (it applies its own privacy rules)."""
        return self._get(f"/api/v1/posts/{post_id}", viewer.token) is not None

    def resolve_username(self, name: str) -> Optional[dict]:
        return self._get(f"/api/v1/users/by-username/{name}", None)

    def summaries(self, user_ids: Iterable[uuid.UUID]) -> Dict[uuid.UUID, dict]:
        """username / avatar for a batch of accounts (best effort; missing ones are simply absent)."""
        ids = {derive_author_id(u): u for u in user_ids}
        if not ids:
            return {}
        out: Dict[uuid.UUID, dict] = {}
        keys = list(ids)
        for i in range(0, len(keys), PAGE):
            chunk = keys[i:i + PAGE]
            data = self._get("/api/v1/users/lookup", None, {"ids": ",".join(map(str, chunk))})
            for aid, summary in ((data or {}).get("users") or {}).items():
                owner = ids.get(int(aid))
                if owner is not None and str(summary.get("uuid")) == str(owner):
                    out[owner] = summary
        return out


def get_graph(request: Request) -> PostGraph:
    """Dependency; tests replace it through app.dependency_overrides."""
    graph = getattr(request.app.state, "graph", None)
    if graph is None:
        graph = request.app.state.graph = PostGraph()
    return graph
