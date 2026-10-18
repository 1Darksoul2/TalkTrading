"""Question, emoji slider, quiz, countdown and shared-post stickers."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models import StoryCountdownReminder, StoryStickerResponse
from app.stories_service import send_countdown_reminders

SOON = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
QUIZ = {"type": "quiz", "question": "Which closed green?", "options": ["SPY", "QQQ", "IWM"], "correct": 1}


def story(world, owner="alex", **sticker):
    return world.publish(owner, overlays=[sticker])


def get(world, viewer, sid):
    r = world.client.get(f"/stories/{sid}", headers=world.h(viewer))
    assert r.status_code == 200, r.text
    return r.json()


# ── Publishing rules ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("bad", [
    {"type": "question", "prompt": ""},
    {"type": "slider", "question": "", "emoji": "🔥"},
    {"type": "quiz", "question": "q", "options": ["only"], "correct": 0},
    {"type": "quiz", "question": "q", "options": ["a", "b"], "correct": 2},
    {"type": "quiz", "question": "q", "options": ["a", "b", "c", "d", "e"], "correct": 0},
    {"type": "countdown", "title": "Earnings", "ends_at": "2020-01-01T00:00:00Z"},
    {"type": "countdown", "title": "Too far", "ends_at": (datetime.now(timezone.utc) + timedelta(days=400)).isoformat()},
    {"type": "post", "post_id": 0},
])
def test_invalid_stickers_are_rejected(world, bad):
    media = world.upload("alex").json()["media_id"]
    assert world.client.post("/stories", headers=world.h("alex"), json={"media_id": media, "overlays": [bad]}).status_code == 422


def test_only_one_interactive_sticker_per_story(world):
    media = world.upload("alex").json()["media_id"]
    r = world.client.post("/stories", headers=world.h("alex"), json={"media_id": media, "overlays": [
        {"type": "poll", "question": "q", "options": ["a", "b"]}, QUIZ]})
    assert r.status_code == 422


def test_shared_post_must_be_visible_to_the_sharer(world):
    world.graph.visible_posts.add(42)
    ok = story(world, type="post", post_id=42)
    assert ok["overlays"][0] == {"type": "post", "post_id": 42, "x": 0.5, "y": 0.5, "scale": 1.0, "rotation": 0.0}
    media = world.upload("alex").json()["media_id"]
    hidden = world.client.post("/stories", headers=world.h("alex"), json={"media_id": media, "overlays": [{"type": "post", "post_id": 7}]})
    assert hidden.status_code == 422 and "not available" in hidden.json()["detail"]
    media = world.upload("alex").json()["media_id"]
    two = world.client.post("/stories", headers=world.h("alex"), json={"media_id": media, "overlays": [{"type": "post", "post_id": 42}] * 2})
    assert two.status_code == 422


# ── Question ─────────────────────────────────────────────────────────────────

def test_question_answers_go_only_to_the_owner(world):
    s = story(world, type="question", prompt="Ask me about options")
    for text in ("What strike?", "Which expiry?"):
        assert world.client.post(f"/stories/{s['id']}/question", headers=world.h("bella"), json={"text": text}).status_code == 201
    assert get(world, "bella", s["id"])["sticker"] == {"kind": "question", "my_answers": 2}

    answers = world.client.get(f"/stories/{s['id']}/question/answers", headers=world.h("alex")).json()
    assert [(a["user"]["username"], a["value"]) for a in answers] == [("bella", "Which expiry?"), ("bella", "What strike?")]
    assert world.client.get(f"/stories/{s['id']}/question/answers", headers=world.h("bella")).status_code == 404
    assert get(world, "alex", s["id"])["sticker"]["answers"] == 2

    inbox = world.client.get("/notifications", headers=world.h("alex")).json()["notifications"]
    assert {n["type"] for n in inbox} == {"story_question"}


def test_question_validation(world):
    s = story(world, type="question", prompt="Ask")
    assert world.client.post(f"/stories/{s['id']}/question", headers=world.h("bella"), json={"text": "   "}).status_code == 422
    assert world.client.post(f"/stories/{s['id']}/question", headers=world.h("alex"), json={"text": "me?"}).status_code == 400
    plain = world.publish("alex")
    assert world.client.post(f"/stories/{plain['id']}/question", headers=world.h("bella"), json={"text": "x"}).status_code == 400


def test_question_notifications_follow_the_reply_preference(world):
    s = story(world, type="question", prompt="Ask")
    world.client.put("/story-settings", headers=world.h("alex"), json={"notify_replies": False})
    world.client.post(f"/stories/{s['id']}/question", headers=world.h("bella"), json={"text": "hi"})
    assert world.client.get("/notifications", headers=world.h("alex")).json()["notifications"] == []


# ── Slider ───────────────────────────────────────────────────────────────────

def test_slider_average_is_shown_after_answering(world):
    s = story(world, type="slider", question="How bullish?", emoji="🚀")
    assert get(world, "bella", s["id"])["sticker"] == {"kind": "slider", "my_value": None}
    r = world.client.post(f"/stories/{s['id']}/slider", headers=world.h("bella"), json={"value": 80})
    assert r.status_code == 200 and r.json() == {"kind": "slider", "my_value": 80, "average": 80, "count": 1}
    world.client.post(f"/stories/{s['id']}/slider", headers=world.h("cara"), json={"value": 40})
    assert world.client.post(f"/stories/{s['id']}/slider", headers=world.h("bella"), json={"value": 10}).status_code == 409
    assert get(world, "bella", s["id"])["sticker"]["average"] == 60
    assert get(world, "dan", s["id"])["sticker"] == {"kind": "slider", "my_value": None}   # has not answered
    assert get(world, "alex", s["id"])["sticker"]["count"] == 2
    assert world.client.post(f"/stories/{s['id']}/slider", headers=world.h("dan"), json={"value": 101}).status_code == 422


# ── Quiz ─────────────────────────────────────────────────────────────────────

def test_quiz_correct_answer_is_hidden_until_you_answer(world):
    s = story(world, **QUIZ)
    before = get(world, "bella", s["id"])
    assert "correct" not in before["overlays"][0] and before["sticker"] == {"kind": "quiz", "my_answer": None}

    r = world.client.post(f"/stories/{s['id']}/quiz", headers=world.h("bella"), json={"option": 0})
    assert r.json() == {"kind": "quiz", "my_answer": 0, "correct": 1, "counts": [1, 0, 0]}
    after = get(world, "bella", s["id"])
    assert after["overlays"][0]["correct"] == 1
    assert "correct" not in get(world, "cara", s["id"])["overlays"][0]       # still hidden from others
    assert get(world, "alex", s["id"])["overlays"][0]["correct"] == 1         # the owner always sees it

    assert world.client.post(f"/stories/{s['id']}/quiz", headers=world.h("bella"), json={"option": 1}).status_code == 409
    assert world.client.post(f"/stories/{s['id']}/quiz", headers=world.h("cara"), json={"option": 3}).status_code == 422


def test_quiz_answer_is_not_leaked_through_other_endpoints(world):
    s = story(world, **QUIZ)
    feed = world.client.get(f"/stories/user/{world.user('alex')}", headers=world.h("bella")).json()
    assert "correct" not in feed[0]["overlays"][0]
    h = world.client.post("/highlights", headers=world.h("alex"), json={"title": "Q", "story_ids": [s["id"]]}).json()
    detail = world.client.get(f"/highlights/{h['id']}", headers=world.h("bella")).json()
    assert "correct" not in detail["stories"][0]["overlays"][0]


# ── Countdown ────────────────────────────────────────────────────────────────

def test_countdown_reminders_are_sent_once_when_it_ends(world, db):
    s = story(world, type="countdown", title="FOMC", ends_at=SOON)
    r = world.client.put(f"/stories/{s['id']}/countdown/reminder", headers=world.h("bella"))
    assert r.json() == {"kind": "countdown", "reminded": True}
    world.client.put(f"/stories/{s['id']}/countdown/reminder", headers=world.h("bella"))   # twice is fine
    world.client.put(f"/stories/{s['id']}/countdown/reminder", headers=world.h("cara"))
    world.client.delete(f"/stories/{s['id']}/countdown/reminder", headers=world.h("cara"))
    assert get(world, "bella", s["id"])["sticker"] == {"kind": "countdown", "reminded": True}
    assert get(world, "alex", s["id"])["sticker"]["reminders"] == 1

    assert send_countdown_reminders(db) == 0                                   # not ended yet
    db.query(StoryCountdownReminder).update({"ends_at": datetime.now(timezone.utc) - timedelta(minutes=1)})
    db.commit()
    assert send_countdown_reminders(db) == 1
    assert send_countdown_reminders(db) == 0                                   # never twice
    inbox = world.client.get("/notifications", headers=world.h("bella")).json()["notifications"]
    assert [(n["type"], n["text"], n["actor"]["username"]) for n in inbox] == [("story_countdown", "FOMC", "alex")]
    assert world.client.get("/notifications", headers=world.h("cara")).json()["notifications"] == []


def test_owner_cannot_set_a_reminder_on_their_own_countdown(world):
    s = story(world, type="countdown", title="CPI", ends_at=SOON)
    assert world.client.put(f"/stories/{s['id']}/countdown/reminder", headers=world.h("alex")).status_code == 400


# ── Privacy, analytics, deletion ─────────────────────────────────────────────

def test_sticker_actions_respect_story_privacy(world):
    s = world.publish("alex", audience="close_friends", overlays=[{"type": "question", "prompt": "Ask"}])
    assert world.client.post(f"/stories/{s['id']}/question", headers=world.h("bella"), json={"text": "hi"}).status_code == 404
    q = world.publish("alex", audience="close_friends", overlays=[QUIZ])
    assert world.client.post(f"/stories/{q['id']}/quiz", headers=world.h("bella"), json={"option": 1}).status_code == 404


def test_analytics_include_sticker_results_and_deletion_cleans_up(world, db):
    s = story(world, type="slider", question="Bullish?", emoji="🔥")
    world.client.post(f"/stories/{s['id']}/slider", headers=world.h("bella"), json={"value": 30})
    stats = world.client.get(f"/stories/{s['id']}/analytics", headers=world.h("alex")).json()
    assert stats["sticker"] == {"kind": "slider", "my_value": None, "average": 30, "count": 1}
    world.client.delete(f"/stories/{s['id']}", headers=world.h("alex"))
    assert db.query(StoryStickerResponse).filter_by(story_id=uuid.UUID(s["id"])).count() == 0


def test_export_includes_sticker_answers_sent(world):
    s = story(world, type="question", prompt="Ask")
    world.client.post(f"/stories/{s['id']}/question", headers=world.h("bella"), json={"text": "When?"})
    data = world.client.get("/export", headers=world.h("bella")).json()
    assert [(a["kind"], a["value"]) for a in data["sticker_answers_sent"]] == [("question", "When?")]
