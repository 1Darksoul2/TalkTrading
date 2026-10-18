"""The gateway's login check: anonymous passes without identity, valid tokens get the author id, bad tokens are refused."""
import uuid
from datetime import datetime, timedelta, timezone

from jose import jwt

from app.auth import derive_author_id
from app.config import settings


def _token(sub, minutes=30, secret=None):
    payload = {"sub": sub, "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes)}
    return jwt.encode(payload, secret or settings.jwt_secret, algorithm=settings.jwt_algorithm)


def test_anonymous_gets_no_identity(world):
    r = world.client.get("/internal/gateway-auth")
    assert r.status_code == 200 and "x-user-id" not in r.headers


def test_valid_token_gets_author_id(world):
    user = uuid.uuid4()
    r = world.client.get("/internal/gateway-auth", headers={"Authorization": f"Bearer {_token(str(user))}"})
    assert r.status_code == 200
    assert r.headers["x-user-id"] == str(derive_author_id(user))


def test_bad_tokens_refused(world):
    for token in (_token(str(uuid.uuid4()), secret="wrong"), _token(str(uuid.uuid4()), minutes=-1), _token("not-a-uuid"), "garbage"):
        r = world.client.get("/internal/gateway-auth", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401 and "x-user-id" not in r.headers


def test_identity_header_from_browser_is_not_echoed(world):
    r = world.client.get("/internal/gateway-auth", headers={"X-User-Id": "1"})
    assert "x-user-id" not in r.headers
