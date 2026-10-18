import pytest


def test_save_unsave_flow(client, user1_headers):
    post_res = client.post("/api/v1/posts/", json={"caption": "Save test post"}, headers=user1_headers)
    post_id = post_res.json()["id"]

    # 1. Save post
    save_res = client.post(f"/api/v1/posts/{post_id}/save", headers=user1_headers)
    assert save_res.status_code == 200

    # 2. Duplicate save -> 409 Conflict
    dup_res = client.post(f"/api/v1/posts/{post_id}/save", headers=user1_headers)
    assert dup_res.status_code == 409

    # 3. Retrieve saved posts
    my_saved = client.get("/api/v1/users/me/saved-posts", headers=user1_headers)
    assert my_saved.status_code == 200
    assert len(my_saved.json()) == 1
    assert my_saved.json()[0]["id"] == post_id

    # 4. Unsave post
    unsave_res = client.delete(f"/api/v1/posts/{post_id}/save", headers=user1_headers)
    assert unsave_res.status_code == 200

    # 5. Verify empty saved list
    my_saved2 = client.get("/api/v1/users/me/saved-posts", headers=user1_headers)
    assert len(my_saved2.json()) == 0
