def view(world, viewer, story_id):
    return world.client.post(f"/stories/{story_id}/view", headers=world.h(viewer))


def test_views_are_recorded_once_and_owner_views_do_not_count(world):
    story = world.publish("alex")
    for _ in range(2):
        assert view(world, "bella", story["id"]).status_code == 204
    assert view(world, "alex", story["id"]).status_code == 204
    assert view(world, "cara", story["id"]).status_code == 204

    stats = world.client.get(f"/stories/{story['id']}/analytics", headers=world.h("alex")).json()
    assert stats["views"] == 2 and stats["unique_viewers"] == 2
    own = world.client.get(f"/stories/{story['id']}", headers=world.h("alex")).json()
    assert own["view_count"] == 2


def test_viewer_list_is_owner_only_and_enriched(world):
    story = world.publish("alex")
    view(world, "bella", story["id"])
    view(world, "cara", story["id"])
    world.client.put(f"/stories/{story['id']}/reaction", headers=world.h("bella"), json={"emoji": "🔥"})
    world.client.post(f"/stories/{story['id']}/replies", headers=world.h("cara"), json={"text": "nice"})

    viewers = world.client.get(f"/stories/{story['id']}/viewers", headers=world.h("alex")).json()
    by_name = {v["user"]["username"]: v for v in viewers}
    assert set(by_name) == {"bella", "cara"}
    assert by_name["bella"]["reaction"] == "🔥" and by_name["bella"]["replied"] is False
    assert by_name["cara"]["reaction"] is None and by_name["cara"]["replied"] is True

    for name in ("bella", "cara", "stranger"):
        assert world.client.get(f"/stories/{story['id']}/viewers", headers=world.h(name)).status_code == 404


def test_viewer_list_is_paginated_newest_first(world):
    story = world.publish("alex")
    for name in ("v1", "v2", "v3"):
        view(world, name, story["id"])
    page1 = world.client.get(f"/stories/{story['id']}/viewers?size=2", headers=world.h("alex")).json()
    page2 = world.client.get(f"/stories/{story['id']}/viewers?size=2&page=2", headers=world.h("alex")).json()
    assert [len(page1), len(page2)] == [2, 1]
    assert {v["viewer_id"] for v in page1} | {v["viewer_id"] for v in page2} == {
        str(world.user(n)) for n in ("v1", "v2", "v3")}


def test_viewed_flag_is_per_viewer(world):
    story = world.publish("alex")
    view(world, "bella", story["id"])
    assert world.client.get(f"/stories/user/{world.user('alex')}", headers=world.h("bella")).json()[0]["seen"] is True
    assert world.client.get(f"/stories/user/{world.user('alex')}", headers=world.h("cara")).json()[0]["seen"] is False


# ── Replies ──────────────────────────────────────────────────────────────────

def reply(world, viewer, story_id, text="great call"):
    return world.client.post(f"/stories/{story_id}/replies", headers=world.h(viewer), json={"text": text})


def test_reply_is_stored_and_only_the_owner_can_read_replies(world):
    story = world.publish("alex")
    r = reply(world, "bella", story["id"], "  love this  ")
    assert r.status_code == 201 and r.json()["text"] == "love this"

    replies = world.client.get(f"/stories/{story['id']}/replies", headers=world.h("alex")).json()
    assert [(x["text"], x["user"]["username"]) for x in replies] == [("love this", "bella")]
    assert world.client.get(f"/stories/{story['id']}/replies", headers=world.h("bella")).status_code == 404


def test_reply_validation(world):
    story = world.publish("alex")
    assert reply(world, "bella", story["id"], "").status_code == 422
    assert reply(world, "bella", story["id"], "   ").status_code == 422
    assert reply(world, "bella", story["id"], "x" * 1001).status_code == 422
    assert reply(world, "alex", story["id"]).status_code == 403  # nobody replies to their own story


def test_reply_permission_off_everyone_following(world):
    story = world.publish("alex")
    world.client.put("/story-settings", headers=world.h("alex"), json={"allow_replies": "off"})
    assert reply(world, "bella", story["id"]).status_code == 403
    assert world.client.get(f"/stories/{story['id']}", headers=world.h("bella")).json()["can_reply"] is False

    world.client.put("/story-settings", headers=world.h("alex"), json={"allow_replies": "following"})
    assert reply(world, "bella", story["id"]).status_code == 403  # alex does not follow bella
    world.follow("alex", "bella")
    assert reply(world, "bella", story["id"]).status_code == 201
    assert world.client.get(f"/stories/{story['id']}", headers=world.h("bella")).json()["can_reply"] is True

    world.client.put("/story-settings", headers=world.h("alex"), json={"allow_replies": "everyone"})
    assert reply(world, "cara", story["id"]).status_code == 201


def test_reply_notification_respects_the_owners_preference(world):
    story = world.publish("alex")
    reply(world, "bella", story["id"], "first")
    world.client.put("/story-settings", headers=world.h("alex"), json={"notify_replies": False})
    reply(world, "bella", story["id"], "second")  # stored, but no notification
    inbox = world.client.get("/notifications", headers=world.h("alex")).json()
    assert [n["text"] for n in inbox["notifications"]] == ["first"]
    stored = world.client.get(f"/stories/{story['id']}/replies", headers=world.h("alex")).json()
    assert len(stored) == 2


