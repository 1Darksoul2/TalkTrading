"""Who can see what. Every case here is enforced by the server for direct API calls, not just hidden in the UI."""
import uuid


def settings(world, name, **values):
    r = world.client.put("/story-settings", headers=world.h(name), json=values)
    assert r.status_code == 200, r.text


def can_open(world, viewer, story_id) -> bool:
    return world.client.get(f"/stories/{story_id}", headers=world.h(viewer)).status_code == 200


def test_public_stories_are_visible_to_any_logged_in_user(world):
    story = world.publish("alex")
    assert world.story_ids("stranger", "alex") == [story["id"]]
    assert can_open(world, "stranger", story["id"])


def test_followers_only_audience_hides_stories_from_non_followers(world):
    settings(world, "alex", who_can_see="followers")
    story = world.publish("alex")
    world.follow("bella", "alex")

    assert world.story_ids("bella", "alex") == [story["id"]]
    assert world.story_ids("stranger", "alex") == []
    assert not can_open(world, "stranger", story["id"])
    assert can_open(world, "bella", story["id"])


def test_hidden_from_blocks_a_follower(world):
    story = world.publish("alex")
    world.follow("bella", "alex")
    world.follow("cara", "alex")
    r = world.client.post("/story-hidden", headers=world.h("alex"), json={"user_id": str(world.user("bella"))})
    assert r.status_code == 204

    assert world.story_ids("bella", "alex") == []
    assert not can_open(world, "bella", story["id"])
    assert world.story_ids("cara", "alex") == [story["id"]]

    world.client.delete(f"/story-hidden/{world.user('bella')}", headers=world.h("alex"))
    assert world.story_ids("bella", "alex") == [story["id"]]


def test_close_friends_story_is_only_for_close_friends(world):
    for friend in ("bella", "cara"):
        world.follow(friend, "alex")
    world.client.post("/close-friends", headers=world.h("alex"), json={"user_id": str(world.user("bella"))})
    story = world.publish("alex", audience="close_friends")

    assert world.story_ids("bella", "alex") == [story["id"]]
    assert world.story_ids("cara", "alex") == []          # follower, but not a close friend
    assert world.story_ids("stranger", "alex") == []
    assert world.story_ids("alex", "alex") == [story["id"]]
    assert not can_open(world, "cara", story["id"])


def test_removing_a_close_friend_takes_effect_immediately(world):
    story = world.publish("alex", audience="close_friends")
    world.client.post("/close-friends", headers=world.h("alex"), json={"user_id": str(world.user("bella"))})
    assert can_open(world, "bella", story["id"])
    world.client.delete(f"/close-friends/{world.user('bella')}", headers=world.h("alex"))
    assert not can_open(world, "bella", story["id"])


def test_mentioned_people_can_open_a_close_friends_story_unless_hidden(world):
    world.user("bella")
    story = world.publish("alex", audience="close_friends", overlays=[{"type": "mention", "username": "bella"}])
    assert can_open(world, "bella", story["id"])
    world.client.post("/story-hidden", headers=world.h("alex"), json={"user_id": str(world.user("bella"))})
    assert not can_open(world, "bella", story["id"])


def test_unauthorized_viewers_cannot_use_any_story_action_by_id(world):
    world.client.post("/close-friends", headers=world.h("alex"), json={"user_id": str(world.user("bella"))})
    story = world.publish("alex", audience="close_friends",
                          overlays=[{"type": "poll", "question": "Up?", "options": ["Yes", "No"]},
                                    {"type": "link", "url": "https://example.com"}])
    sid = story["id"]
    h = world.h("stranger")
    calls = [
        world.client.get(f"/stories/{sid}", headers=h),
        world.client.post(f"/stories/{sid}/view", headers=h),
        world.client.post(f"/stories/{sid}/replies", headers=h, json={"text": "hi"}),
        world.client.put(f"/stories/{sid}/reaction", headers=h, json={"emoji": "🔥"}),
        world.client.post(f"/stories/{sid}/poll/vote", headers=h, json={"option": 0}),
        world.client.post(f"/stories/{sid}/link-click", headers=h),
        world.client.post(f"/stories/{sid}/report", headers=h, json={"reason": "spam"}),
        world.client.get(f"/stories/{sid}/viewers", headers=h),
        world.client.get(f"/stories/{sid}/analytics", headers=h),
        world.client.get(f"/stories/{sid}/replies", headers=h),
        world.client.delete(f"/stories/{sid}", headers=h),
    ]
    assert [c.status_code for c in calls] == [404] * len(calls)
    # nothing was recorded, and the owner's numbers are untouched
    stats = world.client.get(f"/stories/{sid}/analytics", headers=world.h("alex")).json()
    assert stats["views"] == 0 and stats["replies"] == 0 and stats["reactions"] == {} and stats["link_clicks"] == 0


