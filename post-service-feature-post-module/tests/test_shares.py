import pytest


def test_post_share_flow(client, user1_headers, user2_headers):
    post_res = client.post("/api/v1/posts/", json={"caption": "Share test post"}, headers=user1_headers)
    post_id = post_res.json()["id"]

    # Share post
    share_res = client.post(f"/api/v1/posts/{post_id}/shares", headers=user2_headers)
    assert share_res.status_code == 201
    assert share_res.json()["share_count"] == 1

    # Share post again by user 1
    share2_res = client.post(f"/api/v1/posts/{post_id}/shares", headers=user1_headers)
    assert share2_res.status_code == 201
    assert share2_res.json()["share_count"] == 2
