import pytest

from app.core.security import create_access_token

from app.models.user import User

U1, U2, U3 = 101, 202, 303


@pytest.fixture(autouse=True)
def seed_users(db_session):
    # Following requires the target to be a real account, so give the three
    # token identities used below matching user rows.
    for n, aid in enumerate((U1, U2, U3), start=1):
        db_session.add(User(id=f"00000000-0000-4000-8000-00000000000{n}", author_id=aid,
                            username=f"user{n}", email=f"user{n}@example.com", hashed_password="x"))
    db_session.commit()


@pytest.fixture
def user3_headers():
    token = create_access_token(data={"user_id": U3, "sub": str(U3)})
    return {"Authorization": f"Bearer {token}"}


def _post(client, headers, caption, visibility="public"):
    r = client.post("/api/v1/posts/", headers=headers, json={"caption": caption, "visibility": visibility})
    assert r.status_code == 201
    return r.json()["id"]


def test_follow_updates_counts_for_both_sides(client, user1_headers, user2_headers):
    r = client.post(f"/api/v1/users/{U2}/follow", headers=user1_headers)
    assert r.status_code == 201
    assert r.json()["followers_count"] == 1 and r.json()["is_following"] is True

    stats_2 = client.get(f"/api/v1/users/{U2}/follow-stats", headers=user2_headers).json()
    assert stats_2["followers_count"] == 1 and stats_2["follows_you"] is False
    stats_1 = client.get(f"/api/v1/users/{U1}/follow-stats", headers=user1_headers).json()
    assert stats_1["following_count"] == 1


def test_follow_rules(client, user1_headers):
    assert client.post(f"/api/v1/users/{U1}/follow", headers=user1_headers).status_code == 400
    assert client.post(f"/api/v1/users/{U2}/follow", headers=user1_headers).status_code == 201
    assert client.post(f"/api/v1/users/{U2}/follow", headers=user1_headers).status_code == 409
    assert client.post(f"/api/v1/users/{U2}/follow").status_code == 401


def test_unfollow(client, user1_headers):
    client.post(f"/api/v1/users/{U2}/follow", headers=user1_headers)
    r = client.delete(f"/api/v1/users/{U2}/follow", headers=user1_headers)
    assert r.status_code == 200 and r.json()["followers_count"] == 0 and r.json()["is_following"] is False
    assert client.delete(f"/api/v1/users/{U2}/follow", headers=user1_headers).status_code == 404


def test_follower_and_following_lists(client, user1_headers, user3_headers):
    client.post(f"/api/v1/users/{U2}/follow", headers=user1_headers)
    client.post(f"/api/v1/users/{U2}/follow", headers=user3_headers)
    assert set(client.get(f"/api/v1/users/{U2}/followers").json()["user_ids"]) == {U1, U3}
    assert client.get(f"/api/v1/users/{U1}/following").json()["user_ids"] == [U2]


def test_followers_only_post_visible_to_followers_not_strangers(client, user1_headers, user2_headers, user3_headers):
    pid = _post(client, user1_headers, "for followers", "followers")
    client.post(f"/api/v1/users/{U1}/follow", headers=user2_headers)  # user2 follows the author

    assert client.get(f"/api/v1/posts/{pid}", headers=user2_headers).status_code == 200
    assert pid in [p["id"] for p in client.get("/api/v1/posts/", headers=user2_headers).json()]
    assert client.post(f"/api/v1/posts/{pid}/likes", headers=user2_headers).status_code == 200

    assert client.get(f"/api/v1/posts/{pid}", headers=user3_headers).status_code == 404
    assert pid not in [p["id"] for p in client.get("/api/v1/posts/", headers=user3_headers).json()]

    client.delete(f"/api/v1/users/{U1}/follow", headers=user2_headers)  # unfollow hides it again
    assert client.get(f"/api/v1/posts/{pid}", headers=user2_headers).status_code == 404


def test_private_post_stays_hidden_from_followers(client, user1_headers, user2_headers):
    pid = _post(client, user1_headers, "only me", "private")
    client.post(f"/api/v1/users/{U1}/follow", headers=user2_headers)
    assert client.get(f"/api/v1/posts/{pid}", headers=user2_headers).status_code == 404


def test_following_feed_shows_only_me_and_followed_accounts(client, user1_headers, user2_headers, user3_headers):
    mine = _post(client, user1_headers, "mine")
    followed = _post(client, user2_headers, "from someone I follow")
    other = _post(client, user3_headers, "from a stranger")
    client.post(f"/api/v1/users/{U2}/follow", headers=user1_headers)

    following = [p["id"] for p in client.get("/api/v1/feed/?scope=following", headers=user1_headers).json()["posts"]]
    assert set(following) == {mine, followed}

    everyone = [p["id"] for p in client.get("/api/v1/feed/?scope=all", headers=user1_headers).json()["posts"]]
    assert {mine, followed, other} <= set(everyone)


def test_following_feed_includes_followers_only_posts_of_followed(client, user1_headers, user2_headers):
    fo = _post(client, user2_headers, "followers only", "followers")
    client.post(f"/api/v1/users/{U2}/follow", headers=user1_headers)
    feed = [p["id"] for p in client.get("/api/v1/feed/?scope=following", headers=user1_headers).json()["posts"]]
    assert fo in feed


def test_following_feed_is_empty_when_anonymous(client, user1_headers):
    _post(client, user1_headers, "hello")
    assert client.get("/api/v1/feed/?scope=following").json()["posts"] == []
