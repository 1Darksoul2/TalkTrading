from app.core.security import derive_author_id
from app.models.mention import Mention
from tests.test_profiles import signup


def make_post(client, headers, caption, visibility="public"):
    r = client.post("/api/v1/posts/", headers=headers, json={"caption": caption, "visibility": visibility})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def mentioned_ids(client, user, viewer_headers=None):
    r = client.get(f"/api/v1/users/{derive_author_id(user['id'])}/mentions", headers=viewer_headers or {})
    assert r.status_code == 200
    return [p["id"] for p in r.json()]


def test_post_mentions_are_stored_for_real_users_only(client):
    _, ha = signup(client, "alex")
    bella, _ = signup(client, "bella")
    pid = make_post(client, ha, "great call @Bella and @ghost, also @alex myself")
    assert mentioned_ids(client, bella) == [pid]


def test_duplicate_mentions_are_stored_once(client, db_session):
    _, ha = signup(client, "alex")
    signup(client, "bella")
    make_post(client, ha, "@bella @bella @BELLA")
    assert db_session.query(Mention).count() == 1


def test_editing_caption_replaces_mentions(client):
    _, ha = signup(client, "alex")
    bella, _ = signup(client, "bella")
    cara, _ = signup(client, "cara")
    pid = make_post(client, ha, "hi @bella")
    assert client.put(f"/api/v1/posts/{pid}", headers=ha, json={"caption": "hi @cara"}).status_code == 200
    assert mentioned_ids(client, bella) == []
    assert mentioned_ids(client, cara) == [pid]


def test_comment_mentions_are_stored_and_replaced_on_edit(client, db_session):
    _, ha = signup(client, "alex")
    bella, hb = signup(client, "bella")
    signup(client, "cara")
    pid = make_post(client, ha, "plain post")
    c = client.post(f"/api/v1/posts/{pid}/comments", headers=hb, json={"content": "ping @alex"}).json()
    assert [m.mentioned_user_id for m in db_session.query(Mention).filter_by(comment_id=c["id"])] != []
    client.put(f"/api/v1/comments/{c['id']}", headers=hb, json={"content": "ping @cara"})
    stored = {m.mentioned_user_id for m in db_session.query(Mention).filter_by(comment_id=c["id"])}
    assert len(stored) == 1


def test_mentions_list_respects_visibility(client):
    _, ha = signup(client, "alex")
    bella, hb = signup(client, "bella")
    _, hc = signup(client, "cara")
    public = make_post(client, ha, "@bella public")
    private = make_post(client, ha, "@bella private", "private")
    assert mentioned_ids(client, bella) == [public]  # anonymous
    assert mentioned_ids(client, bella, hc) == [public]  # stranger
    assert mentioned_ids(client, bella, ha) == [private, public]  # author sees both
