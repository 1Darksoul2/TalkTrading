import json
import os
import uuid

import pytest

from app.config import settings
from app.models import (
    CloseFriend, Highlight, Story, StoryHidden, StoryMute, StoryNotification, StoryReaction, StoryReply,
    StorySettings,
)

LISTS = [("/close-friends", CloseFriend), ("/story-hidden", StoryHidden), ("/story-mutes", StoryMute)]


@pytest.mark.parametrize("path,model", LISTS)
def test_account_lists_add_list_remove(world, path, model):
    bella, cara = str(world.user("bella")), str(world.user("cara"))
    h = world.h("alex")
    for target in (bella, cara):
        assert world.client.post(path, headers=h, json={"user_id": target}).status_code == 204
    assert world.client.post(path, headers=h, json={"user_id": bella}).status_code == 204  # twice is a no-op

    items = world.client.get(path, headers=h).json()
    assert {i["user"]["username"] for i in items} == {"bella", "cara"} and len(items) == 2
    assert world.client.get(path, headers=world.h("bella")).json() == []                  # lists are private

    assert world.client.delete(f"{path}/{bella}", headers=h).status_code == 204
    assert world.client.delete(f"{path}/{bella}", headers=h).status_code == 404
    assert [i["user"]["username"] for i in world.client.get(path, headers=h).json()] == ["cara"]


@pytest.mark.parametrize("path,model", LISTS)
def test_account_list_validation(world, path, model):
    h = world.h("alex")
    me = str(world.user("alex"))
    assert world.client.post(path, headers=h, json={"user_id": me}).status_code == 400
    assert world.client.post(path, headers=h, json={"user_id": str(uuid.uuid4())}).status_code == 404
    assert world.client.post(path, headers=h, json={"user_id": "not-a-uuid"}).status_code == 422


def test_account_lists_are_paginated(world):
    for i in range(5):
        world.client.post("/close-friends", headers=world.h("alex"), json={"user_id": str(world.user(f"u{i}"))})
    first = world.client.get("/close-friends?size=3", headers=world.h("alex")).json()
    second = world.client.get("/close-friends?size=3&page=2", headers=world.h("alex")).json()
    assert [len(first), len(second)] == [3, 2]


# ── Settings ─────────────────────────────────────────────────────────────────

def test_settings_defaults_update_and_persist(world, db):
    h = world.h("alex")
    defaults = world.client.get("/story-settings", headers=h).json()
    assert defaults == {"who_can_see": "everyone", "allow_replies": "everyone", "allow_mentions": "everyone",
                        "save_to_archive": True, "notify_replies": True, "notify_reactions": True,
                        "notify_mentions": True, "notify_poll_votes": True}

    changed = world.client.put("/story-settings", headers=h, json={"allow_replies": "off", "save_to_archive": False})
    assert changed.status_code == 200
    assert changed.json()["allow_replies"] == "off" and changed.json()["who_can_see"] == "everyone"

    world.client.put("/story-settings", headers=h, json={"notify_reactions": False})   # partial update keeps the rest
    stored = world.client.get("/story-settings", headers=h).json()
    assert stored["allow_replies"] == "off" and stored["save_to_archive"] is False and stored["notify_reactions"] is False
    row = db.get(StorySettings, world.user("alex"))                                    # really in the database
    assert row.allow_replies == "off" and row.notify_reactions is False
    assert world.client.get("/story-settings", headers=world.h("bella")).json()["allow_replies"] == "everyone"


@pytest.mark.parametrize("body", [
    {"who_can_see": "nobody"}, {"allow_replies": "some"}, {"allow_mentions": "x"}, {"save_to_archive": "maybe"},
])
def test_settings_reject_invalid_values(world, body):
    assert world.client.put("/story-settings", headers=world.h("alex"), json=body).status_code == 422


def test_each_notification_preference_switches_off_its_own_kind(world):
    world.user("bella")
    story = world.publish("alex", overlays=[{"type": "poll", "question": "q", "options": ["a", "b"]}])
    sid = story["id"]
    world.client.put("/story-settings", headers=world.h("alex"), json={
        "notify_replies": False, "notify_reactions": False, "notify_poll_votes": False})
    world.client.post(f"/stories/{sid}/replies", headers=world.h("bella"), json={"text": "x"})
    world.client.put(f"/stories/{sid}/reaction", headers=world.h("bella"), json={"emoji": "🔥"})
    world.client.post(f"/stories/{sid}/poll/vote", headers=world.h("bella"), json={"option": 0})
    assert world.client.get("/notifications", headers=world.h("alex")).json()["notifications"] == []

    world.client.put("/story-settings", headers=world.h("bella"), json={"notify_mentions": False})
    world.publish("alex", overlays=[{"type": "mention", "username": "bella"}])
    assert world.client.get("/notifications", headers=world.h("bella")).json()["notifications"] == []


