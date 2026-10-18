import os
import uuid
from datetime import datetime, timedelta, timezone

from app import media
from app.config import settings
from app.models import (
    Highlight, HighlightItem, Story, StoryMedia, StoryPollVote, StoryReaction, StoryReply, StoryView,
)
from app.purge import purge_expired


def expire(db, story_id, hours_ago=1):
    db.query(Story).filter(Story.id == uuid.UUID(story_id)).update(
        {"expires_at": datetime.now(timezone.utc) - timedelta(hours=hours_ago)})
    db.commit()


def media_file(world, story):
    key = story["media_url"].split("/media/")[1].split("?")[0]
    return os.path.join(settings.media_dir, key)


# ── Expiry is enforced by the backend ────────────────────────────────────────

def test_story_lives_24_hours_by_default(world):
    story = world.publish("alex")
    created = datetime.fromisoformat(story["created_at"].replace("Z", "+00:00"))
    expires = datetime.fromisoformat(story["expires_at"].replace("Z", "+00:00"))
    assert timedelta(hours=23, minutes=59) <= expires - created <= timedelta(hours=24, minutes=1)


def test_expired_story_disappears_for_everyone_but_the_owners_archive(world, db):
    world.follow("bella", "alex")
    story = world.publish("alex", overlays=[{"type": "poll", "question": "q", "options": ["a", "b"]}])
    sid = story["id"]
    assert world.story_ids("bella", "alex") == [sid]
    expire(db, sid)

    assert world.story_ids("bella", "alex") == []
    assert world.story_ids("alex", "alex") == []                              # not "active" for the owner either
    assert world.client.get("/stories/tray", headers=world.h("bella")).json() == []
    for call in (
        world.client.get(f"/stories/{sid}", headers=world.h("bella")),
        world.client.post(f"/stories/{sid}/view", headers=world.h("bella")),
        world.client.post(f"/stories/{sid}/replies", headers=world.h("bella"), json={"text": "late"}),
        world.client.put(f"/stories/{sid}/reaction", headers=world.h("bella"), json={"emoji": "🔥"}),
        world.client.post(f"/stories/{sid}/poll/vote", headers=world.h("bella"), json={"option": 0}),
    ):
        assert call.status_code == 404
    feed = world.client.get(f"/stories/feed?user_ids={world.user('alex')}", headers=world.h("bella")).json()
    assert feed == []

    archive = world.client.get("/stories/archive", headers=world.h("alex")).json()
    assert [(s["id"], s["expired"]) for s in archive] == [(sid, True)]
    assert world.client.get("/stories/archive", headers=world.h("bella")).json() == []  # archive is private


def test_archive_lists_active_and_expired_newest_first_with_paging(world, db):
    ids = [world.publish("alex")["id"] for _ in range(3)]
    expire(db, ids[0], hours_ago=30)
    archive = world.client.get("/stories/archive", headers=world.h("alex")).json()
    assert [s["id"] for s in archive] == list(reversed(ids))
    assert [s["expired"] for s in archive] == [False, False, True]
    page2 = world.client.get("/stories/archive?size=2&page=2", headers=world.h("alex")).json()
    assert [s["id"] for s in page2] == [ids[0]]


# ── Purge job ────────────────────────────────────────────────────────────────

def test_purge_keeps_archived_stories_but_deletes_them_when_archiving_is_off(world, db):
    keep = world.publish("alex")
    drop = world.publish("bella")
    world.client.put("/story-settings", headers=world.h("bella"), json={"save_to_archive": False})
    expire(db, keep["id"])
    expire(db, drop["id"])

    result = purge_expired(db)
    assert result["stories"] == 1
    assert db.get(Story, uuid.UUID(keep["id"])) is not None and os.path.exists(media_file(world, keep))
    assert db.get(Story, uuid.UUID(drop["id"])) is None and not os.path.exists(media_file(world, drop))


def test_purge_removes_stories_older_than_the_retention_period(world, db, monkeypatch):
    old = world.publish("alex")
    recent = world.publish("alex")
    expire(db, old["id"], hours_ago=24 * 400)
    expire(db, recent["id"], hours_ago=24 * 3)
    purge_expired(db)
    assert db.get(Story, uuid.UUID(old["id"])) is None
    assert db.get(Story, uuid.UUID(recent["id"])) is not None


def test_purge_never_deletes_highlighted_stories(world, db):
    story = world.publish("alex")
    world.client.put("/story-settings", headers=world.h("alex"), json={"save_to_archive": False})
    world.client.post("/highlights", headers=world.h("alex"), json={"title": "Wins", "story_ids": [story["id"]]})
    expire(db, story["id"], hours_ago=24 * 500)
    assert purge_expired(db)["stories"] == 0
    assert os.path.exists(media_file(world, story))


