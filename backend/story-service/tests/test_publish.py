import uuid

import pytest

from app.models import StoryMention
from tests.conftest import png_bytes

STORY_PATHS = [
    ("post", "/stories"),
    ("post", "/stories/media"),
    ("get", "/stories/tray"),
    ("get", "/stories/archive"),
    ("get", f"/stories/feed?user_ids={uuid.uuid4()}"),
    ("get", f"/stories/user/{uuid.uuid4()}"),
    ("get", f"/stories/{uuid.uuid4()}"),
    ("post", f"/stories/{uuid.uuid4()}/view"),
    ("delete", f"/stories/{uuid.uuid4()}"),
    ("get", f"/stories/{uuid.uuid4()}/viewers"),
    ("get", f"/stories/{uuid.uuid4()}/analytics"),
    ("get", f"/stories/{uuid.uuid4()}/replies"),
    ("post", f"/stories/{uuid.uuid4()}/replies"),
    ("put", f"/stories/{uuid.uuid4()}/reaction"),
    ("delete", f"/stories/{uuid.uuid4()}/reaction"),
    ("post", f"/stories/{uuid.uuid4()}/poll/vote"),
    ("post", f"/stories/{uuid.uuid4()}/link-click"),
    ("post", f"/stories/{uuid.uuid4()}/report"),
    ("get", f"/highlights/user/{uuid.uuid4()}"),
    ("get", f"/highlights/{uuid.uuid4()}"),
    ("post", "/highlights"),
    ("patch", f"/highlights/{uuid.uuid4()}"),
    ("delete", f"/highlights/{uuid.uuid4()}"),
    ("put", "/highlights/order"),
    ("get", "/close-friends"),
    ("post", "/close-friends"),
    ("get", "/story-hidden"),
    ("get", "/story-mutes"),
    ("get", "/story-settings"),
    ("put", "/story-settings"),
    ("get", "/notifications"),
    ("get", "/notifications/unread-count"),
    ("post", "/notifications/read-all"),
    ("get", "/export"),
    ("delete", "/account-data"),
]


@pytest.mark.parametrize("method,path", STORY_PATHS)
def test_every_endpoint_requires_login(world, method, path):
    assert getattr(world.client, method)(path).status_code == 401
    assert getattr(world.client, method)(path, headers={"Authorization": "Bearer junk"}).status_code == 401


def test_publish_stores_owner_from_token_not_body_and_hides_counts_from_others(world):
    world.user("bella")
    story = world.publish("alex", user_id=str(world.user("bella")), caption="NVDA setup")
    assert story["user_id"] == str(world.user("alex"))
    assert story["caption"] == "NVDA setup" and story["audience"] == "everyone"
    assert story["media_url"].startswith("/media/") and story["view_count"] == 0
    assert story["expires_at"] > story["created_at"]

    other = world.client.get(f"/stories/{story['id']}", headers=world.h("bella")).json()
    assert other["view_count"] is None


def test_media_must_be_uploaded_through_the_service(world):
    r = world.client.post("/stories", headers=world.h("alex"),
                          json={"media_url": "https://tracker.example/pixel.png", "media_type": "image"})
    assert r.status_code == 422
    assert world.client.post("/stories", headers=world.h("alex"), json={}).status_code == 422


def test_cannot_publish_someone_elses_or_already_used_media(world):
    mine = world.upload("alex").json()["media_id"]
    stolen = world.client.post("/stories", headers=world.h("bella"), json={"media_id": mine})
    assert stolen.status_code == 400
    assert world.client.post("/stories", headers=world.h("alex"), json={"media_id": mine}).status_code == 201
    again = world.client.post("/stories", headers=world.h("alex"), json={"media_id": mine})
    assert again.status_code == 400
    ghost = world.client.post("/stories", headers=world.h("alex"), json={"media_id": str(uuid.uuid4())})
    assert ghost.status_code == 400


def test_overlays_are_validated(world):
    def post(overlays):
        media = world.upload("alex").json()["media_id"]
        return world.client.post("/stories", headers=world.h("alex"), json={"media_id": media, "overlays": overlays})

    good = post([
        {"type": "text", "text": "Buy the dip", "x": 0.3, "y": 0.2, "color": "#ffcc00"},
        {"type": "link", "url": "https://example.com/chart", "label": "Chart"},
        {"type": "hashtag", "tag": "NVDA"},
        {"type": "poll", "question": "Bullish?", "options": ["Yes", "No"]},
    ])
    assert good.status_code == 201, good.text
    assert [o["type"] for o in good.json()["overlays"]] == ["text", "link", "hashtag", "poll"]

    assert post([{"type": "link", "url": "javascript:alert(1)"}]).status_code == 422
    assert post([{"type": "link", "url": "ftp://example.com/x"}]).status_code == 422
    assert post([{"type": "text", "text": "x", "x": 1.5}]).status_code == 422
    assert post([{"type": "text", "text": "x", "color": "red"}]).status_code == 422
    assert post([{"type": "text", "text": ""}]).status_code == 422
    assert post([{"type": "script", "src": "x"}]).status_code == 422
    assert post([{"type": "poll", "question": "q", "options": ["only one"]}]).status_code == 422
    assert post([{"type": "text", "text": "t"}] * 11).status_code == 422
    two_polls = [{"type": "poll", "question": "a", "options": ["1", "2"]}] * 2
    assert post(two_polls).status_code == 422


def test_caption_length_is_limited(world):
    media = world.upload("alex").json()["media_id"]
    r = world.client.post("/stories", headers=world.h("alex"), json={"media_id": media, "caption": "x" * 501})
    assert r.status_code == 422


def test_mentions_are_resolved_stored_and_notified(world, db):
    world.user("bella")
    story = world.publish("alex", overlays=[{"type": "mention", "username": "bella"}])
    assert db.query(StoryMention).filter_by(user_id=world.user("bella")).count() == 1

    inbox = world.client.get("/notifications", headers=world.h("bella")).json()
    assert [(n["type"], n["actor"]["username"]) for n in inbox["notifications"]] == [("story_mention", "alex")]
    assert inbox["notifications"][0]["story_id"] == story["id"]


def test_mention_of_unknown_user_is_rejected(world):
    media = world.upload("alex").json()["media_id"]
    r = world.client.post("/stories", headers=world.h("alex"), json={
        "media_id": media, "overlays": [{"type": "mention", "username": "nobody"}]})
    assert r.status_code == 422 and "nobody" in r.json()["detail"]


def test_mention_permissions_are_enforced(world):
    world.user("bella")
    world.client.put("/story-settings", headers=world.h("bella"), json={"allow_mentions": "none"})

    def mention():
        media = world.upload("alex").json()["media_id"]
        return world.client.post("/stories", headers=world.h("alex"), json={
            "media_id": media, "overlays": [{"type": "mention", "username": "bella"}]})

    assert mention().status_code == 403
    world.client.put("/story-settings", headers=world.h("bella"), json={"allow_mentions": "following"})
    assert mention().status_code == 403  # bella does not follow alex
    world.follow("bella", "alex")
    assert mention().status_code == 201


def test_mentioning_yourself_is_allowed_but_never_notifies(world):
    world.publish("alex", overlays=[{"type": "mention", "username": "alex"}])
    assert world.client.get("/notifications", headers=world.h("alex")).json()["notifications"] == []


def test_publish_is_rate_limited(world, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "rate_limit_per_minute", 2)
    codes = []
    for _ in range(4):
        media = world.upload("alex").json()["media_id"]
        codes.append(world.client.post("/stories", headers=world.h("alex"), json={"media_id": media}).status_code)
    assert codes == [201, 201, 429, 429]
