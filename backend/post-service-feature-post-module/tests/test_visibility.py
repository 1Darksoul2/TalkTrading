import pytest


@pytest.fixture
def make_post(client, user1_headers):
    def _make(visibility):
        r = client.post("/api/v1/posts/", headers=user1_headers, json={"caption": f"{visibility} post", "visibility": visibility})
        assert r.status_code == 201
        return r.json()["id"]
    return _make


@pytest.mark.parametrize("visibility", ["private", "followers"])
def test_hidden_post_is_404_for_strangers_and_anonymous(client, make_post, user2_headers, visibility):
    pid = make_post(visibility)
    assert client.get(f"/api/v1/posts/{pid}", headers=user2_headers).status_code == 404
    assert client.get(f"/api/v1/posts/{pid}").status_code == 404


@pytest.mark.parametrize("visibility", ["private", "followers"])
def test_author_still_sees_own_hidden_post(client, make_post, user1_headers, visibility):
    pid = make_post(visibility)
    assert client.get(f"/api/v1/posts/{pid}", headers=user1_headers).status_code == 200


def test_public_post_visible_to_everyone(client, make_post, user2_headers):
    pid = make_post("public")
    assert client.get(f"/api/v1/posts/{pid}").status_code == 200
    assert client.get(f"/api/v1/posts/{pid}", headers=user2_headers).status_code == 200


def test_list_and_search_exclude_hidden_posts_for_others(client, make_post, user1_headers, user2_headers):
    public_id = make_post("public")
    private_id = make_post("private")
    for headers, expect_private in ((user2_headers, False), (None, False), (user1_headers, True)):
        ids = [p["id"] for p in client.get("/api/v1/posts/", headers=headers or {}, params={"limit": 100}).json()]
        assert public_id in ids
        assert (private_id in ids) is expect_private
    searched = client.get("/api/v1/posts/", headers=user2_headers, params={"search": "private"}).json()
    assert private_id not in [p["id"] for p in searched]


def test_filtering_by_private_visibility_does_not_reveal_others_posts(client, make_post, user2_headers):
    make_post("private")
    r = client.get("/api/v1/posts/", headers=user2_headers, params={"visibility": "private"})
    assert r.status_code == 200 and r.json() == []


def test_strangers_cannot_engage_with_hidden_post(client, make_post, user2_headers):
    pid = make_post("private")
    assert client.post(f"/api/v1/posts/{pid}/likes", headers=user2_headers).status_code == 404
    assert client.post(f"/api/v1/posts/{pid}/save", headers=user2_headers).status_code == 404
    assert client.post(f"/api/v1/posts/{pid}/shares", headers=user2_headers).status_code == 404
    assert client.post(f"/api/v1/posts/{pid}/comments", headers=user2_headers, json={"content": "x"}).status_code == 404
    assert client.get(f"/api/v1/posts/{pid}/comments", headers=user2_headers).status_code == 404
    assert client.get(f"/api/v1/posts/{pid}/likes/count", headers=user2_headers).status_code == 404


def test_author_can_still_engage_with_own_private_post(client, make_post, user1_headers):
    pid = make_post("private")
    assert client.post(f"/api/v1/posts/{pid}/comments", headers=user1_headers, json={"content": "note to self"}).status_code == 201
    assert client.post(f"/api/v1/posts/{pid}/save", headers=user1_headers).status_code in (200, 201)


def test_comment_on_hidden_post_cannot_be_read_by_id(client, make_post, user1_headers, user2_headers):
    pid = make_post("private")
    cid = client.post(f"/api/v1/posts/{pid}/comments", headers=user1_headers, json={"content": "secret"}).json()["id"]
    assert client.get(f"/api/v1/comments/{cid}", headers=user2_headers).status_code == 404
    assert client.get(f"/api/v1/comments/{cid}", headers=user1_headers).status_code == 200