def test_purge_removes_unpublished_uploads_after_a_day(world, db):
    fresh = world.upload("alex").json()
    stale = world.upload("alex").json()
    db.query(StoryMedia).filter(StoryMedia.id == uuid.UUID(stale["media_id"])).update(
        {"created_at": datetime.now(timezone.utc) - timedelta(hours=25)})
    db.commit()
    assert purge_expired(db)["uploads"] == 1
    assert db.get(StoryMedia, uuid.UUID(fresh["media_id"])) is not None
    assert db.get(StoryMedia, uuid.UUID(stale["media_id"])) is None
    assert len(os.listdir(settings.media_dir)) == 1


# ── Deleting ─────────────────────────────────────────────────────────────────

def test_deleting_a_story_removes_everything_attached_to_it(world, db):
    story = world.publish("alex", overlays=[{"type": "poll", "question": "q", "options": ["a", "b"]}])
    sid = story["id"]
    world.client.post(f"/stories/{sid}/view", headers=world.h("bella"))
    world.client.post(f"/stories/{sid}/replies", headers=world.h("bella"), json={"text": "hi"})
    world.client.put(f"/stories/{sid}/reaction", headers=world.h("bella"), json={"emoji": "🔥"})
    world.client.post(f"/stories/{sid}/poll/vote", headers=world.h("bella"), json={"option": 0})
    world.client.post("/highlights", headers=world.h("alex"), json={"title": "Solo", "story_ids": [sid]})
    path = media_file(world, story)
    assert os.path.exists(path)

    assert world.client.delete(f"/stories/{sid}", headers=world.h("alex")).status_code == 204
    assert not os.path.exists(path)
    story_id = uuid.UUID(sid)
    assert db.get(Story, story_id) is None
    for model in (StoryView, StoryReply, StoryReaction, StoryPollVote, HighlightItem):
        assert db.query(model).filter_by(story_id=story_id).count() == 0
    assert db.query(Highlight).count() == 0           # its only story is gone, so the highlight is too
    assert db.query(StoryMedia).count() == 0
    assert world.client.get(f"/stories/{sid}", headers=world.h("bella")).status_code == 404


def test_only_the_owner_can_delete(world):
    story = world.publish("alex")
    assert world.client.delete(f"/stories/{story['id']}", headers=world.h("bella")).status_code == 404
    assert world.client.get(f"/stories/{story['id']}", headers=world.h("alex")).status_code == 200


def test_deleting_a_story_updates_other_highlight_covers(world):
    a, b = world.publish("alex"), world.publish("alex")
    h = world.client.post("/highlights", headers=world.h("alex"),
                          json={"title": "Both", "story_ids": [a["id"], b["id"]], "cover_story_id": a["id"]}).json()
    world.client.delete(f"/stories/{a['id']}", headers=world.h("alex"))
    detail = world.client.get(f"/highlights/{h['id']}", headers=world.h("alex")).json()
    assert [s["id"] for s in detail["stories"]] == [b["id"]]
    assert detail["story_count"] == 1


# ── Highlights ───────────────────────────────────────────────────────────────

def make_highlight(world, owner, title, stories, **extra):
    r = world.client.post("/highlights", headers=world.h(owner),
                          json={"title": title, "story_ids": [s["id"] for s in stories], **extra})
    assert r.status_code == 201, r.text
    return r.json()


def test_create_list_and_open_a_highlight(world):
    a, b = world.publish("alex"), world.publish("alex")
    h = make_highlight(world, "alex", "  Trades  ", [a, b])
    assert h["title"] == "Trades" and h["story_count"] == 2 and h["cover_url"].startswith("/media/")

    listed = world.client.get(f"/highlights/user/{world.user('alex')}", headers=world.h("bella")).json()
    assert [x["title"] for x in listed] == ["Trades"]
    detail = world.client.get(f"/highlights/{h['id']}", headers=world.h("bella")).json()
    assert [s["id"] for s in detail["stories"]] == [a["id"], b["id"]]


def test_highlight_stories_stay_visible_after_they_expire(world, db):
    story = world.publish("alex")
    h = make_highlight(world, "alex", "Keepers", [story])
    expire(db, story["id"])
    assert world.story_ids("bella", "alex") == []                                   # no longer an active story
    detail = world.client.get(f"/highlights/{h['id']}", headers=world.h("bella"))
    assert detail.status_code == 200 and detail.json()["stories"][0]["expired"] is True
    assert world.client.post(f"/stories/{story['id']}/view", headers=world.h("bella")).status_code == 204
    # ...but interactions that only make sense on live stories stay closed
    assert world.client.post(f"/stories/{story['id']}/replies", headers=world.h("bella"),
                             json={"text": "hi"}).status_code == 404


