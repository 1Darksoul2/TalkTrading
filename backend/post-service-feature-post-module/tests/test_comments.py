import pytest


def test_create_comment_and_reply(client, user1_headers, user2_headers):
    # 1. Create post
    post_res = client.post("/api/v1/posts/", json={"caption": "Post for comment testing"}, headers=user1_headers)
    post_id = post_res.json()["id"]

    # 2. Add top-level comment
    comment_payload = {"content": "Great post!"}
    c_res = client.post(f"/api/v1/posts/{post_id}/comments", json=comment_payload, headers=user2_headers)
    assert c_res.status_code == 201
    parent_comment_id = c_res.json()["id"]
    assert c_res.json()["content"] == "Great post!"
    assert c_res.json()["parent_comment_id"] is None

    # 3. Add nested reply using parent_comment_id
    reply_payload = {"content": "Thank you!", "parent_comment_id": parent_comment_id}
    r_res = client.post(f"/api/v1/posts/{post_id}/comments", json=reply_payload, headers=user1_headers)
    assert r_res.status_code == 201
    assert r_res.json()["parent_comment_id"] == parent_comment_id

    # 4. Fetch comment list for post
    list_res = client.get(f"/api/v1/posts/{post_id}/comments")
    assert list_res.status_code == 200
    tree = list_res.json()
    assert len(tree) == 1
    assert tree[0]["id"] == parent_comment_id
    assert len(tree[0]["replies"]) == 1
    assert tree[0]["replies"][0]["content"] == "Thank you!"


def test_invalid_reply_parent(client, user1_headers):
    post_res = client.post("/api/v1/posts/", json={"caption": "Post"}, headers=user1_headers)
    post_id = post_res.json()["id"]

    reply_payload = {"content": "Replying to non-existent", "parent_comment_id": 99999}
    r_res = client.post(f"/api/v1/posts/{post_id}/comments", json=reply_payload, headers=user1_headers)
    assert r_res.status_code == 400


def test_edit_and_delete_comment(client, user1_headers, user2_headers):
    post_res = client.post("/api/v1/posts/", json={"caption": "Post"}, headers=user1_headers)
    post_id = post_res.json()["id"]

    c_res = client.post(f"/api/v1/posts/{post_id}/comments", json={"content": "Original comment"}, headers=user1_headers)
    comment_id = c_res.json()["id"]

    # User 2 cannot edit User 1's comment
    edit_err = client.put(f"/api/v1/comments/{comment_id}", json={"content": "Hacked"}, headers=user2_headers)
    assert edit_err.status_code == 403

    # User 1 edits comment
    edit_ok = client.put(f"/api/v1/comments/{comment_id}", json={"content": "Updated comment"}, headers=user1_headers)
    assert edit_ok.status_code == 200
    assert edit_ok.json()["content"] == "Updated comment"

    # User 1 deletes comment
    del_ok = client.delete(f"/api/v1/comments/{comment_id}", headers=user1_headers)
    assert del_ok.status_code == 200