def test_hidden_content_is_indistinguishable_from_missing(world):
    story = world.publish("alex", audience="close_friends")
    hidden = world.client.get(f"/stories/{story['id']}", headers=world.h("stranger"))
    missing = world.client.get(f"/stories/{uuid.uuid4()}", headers=world.h("stranger"))
    assert hidden.status_code == missing.status_code == 404
    assert hidden.json() == missing.json()


def test_feed_endpoint_applies_the_same_rules(world):
    world.follow("bella", "alex")
    open_story = world.publish("alex")
    world.publish("alex", audience="close_friends")
    r = world.client.get(f"/stories/feed?user_ids={world.user('alex')}", headers=world.h("bella"))
    assert [s["id"] for s in r.json()] == [open_story["id"]]


# ── Tray ─────────────────────────────────────────────────────────────────────

def tray(world, name):
    r = world.client.get("/stories/tray", headers=world.h(name))
    assert r.status_code == 200, r.text
    return r.json()


def test_tray_lists_followed_people_with_visible_stories_only(world):
    world.follow("me", "alex")
    world.follow("me", "bella")
    world.user("cara")  # not followed
    world.user("dan")   # followed, nothing posted
    world.follow("me", "dan")
    world.publish("alex")
    world.publish("bella", audience="close_friends")  # me is not a close friend
    world.publish("cara")
    assert [t["user"]["username"] for t in tray(world, "me")] == ["alex"]


def test_tray_puts_own_first_then_unseen_then_seen_then_muted(world):
    for other in ("alex", "bella", "cara", "dan"):
        world.follow("me", other)
    mine = world.publish("me")
    stories = {name: world.publish(name) for name in ("alex", "bella", "cara", "dan")}

    # `me` watches bella's story, and mutes dan
    world.client.post(f"/stories/{stories['bella']['id']}/view", headers=world.h("me"))
    world.client.post("/story-mutes", headers=world.h("me"), json={"user_id": str(world.user("dan"))})

    items = tray(world, "me")
    order = [(t["user"]["username"], t["has_unseen"], t["muted"]) for t in items]
    assert items[0]["is_me"] and items[0]["user"]["user_id"] == mine["user_id"]
    assert [o[0] for o in order[1:3]] in (["cara", "alex"], ["alex", "cara"])  # unseen, newest first
    assert order[3] == ("bella", False, False)                                  # seen
    assert order[4] == ("dan", True, True)                                      # muted goes last


def test_tray_marks_close_friends_ring_and_story_count(world):
    world.follow("me", "alex")
    world.client.post("/close-friends", headers=world.h("alex"), json={"user_id": str(world.user("me"))})
    world.publish("alex")
    world.publish("alex", audience="close_friends")
    item = tray(world, "me")[0]
    assert item["story_count"] == 2 and item["close_friends"] is True


def test_tray_hides_followers_only_stories_from_non_followers_among_followed(world):
    # "me" follows alex, so followers-only stories are visible; a hidden-from entry still wins
    settings(world, "alex", who_can_see="followers")
    world.follow("me", "alex")
    world.publish("alex")
    assert len(tray(world, "me")) == 1
    world.client.post("/story-hidden", headers=world.h("alex"), json={"user_id": str(world.user("me"))})
    assert tray(world, "me") == []


def test_tray_is_empty_when_the_post_service_is_unreachable(world, monkeypatch):
    world.follow("me", "alex")
    world.publish("alex")
    monkeypatch.setattr(world.graph, "following", lambda who: [])
    assert tray(world, "me") == []
