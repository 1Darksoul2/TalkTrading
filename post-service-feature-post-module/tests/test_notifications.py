from app.core.security import derive_author_id
from tests.test_profiles import signup


def post(client, headers, caption, visibility="public"):
    r = client.post("/api/v1/posts/", headers=headers, json={"caption": caption, "visibility": visibility})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def inbox(client, headers, **params):
    r = client.get("/api/v1/notifications", headers=headers, params=params)
    assert r.status_code == 200, r.text
    return r.json()


def kinds(client, headers):
    return [(n["type"], n["actor"]["username"]) for n in inbox(client, headers)["notifications"]]


def test_requires_login(client):
    assert client.get("/api/v1/notifications").status_code == 401
    assert client.post("/api/v1/notifications/read-all").status_code == 401


def test_follow_like_and_comment_notify_the_right_person(client):
    alex, ha = signup(client, "alex")
    _, hb = signup(client, "bella")
    pid = post(client, ha, "hello")
    client.post(f"/api/v1/users/{derive_author_id(alex['id'])}/follow", headers=hb)
    client.post(f"/api/v1/posts/{pid}/likes", headers=hb)
    client.post(f"/api/v1/posts/{pid}/comments", headers=hb, json={"content": "nice"})
    assert kinds(client, ha) == [("comment", "bella"), ("like", "bella"), ("follow", "bella")]
    assert kinds(client, hb) == []


def test_own_actions_and_repeat_likes_do_not_notify(client):
    _, ha = signup(client, "alex")
    _, hb = signup(client, "bella")
    pid = post(client, ha, "hello")
    client.post(f"/api/v1/posts/{pid}/likes", headers=ha)
    client.post(f"/api/v1/posts/{pid}/comments", headers=ha, json={"content": "me"})
    assert inbox(client, ha)["notifications"] == []
    client.post(f"/api/v1/posts/{pid}/likes", headers=hb)
    client.delete(f"/api/v1/posts/{pid}/likes", headers=hb)
    client.post(f"/api/v1/posts/{pid}/likes", headers=hb)
    assert kinds(client, ha) == [("like", "bella")]


def test_mentions_notify_only_people_who_can_see_the_post(client):
    _, ha = signup(client, "alex")
    _, hb = signup(client, "bella")
    _, hc = signup(client, "cara")
    post(client, ha, "public shout-out @bella")
    post(client, ha, "secret note @cara", visibility="private")
    assert kinds(client, hb) == [("mention", "alex")]
    assert kinds(client, hc) == []


def test_comment_mentions_notify_when_the_post_is_visible(client):
    _, ha = signup(client, "alex")
    _, hb = signup(client, "bella")
    _, hc = signup(client, "cara")
    pid = post(client, ha, "plain")
    client.post(f"/api/v1/posts/{pid}/comments", headers=hb, json={"content": "ping @cara"})
    assert ("mention", "bella") in kinds(client, hc)


def test_unread_count_and_marking_read(client):
    alex, ha = signup(client, "alex")
    _, hb = signup(client, "bella")
    _, hc = signup(client, "cara")
    for h in (hb, hc):
        client.post(f"/api/v1/users/{derive_author_id(alex['id'])}/follow", headers=h)
    assert client.get("/api/v1/notifications/unread-count", headers=ha).json() == {"unread_count": 2}

    first = inbox(client, ha)["notifications"][0]["id"]
    assert client.post(f"/api/v1/notifications/{first}/read", headers=ha).status_code == 200
    assert client.post(f"/api/v1/notifications/{first}/read", headers=ha).status_code == 404
    assert inbox(client, ha, unread_only=True)["unread_count"] == 1
    assert client.post("/api/v1/notifications/read-all", headers=ha).json() == {"marked": 1}
    assert inbox(client, ha, unread_only=True)["notifications"] == []


def test_cannot_mark_someone_elses_notification(client):
    alex, ha = signup(client, "alex")
    _, hb = signup(client, "bella")
    client.post(f"/api/v1/users/{derive_author_id(alex['id'])}/follow", headers=hb)
    nid = inbox(client, ha)["notifications"][0]["id"]
    assert client.post(f"/api/v1/notifications/{nid}/read", headers=hb).status_code == 404
    assert inbox(client, ha)["unread_count"] == 1
