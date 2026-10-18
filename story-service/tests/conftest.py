import os
import tempfile

# Must be set before `app` is imported anywhere so the tests use a throwaway database and media folder.
_TMP = tempfile.mkdtemp()
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP}/stories_test.db"
os.environ["MEDIA_DIR"] = f"{_TMP}/uploads"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["AUTH_ENABLED"] = "true"
os.environ["RATE_LIMIT_PER_MINUTE"] = "100000"
os.environ["UPLOAD_RATE_LIMIT"] = "100000/minute"
os.environ["REPLY_RATE_LIMIT"] = "100000/minute"
os.environ["REACTION_RATE_LIMIT"] = "100000/minute"

import io
import shutil
import struct
import uuid
import zlib
from typing import Dict, List, Optional

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from PIL import Image

from app import models
from app.auth import Principal, derive_author_id
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.graph import PostGraph, Relationship, get_graph
from app.main import app
from app.routes import limiter


class FakeGraph(PostGraph):
    """The Post Service's social graph, held in memory: who exists, who follows whom."""

    def __init__(self):
        self.users: Dict[uuid.UUID, dict] = {}
        self.follows: set = set()  # (follower, followee)
        self.visible_posts: set = set()  # post ids the Post Service would show

    def add_user(self, name: str) -> uuid.UUID:
        uid = uuid.uuid4()
        self.users[uid] = {"uuid": str(uid), "username": name, "display_name": name.title(), "avatar_url": None,
                           "author_id": derive_author_id(uid)}
        return uid

    def follow(self, a: uuid.UUID, b: uuid.UUID) -> None:
        self.follows.add((a, b))

    # -- the PostGraph interface ------------------------------------------------
    def following(self, who: Principal) -> List[dict]:
        return [self.users[b] for (a, b) in self.follows if a == who.user_id]

    def relationship(self, viewer: Principal, owner: uuid.UUID) -> Relationship:
        return Relationship((viewer.user_id, owner) in self.follows, (owner, viewer.user_id) in self.follows)

    def post_visible(self, viewer: Principal, post_id: int) -> bool:
        return post_id in self.visible_posts

    def resolve_username(self, name: str) -> Optional[dict]:
        return next((u for u in self.users.values() if u["username"] == name), None)

    def summaries(self, user_ids) -> Dict[uuid.UUID, dict]:
        return {u: self.users[u] for u in user_ids if u in self.users}


class World:
    """Test helper: accounts, tokens and a client in one place."""

    def __init__(self, client: TestClient, graph: FakeGraph):
        self.client, self.graph = client, graph
        self.ids: Dict[str, uuid.UUID] = {}

    def user(self, name: str) -> uuid.UUID:
        if name not in self.ids:
            self.ids[name] = self.graph.add_user(name)
        return self.ids[name]

    def h(self, name: str) -> dict:
        token = jwt.encode({"sub": str(self.user(name))}, "test-secret", algorithm="HS256")
        return {"Authorization": f"Bearer {token}"}

    def follow(self, a: str, b: str) -> None:
        self.graph.follow(self.user(a), self.user(b))

    def upload(self, name: str, data: Optional[bytes] = None, filename: str = "a.png", mime: str = "image/png"):
        return self.client.post("/stories/media", headers=self.h(name),
                                files={"file": (filename, data if data is not None else png_bytes(), mime)})

    def publish(self, name: str, **extra) -> dict:
        media = self.upload(name)
        assert media.status_code == 201, media.text
        body = {"media_id": media.json()["media_id"], **extra}
        r = self.client.post("/stories", headers=self.h(name), json=body)
        assert r.status_code == 201, r.text
        return r.json()

    def story_ids(self, viewer: str, owner: str) -> List[str]:
        r = self.client.get(f"/stories/user/{self.user(owner)}", headers=self.h(viewer))
        assert r.status_code == 200, r.text
        return [s["id"] for s in r.json()]


def png_bytes(size=(8, 8), color=(200, 30, 30)) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, color).save(out, "PNG")
    return out.getvalue()


def jpeg_with_exif() -> bytes:
    img = Image.new("RGB", (16, 16), (10, 120, 200))
    exif = Image.Exif()
    exif[0x010F] = "SecretCameraMaker"  # camera make: must not survive re-encoding
    out = io.BytesIO()
    img.save(out, "JPEG", exif=exif)
    return out.getvalue()


def fake_mp4() -> bytes:
    """Enough of an MP4 for type detection ('ftyp' box); duration is provided by a monkeypatch in tests."""
    return struct.pack(">I", 24) + b"ftypmp42" + b"\x00" * 4 + b"mp42isom" + b"\x00" * 64


@pytest.fixture(autouse=True)
def fresh_state():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    shutil.rmtree(settings.media_dir, ignore_errors=True)
    limiter.reset()
    yield


@pytest.fixture
def world():
    graph = FakeGraph()
    app.dependency_overrides[get_graph] = lambda: graph
    with TestClient(app) as client:
        yield World(client, graph)
    app.dependency_overrides.clear()


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
