import io
import pytest

VALID_PNG_HEADER = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"


def test_full_social_content_workflow(client, user1_headers, user2_headers):
    # 1. User 1 Creates Post with Hashtags & Mentions
    create_res = client.post(
        "/api/v1/posts/",
        json={"caption": "Full end-to-end test #Social #Microservice with @alice", "visibility": "public"},
        headers=user1_headers,
    )
    assert create_res.status_code == 201
    post_id = create_res.json()["id"]

    # 2. User 1 Attaches Media
    dummy_file = ("photo.png", io.BytesIO(VALID_PNG_HEADER), "image/png")
    media_res = client.post(
        f"/api/v1/posts/{post_id}/media",
        files={"file": dummy_file},
        data={"position": 0},
        headers=user1_headers,
    )
    assert media_res.status_code == 201

    # 3. User 2 Adds Top-Level Comment
    comm_res = client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "Awesome post!"},
        headers=user2_headers,
    )
    assert comm_res.status_code == 201
    comment_id = comm_res.json()["id"]

    # 4. User 1 Replies to Comment
    reply_res = client.post(
        f"/api/v1/posts/{post_id}/comments",
        json={"content": "Thanks!", "parent_comment_id": comment_id},
        headers=user1_headers,
    )
    assert reply_res.status_code == 201

    # 5. User 2 Likes Post
    client.post(f"/api/v1/posts/{post_id}/likes", headers=user2_headers)

    # 6. User 2 Saves Post
    client.post(f"/api/v1/posts/{post_id}/save", headers=user2_headers)

    # 7. User 2 Shares Post
    client.post(f"/api/v1/posts/{post_id}/shares", headers=user2_headers)

    # 8. Retrieve Post Detail & Verify Engagement Counters
    detail_res = client.get(f"/api/v1/posts/{post_id}", headers=user2_headers)
    assert detail_res.status_code == 200
    eng = detail_res.json()["engagement"]
    assert eng["like_count"] == 1
    assert eng["comment_count"] == 2
    assert eng["save_count"] == 1
    assert eng["share_count"] == 1
    assert eng["is_liked_by_me"] is True
    assert eng["is_saved_by_me"] is True

    # 9. Verify Post Appears in Feed
    feed_res = client.get("/api/v1/feed/", headers=user2_headers)
    assert feed_res.status_code == 200
    feed_post_ids = [p["id"] for p in feed_res.json()["posts"]]
    assert post_id in feed_post_ids

    # 10. Delete Comment
    del_comm = client.delete(f"/api/v1/comments/{comment_id}", headers=user2_headers)
    assert del_comm.status_code == 200

    # 11. Delete Post
    del_post = client.delete(f"/api/v1/posts/{post_id}", headers=user1_headers)
    assert del_post.status_code == 200

    # 12. Verify Post Disappears from Feed & Detail 404
    feed_res2 = client.get("/api/v1/feed/", headers=user2_headers)
    feed_post_ids2 = [p["id"] for p in feed_res2.json()["posts"]]
    assert post_id not in feed_post_ids2

    get_del = client.get(f"/api/v1/posts/{post_id}")
    assert get_del.status_code == 404
