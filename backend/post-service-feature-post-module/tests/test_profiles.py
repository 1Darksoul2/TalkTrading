import struct
import zlib

from sqlalchemy import create_engine, text

from app.core.security import derive_author_id
from app.database.lite_migrations import ensure_user_columns


def signup(client, name):
    created = client.post("/auth/register", json={"username": name, "email": f"{name}@example.com", "password": "password123"})
    assert created.status_code == 200, created.text
    login = client.post("/auth/login", data={"username": f"{name}@example.com", "password": "password123"})
    return created.json(), {"Authorization": "Bearer " + login.json()["access_token"]}


def png_bytes():
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) + chunk(b"IEND", b""))


def test_signup_stores_derived_author_id_and_me_returns_profile(client):
    created, headers = signup(client, "alex")
    me = client.get("/api/v1/users/me", headers=headers)
    assert me.status_code == 200
    body = me.json()
    assert body["author_id"] == derive_author_id(created["id"])
    assert body["username"] == "alex" and body["is_me"] is True
    assert body["posts_count"] == 0 and body["followers_count"] == 0


def test_me_requires_login(client):
    assert client.get("/api/v1/users/me").status_code == 401


def test_update_profile_and_validation(client):
    _, headers = signup(client, "alex")
    ok = client.put("/api/v1/users/me", headers=headers, json={"display_name": "Alex Q", "bio": "Swing trader. $AAPL fan."})
    assert ok.status_code == 200 and ok.json()["display_name"] == "Alex Q" and ok.json()["bio"].startswith("Swing")
    assert client.put("/api/v1/users/me", headers=headers, json={"bio": "x" * 161}).status_code == 422
    assert client.put("/api/v1/users/me", headers=headers, json={"display_name": "   "}).status_code == 422


def test_public_profile_by_id_and_username_with_unknown_404(client):
    created, headers = signup(client, "alex")
    aid = derive_author_id(created["id"])
    assert client.get(f"/api/v1/users/{aid}").json()["username"] == "alex"
    assert client.get("/api/v1/users/by-username/alex").json()["author_id"] == aid
    assert client.get("/api/v1/users/by-username/ALEX").json()["author_id"] == aid
    assert client.get("/api/v1/users/by-username/alex").json()["uuid"] == created["id"]
    assert client.get("/api/v1/users/999999").status_code == 404
    assert client.get("/api/v1/users/by-username/nobody").status_code == 404


def test_posts_count_only_counts_posts_the_viewer_may_see(client):
    _, ha = signup(client, "alex")
    _, hb = signup(client, "bella")
    client.post("/api/v1/posts/", headers=ha, json={"caption": "pub", "visibility": "public"})
    client.post("/api/v1/posts/", headers=ha, json={"caption": "priv", "visibility": "private"})
    aid = client.get("/api/v1/users/me", headers=ha).json()["author_id"]
    assert client.get(f"/api/v1/users/{aid}", headers=ha).json()["posts_count"] == 2
    assert client.get(f"/api/v1/users/{aid}", headers=hb).json()["posts_count"] == 1
    assert client.get(f"/api/v1/users/{aid}").json()["posts_count"] == 1


def test_search_is_case_insensitive_partial_and_ranks_prefix_first(client):
    for name in ("trader_joe", "joey", "big_joe_fan", "mary"):
        signup(client, name)
    names = [u["username"] for u in client.get("/api/v1/users/search", params={"q": "JOE"}).json()["users"]]
    assert set(names) == {"trader_joe", "joey", "big_joe_fan"}
    assert names[0] == "joey"  # prefix match ranks first
    assert [u["username"] for u in client.get("/api/v1/users/search", params={"q": "@mar"}).json()["users"]] == ["mary"]
    assert client.get("/api/v1/users/search", params={"q": "zzz"}).json()["users"] == []
    assert client.get("/api/v1/users/search", params={"q": "100%"}).json()["users"] == []  # % is not a wildcard


def test_lookup_resolves_known_ids_and_ignores_unknown(client):
    created, _ = signup(client, "alex")
    aid = derive_author_id(created["id"])
    got = client.get("/api/v1/users/lookup", params={"ids": f"{aid},999999,abc"}).json()["users"]
    assert list(got.keys()) == [str(aid)] and got[str(aid)]["username"] == "alex"
    assert client.get("/api/v1/users/lookup", params={"ids": "nonsense"}).json() == {"users": {}}


def test_follow_unknown_user_is_404_and_lists_include_profiles(client):
    _, ha = signup(client, "alex")
    created_b, hb = signup(client, "bella")
    bid = derive_author_id(created_b["id"])
    assert client.post("/api/v1/users/999999/follow", headers=ha).status_code == 404
    assert client.post(f"/api/v1/users/{bid}/follow", headers=ha).status_code == 201
    followers = client.get(f"/api/v1/users/{bid}/followers").json()
    assert [u["username"] for u in followers["users"]] == ["alex"]


def test_avatar_upload_and_validation(client):
    _, headers = signup(client, "alex")
    ok = client.post("/api/v1/users/me/avatar", headers=headers, files={"file": ("a.png", png_bytes(), "image/png")})
    assert ok.status_code == 200 and ok.json()["avatar_url"].startswith("/static/uploads/")
    assert client.get("/api/v1/users/me", headers=headers).json()["avatar_url"] == ok.json()["avatar_url"]
    not_image = client.post("/api/v1/users/me/avatar", headers=headers, files={"file": ("a.txt", b"hello world", "text/plain")})
    assert not_image.status_code == 415
    fake_png = client.post("/api/v1/users/me/avatar", headers=headers, files={"file": ("a.png", b"not really a png file", "image/png")})
    assert fake_png.status_code == 400
    too_big = client.post("/api/v1/users/me/avatar", headers=headers, files={"file": ("a.png", b"\x89PNG\r\n\x1a\n" + b"0" * (5 * 1024 * 1024 + 1), "image/png")})
    assert too_big.status_code == 413


def test_signup_rerolls_uuid_when_derived_author_id_collides(client, monkeypatch):
    first, _ = signup(client, "alex")
    taken = derive_author_id(first["id"])
    calls = iter([taken])  # first attempt collides, later attempts use the real derivation
    real = derive_author_id
    monkeypatch.setattr("app.services.auth_service.derive_author_id", lambda uid: next(calls, None) or real(uid))
    second, headers = signup(client, "bella")
    assert second["id"] != first["id"]
    assert client.get("/api/v1/users/me", headers=headers).json()["author_id"] != taken


def test_migration_adds_columns_and_backfills_existing_users():
    engine = create_engine("sqlite:///:memory:")
    legacy_id = "11111111-2222-4333-8444-555555555555"
    with engine.begin() as conn:  # the users table as it was before profiles existed
        conn.execute(text("CREATE TABLE users (id VARCHAR(36) PRIMARY KEY, username VARCHAR(64), email VARCHAR(255), hashed_password VARCHAR(255), created_at DATETIME)"))
        conn.execute(text("INSERT INTO users (id, username, email, hashed_password) VALUES (:i, 'old', 'old@example.com', 'x')"), {"i": legacy_id})
    ensure_user_columns(engine)
    ensure_user_columns(engine)  # idempotent
    with engine.connect() as conn:
        row = conn.execute(text("SELECT author_id, bio, avatar_url FROM users")).fetchone()
    assert row[0] == derive_author_id(legacy_id) and row[1] is None and row[2] is None
