import pytest


def test_feed_pagination_and_visibility(client, user1_headers, user2_headers):
    # User 1 creates a public post and a private post
    client.post("/api/v1/posts/", json={"caption": "User 1 Public", "visibility": "public"}, headers=user1_headers)
    client.post("/api/v1/posts/", json={"caption": "User 1 Private", "visibility": "private"}, headers=user1_headers)

    # User 2 creates a public post
    client.post("/api/v1/posts/", json={"caption": "User 2 Public", "visibility": "public"}, headers=user2_headers)

    # Unauthenticated feed -> gets only public posts (2 posts)
    feed_unauth = client.get("/api/v1/feed/")
    assert feed_unauth.status_code == 200
    posts_unauth = feed_unauth.json()["posts"]
    assert len(posts_unauth) == 2

    # User 1 authenticated feed -> gets public posts + own private post (3 posts)
    feed_user1 = client.get("/api/v1/feed/", headers=user1_headers)
    assert feed_user1.status_code == 200
    posts_user1 = feed_user1.json()["posts"]
    assert len(posts_user1) == 3

    # Test limit=1 pagination
    feed_page1 = client.get("/api/v1/feed/?limit=1", headers=user1_headers)
    assert feed_page1.status_code == 200
    data = feed_page1.json()
    assert len(data["posts"]) == 1
    assert data["has_more"] is True
    assert data["next_cursor"] is not None