def test_highlights_respect_story_privacy(world):
    public, private = world.publish("alex"), world.publish("alex", audience="close_friends")
    h = make_highlight(world, "alex", "Mixed", [public, private])
    detail = world.client.get(f"/highlights/{h['id']}", headers=world.h("bella")).json()
    assert [s["id"] for s in detail["stories"]] == [public["id"]]
    assert world.client.get(f"/highlights/user/{world.user('alex')}", headers=world.h("bella")).json()[0]["story_count"] == 1

    only_private = make_highlight(world, "alex", "Secret", [private])
    assert world.client.get(f"/highlights/{only_private['id']}", headers=world.h("bella")).status_code == 404
    titles = [x["title"] for x in world.client.get(f"/highlights/user/{world.user('alex')}", headers=world.h("bella")).json()]
    assert titles == ["Mixed"]
    owner_titles = [x["title"] for x in world.client.get(f"/highlights/user/{world.user('alex')}", headers=world.h("alex")).json()]
    assert owner_titles == ["Mixed", "Secret"]


def test_highlight_edit_rename_cover_and_story_order(world):
    a, b, c = (world.publish("alex") for _ in range(3))
    h = make_highlight(world, "alex", "Old", [a, b])
    patch = lambda body: world.client.patch(f"/highlights/{h['id']}", headers=world.h("alex"), json=body)

    assert patch({"title": "New name"}).json()["title"] == "New name"
    assert patch({"story_ids": [c["id"], a["id"], b["id"]]}).status_code == 200
    detail = world.client.get(f"/highlights/{h['id']}", headers=world.h("alex")).json()
    assert [s["id"] for s in detail["stories"]] == [c["id"], a["id"], b["id"]]

    assert patch({"cover_story_id": b["id"]}).status_code == 200
    assert patch({"cover_story_id": str(uuid.uuid4())}).status_code == 400    # must be one of its stories
    assert patch({"title": "   "}).status_code == 422
    assert patch({"story_ids": []}).status_code == 422


def test_highlight_ownership_rules(world):
    mine, theirs = world.publish("alex"), world.publish("bella")
    bad = world.client.post("/highlights", headers=world.h("alex"), json={"title": "x", "story_ids": [theirs["id"]]})
    assert bad.status_code == 400
    h = make_highlight(world, "alex", "Mine", [mine])
    assert world.client.patch(f"/highlights/{h['id']}", headers=world.h("bella"), json={"title": "hax"}).status_code == 404
    assert world.client.delete(f"/highlights/{h['id']}", headers=world.h("bella")).status_code == 404
    stolen = world.client.patch(f"/highlights/{h['id']}", headers=world.h("alex"), json={"story_ids": [theirs["id"]]})
    assert stolen.status_code == 400
    assert world.client.post("/highlights", headers=world.h("alex"), json={"title": "", "story_ids": [mine["id"]]}).status_code == 422
    assert world.client.post("/highlights", headers=world.h("alex"), json={"title": "t" * 31, "story_ids": [mine["id"]]}).status_code == 422


def test_deleting_a_highlight_keeps_the_stories(world):
    story = world.publish("alex")
    h = make_highlight(world, "alex", "Gone soon", [story])
    assert world.client.delete(f"/highlights/{h['id']}", headers=world.h("alex")).status_code == 204
    assert world.client.get(f"/highlights/{h['id']}", headers=world.h("alex")).status_code == 404
    assert world.story_ids("alex", "alex") == [story["id"]]


def test_reorder_highlights(world):
    s = [world.publish("alex") for _ in range(3)]
    hs = [make_highlight(world, "alex", f"H{i}", [s[i]]) for i in range(3)]
    ids = [h["id"] for h in hs]
    r = world.client.put("/highlights/order", headers=world.h("alex"), json={"ids": [ids[2], ids[0], ids[1]]})
    assert r.status_code == 204
    titles = [x["title"] for x in world.client.get(f"/highlights/user/{world.user('alex')}", headers=world.h("alex")).json()]
    assert titles == ["H2", "H0", "H1"]
    foreign = world.client.put("/highlights/order", headers=world.h("bella"), json={"ids": [ids[0]]})
    assert foreign.status_code == 404