# ── Notifications ────────────────────────────────────────────────────────────

def test_notifications_unread_count_and_marking_read(world):
    story = world.publish("alex")
    world.client.post(f"/stories/{story['id']}/replies", headers=world.h("bella"), json={"text": "one"})
    world.client.put(f"/stories/{story['id']}/reaction", headers=world.h("cara"), json={"emoji": "🔥"})
    h = world.h("alex")
    assert world.client.get("/notifications/unread-count", headers=h).json() == {"unread_count": 2}

    first = world.client.get("/notifications", headers=h).json()["notifications"][0]["id"]
    assert world.client.post(f"/notifications/{first}/read", headers=world.h("bella")).status_code == 404  # not theirs
    assert world.client.post(f"/notifications/{first}/read", headers=h).status_code == 200
    assert world.client.post(f"/notifications/{first}/read", headers=h).status_code == 404
    assert world.client.get("/notifications?unread_only=true", headers=h).json()["unread_count"] == 1
    assert world.client.post("/notifications/read-all", headers=h).json() == {"marked": 1}
    assert world.client.get("/notifications/unread-count", headers=h).json() == {"unread_count": 0}


def test_notifications_are_private_and_paginated(world):
    story = world.publish("alex")
    for i in range(3):
        world.client.post(f"/stories/{story['id']}/replies", headers=world.h(f"v{i}"), json={"text": f"r{i}"})
    assert world.client.get("/notifications", headers=world.h("bella")).json()["notifications"] == []
    page = world.client.get("/notifications?size=2", headers=world.h("alex")).json()
    assert len(page["notifications"]) == 2 and page["unread_count"] == 3
    assert page["notifications"][0]["text"] == "r2"  # newest first


# ── Export and deleting your data ────────────────────────────────────────────

def test_export_contains_my_data_and_nobody_elses(world):
    world.client.post("/close-friends", headers=world.h("alex"), json={"user_id": str(world.user("bella"))})
    mine = world.publish("alex", caption="mine")
    world.publish("bella", caption="not mine")
    world.client.post(f"/stories/{mine['id']}/replies", headers=world.h("bella"), json={"text": "hi"})
    world.client.post("/highlights", headers=world.h("alex"), json={"title": "H", "story_ids": [mine["id"]]})

    r = world.client.get("/export", headers=world.h("alex"))
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    data = json.loads(r.content)
    assert [s["caption"] for s in data["stories"]] == ["mine"]
    assert data["highlights"][0]["title"] == "H"
    assert data["close_friends"] == [str(world.user("bella"))]
    assert "not mine" not in r.text


def test_deleting_story_data_needs_confirmation_and_removes_everything(world, db):
    story = world.publish("alex")
    world.upload("alex")  # an unpublished upload
    world.client.post("/close-friends", headers=world.h("alex"), json={"user_id": str(world.user("bella"))})
    world.client.post("/story-hidden", headers=world.h("alex"), json={"user_id": str(world.user("cara"))})
    world.client.put("/story-settings", headers=world.h("alex"), json={"allow_replies": "off"})
    world.client.post("/highlights", headers=world.h("alex"), json={"title": "H", "story_ids": [story["id"]]})
    world.client.put(f"/stories/{story['id']}/reaction", headers=world.h("bella"), json={"emoji": "🔥"})
    world.client.post(f"/stories/{story['id']}/replies", headers=world.h("bella"), json={"text": "hi"})
    other = world.publish("bella")

    assert world.client.request("DELETE", "/account-data", headers=world.h("alex"), json={"confirm": "yes"}).status_code == 400
    assert world.client.request("DELETE", "/account-data", headers=world.h("alex"), json={}).status_code == 422
    assert db.query(Story).count() == 2

    r = world.client.request("DELETE", "/account-data", headers=world.h("alex"), json={"confirm": "DELETE"})
    assert r.status_code == 200 and r.json() == {"stories_deleted": 1}
    db.expire_all()
    me = world.user("alex")
    assert db.query(Story).filter_by(user_id=me).count() == 0
    assert db.query(Highlight).count() == 0 and db.query(CloseFriend).count() == 0 and db.query(StoryHidden).count() == 0
    assert db.get(StorySettings, me) is None
    assert db.query(StoryReaction).count() == 0 and db.query(StoryReply).count() == 0
    assert db.query(StoryNotification).filter_by(user_id=me).count() == 0
    assert len(os.listdir(settings.media_dir)) == 1  # only bella's file is left
    assert db.get(Story, uuid.UUID(other["id"])) is not None
