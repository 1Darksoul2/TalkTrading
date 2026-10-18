import pytest


def test_like_unlike_flow(client, user1_headers, user2_headers):
    post_res = client.post("/api/v1/posts/", json={"caption": "Like test post"}, headers=user1_headers)
    post_id = post_res.json()["id"]

    # 1. Check initial like count
    count_res = client.get(f"/api/v1/posts/{post_id}/likes/count")
    assert count_res.status_code == 200
    assert count_res.json()["like_count"] == 0

    # 2. Like post
    like_res = client.post(f"/api/v1/posts/{post_id}/likes", headers=user1_headers)
    assert like_res.status_code == 200

    # 3. Duplicate like attempt -> 409 Conflict
    dup_res = client.post(f"/api/v1/posts/{post_id}/likes", headers=user1_headers)
    assert dup_res.status_code == 409

    # 4. User 2 likes post
    like2_res = client.post(f"/api/v1/posts/{post_id}/likes", headers=user2_headers)
    assert like2_res.status_code == 200

    # 5. Check updated like count -> 2
    count_res2 = client.get(f"/api/v1/posts/{post_id}/likes/count")
    assert count_res2.json()["like_count"] == 2

    # 6. Unlike post
    unlike_res = client.delete(f"/api/v1/posts/{post_id}/likes", headers=user1_headers)
    assert unlike_res.status_code == 200

    # 7. Final count -> 1
    count_res3 = client.get(f"/api/v1/posts/{post_id}/likes/count")
    assert count_res3.json()["like_count"] == 1
