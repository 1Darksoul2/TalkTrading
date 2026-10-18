"""
HTTP tests for the News Service: feed, single article, and login-protected bookmarks.

In-memory SQLite; ingestion is switched off so no provider is called.
"""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from jose import jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app import crud, ingestion, main
from app.config import settings
from app.database import Base, get_db


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(ingestion, "run", lambda *a, **k: None)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    def override():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    main.app.dependency_overrides[get_db] = override
    with TestClient(main.app) as c:
        c.session = Session
        yield c
    main.app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


def token(user_id=None, secret=None, minutes=30):
    payload = {"sub": str(user_id or uuid.uuid4()), "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes)}
    return jwt.encode(payload, secret or settings.jwt_secret, algorithm=settings.jwt_algorithm)


def auth(user_id=None, **kw):
    return {"Authorization": f"Bearer {token(user_id, **kw)}"}


def add_article(client, title="Fed holds rates", category="markets", symbols=None):
    db = client.session()
    art = crud.upsert_article(db, {
        "title": title, "summary": "s", "source": "Test", "source_url": f"https://example.com/{uuid.uuid4()}",
        "category": category, "related_symbols": symbols or [], "published_at": datetime.now(timezone.utc),
    })
    art_id = art.id
    db.close()
    return art_id


def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_feed_filters_and_pages(client):
    add_article(client, "A", "markets")
    add_article(client, "B", "crypto")
    assert client.get("/news").json()["total"] == 2
    assert [a["title"] for a in client.get("/news?category=crypto").json()["items"]] == ["B"]
    assert len(client.get("/news?limit=1").json()["items"]) == 1
    assert client.get("/news?limit=0").status_code == 422


def test_single_article(client):
    art = add_article(client)
    assert client.get(f"/news/{art}").json()["title"] == "Fed holds rates"
    assert client.get(f"/news/{uuid.uuid4()}").status_code == 404


@pytest.mark.parametrize("method,path", [
    ("get", "/news/bookmarks"),
    ("put", "/news/{id}/bookmark"),
    ("delete", "/news/{id}/bookmark"),
])
def test_bookmarks_need_a_valid_login(client, method, path):
    url = path.format(id=uuid.uuid4())
    assert getattr(client, method)(url).status_code == 401
    assert getattr(client, method)(url, headers=auth(secret="wrong-secret")).status_code == 401
    assert getattr(client, method)(url, headers=auth(minutes=-1)).status_code == 401
    assert getattr(client, method)(url, headers={"Authorization": "Bearer dev-mock-token"}).status_code == 401


def test_bookmark_save_list_remove(client):
    me = uuid.uuid4()
    art = add_article(client)
    first = client.put(f"/news/{art}/bookmark", headers=auth(me))
    assert first.status_code == 200 and first.json()["user_id"] == str(me)
    assert client.put(f"/news/{art}/bookmark", headers=auth(me)).json()["id"] == first.json()["id"]  # idempotent
    saved = client.get("/news/bookmarks", headers=auth(me)).json()
    assert [b["article"]["id"] for b in saved] == [str(art)]
    assert client.delete(f"/news/{art}/bookmark", headers=auth(me)).status_code == 204
    assert client.get("/news/bookmarks", headers=auth(me)).json() == []
    assert client.delete(f"/news/{art}/bookmark", headers=auth(me)).status_code == 404


def test_bookmarks_are_private_to_their_owner(client):
    alice, bob = uuid.uuid4(), uuid.uuid4()
    art = add_article(client)
    client.put(f"/news/{art}/bookmark", headers=auth(alice))
    assert client.get("/news/bookmarks", headers=auth(bob)).json() == []
    assert client.delete(f"/news/{art}/bookmark", headers=auth(bob)).status_code == 404   # cannot remove Alice's
    assert len(client.get("/news/bookmarks", headers=auth(alice)).json()) == 1


def test_old_user_id_route_is_gone(client):
    # Anyone could read anyone's bookmarks through this before.
    assert client.get(f"/news/bookmarks/{uuid.uuid4()}").status_code in (401, 404, 405, 422)


def test_bookmark_missing_article(client):
    assert client.put(f"/news/{uuid.uuid4()}/bookmark", headers=auth()).status_code == 404


def test_cors_only_allows_the_app(client):
    ok = client.options("/news", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    bad = client.options("/news", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "access-control-allow-origin" not in bad.headers
