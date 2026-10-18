import pytest


def test_denormalized_counters_sync(client, user1_headers, user2_headers):
    post_res = client.post("/api/v1/posts/", json={"caption": "Counters post"}, headers=user1_headers)
    post_id = post_res.json()["id"]

    # Add comment -> comment_count=1
    client.post(f"/api/v1/posts/{post_id}/comments", json={"content": "Nice!"}, headers=user2_headers)

    # Add like -> like_count=1
    client.post(f"/api/v1/posts/{post_id}/likes", headers=user2_headers)

    # Save post -> save_count=1
    client.post(f"/api/v1/posts/{post_id}/save", headers=user2_headers)

    # Share post -> share_count=1
    client.post(f"/api/v1/posts/{post_id}/shares", headers=user2_headers)

    # Verify detail response engagement counters
    detail = client.get(f"/api/v1/posts/{post_id}", headers=user2_headers)
    assert detail.status_code == 200
    eng = detail.json()["engagement"]
    assert eng["like_count"] == 1
    assert eng["comment_count"] == 1
    assert eng["save_count"] == 1
    assert eng["share_count"] == 1
    assert eng["is_liked_by_me"] is True
    assert eng["is_saved_by_me"] is True