# ── Reactions ────────────────────────────────────────────────────────────────

def test_one_reaction_per_viewer_replace_and_remove(world):
    story = world.publish("alex")
    react = lambda who, emoji: world.client.put(f"/stories/{story['id']}/reaction", headers=world.h(who), json={"emoji": emoji})
    assert react("bella", "🔥").status_code == 204
    assert react("bella", "❤️").status_code == 204
    assert react("cara", "🔥").status_code == 204
    stats = world.client.get(f"/stories/{story['id']}/analytics", headers=world.h("alex")).json()
    assert stats["reactions"] == {"❤️": 1, "🔥": 1}
    mine = world.client.get(f"/stories/{story['id']}", headers=world.h("bella")).json()
    assert mine["my_reaction"] == "❤️"

    assert world.client.delete(f"/stories/{story['id']}/reaction", headers=world.h("bella")).status_code == 204
    assert world.client.get(f"/stories/{story['id']}", headers=world.h("bella")).json()["my_reaction"] is None


def test_reaction_validation_and_notification_only_on_first_reaction(world):
    story = world.publish("alex")
    react = lambda who, emoji: world.client.put(f"/stories/{story['id']}/reaction", headers=world.h(who), json={"emoji": emoji})
    assert react("bella", "not-an-emoji").status_code == 422
    assert react("alex", "🔥").status_code == 400
    react("bella", "🔥")
    react("bella", "🚀")
    inbox = world.client.get("/notifications", headers=world.h("alex")).json()
    assert [(n["type"], n["text"]) for n in inbox["notifications"]] == [("story_reaction", "🔥")]


# ── Poll, link taps, reports ─────────────────────────────────────────────────

POLL = [{"type": "poll", "question": "NVDA higher?", "options": ["Yes", "No"]}]


def test_poll_vote_once_with_results_visible_after_voting(world):
    story = world.publish("alex", overlays=POLL)
    before = world.client.get(f"/stories/{story['id']}", headers=world.h("bella")).json()
    assert before["poll"] is None  # results are hidden until you vote

    r = world.client.post(f"/stories/{story['id']}/poll/vote", headers=world.h("bella"), json={"option": 1})
    assert r.status_code == 200 and r.json() == {"counts": [0, 1], "total": 1, "my_vote": 1}
    assert world.client.post(f"/stories/{story['id']}/poll/vote", headers=world.h("bella"),
                             json={"option": 0}).status_code == 409
    world.client.post(f"/stories/{story['id']}/poll/vote", headers=world.h("cara"), json={"option": 1})

    after = world.client.get(f"/stories/{story['id']}", headers=world.h("bella")).json()
    assert after["poll"]["counts"] == [0, 2] and after["poll"]["my_vote"] == 1
    owner = world.client.get(f"/stories/{story['id']}", headers=world.h("alex")).json()
    assert owner["poll"]["total"] == 2


def test_poll_vote_validation(world):
    plain = world.publish("alex")
    poll = world.publish("alex", overlays=POLL)
    vote = lambda sid, who, option: world.client.post(f"/stories/{sid}/poll/vote", headers=world.h(who), json={"option": option})
    assert vote(plain["id"], "bella", 0).status_code == 400
    assert vote(poll["id"], "bella", 2).status_code == 422
    assert vote(poll["id"], "alex", 0).status_code == 400  # owners do not vote in their own poll


def test_poll_vote_notifies_the_owner_with_the_chosen_option(world):
    story = world.publish("alex", overlays=POLL)
    world.client.post(f"/stories/{story['id']}/poll/vote", headers=world.h("bella"), json={"option": 0})
    inbox = world.client.get("/notifications", headers=world.h("alex")).json()
    assert [(n["type"], n["text"]) for n in inbox["notifications"]] == [("story_poll_vote", "Yes")]


def test_link_taps_are_counted_for_viewers_not_the_owner(world):
    story = world.publish("alex", overlays=[{"type": "link", "url": "https://example.com"}])
    for who in ("bella", "bella", "cara", "alex"):
        assert world.client.post(f"/stories/{story['id']}/link-click", headers=world.h(who)).status_code == 204
    assert world.client.get(f"/stories/{story['id']}/analytics", headers=world.h("alex")).json()["link_clicks"] == 3


def test_reporting_a_story(world, db):
    from app.models import StoryReport
    story = world.publish("alex")
    body = {"reason": "spam", "details": "pump and dump"}
    assert world.client.post(f"/stories/{story['id']}/report", headers=world.h("bella"), json=body).status_code == 204
    assert world.client.post(f"/stories/{story['id']}/report", headers=world.h("bella"), json=body).status_code == 204
    assert db.query(StoryReport).count() == 1  # one report per person per story
    assert world.client.post(f"/stories/{story['id']}/report", headers=world.h("alex"), json=body).status_code == 400
    assert world.client.post(f"/stories/{story['id']}/report", headers=world.h("cara"),
                             json={"reason": "made-up"}).status_code == 422
