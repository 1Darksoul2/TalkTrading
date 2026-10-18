def test_like_and_unlike_post(client, auth_headers):
    create_res = client.post("/api/v1/posts/", json={"caption": "Likeable Post"}, headers=auth_headers)
    post_id = create_res.json()["id"]

    count_res = client.get(f"/api/v1/posts/{post_id}/likes/count")
    assert count_res.status_code == 200
    assert count_res.json()["like_count"] == 0

    like_res = client.post(f"/api/v1/posts/{post_id}/likes", headers=auth_headers)
    assert like_res.status_code == 200

    count_res2 = client.get(f"/api/v1/posts/{post_id}/likes/count")
    assert count_res2.json()["like_count"] == 1

    dup_like = client.post(f"/api/v1/posts/{post_id}/likes", headers=auth_headers)
    assert dup_like.status_code == 409

    unlike_res = client.delete(f"/api/v1/posts/{post_id}/likes", headers=auth_headers)
    assert unlike_res.status_code == 200


def test_comments_on_post(client, auth_headers):
    create_res = client.post("/api/v1/posts/", json={"caption": "Commentable Post"}, headers=auth_headers)
    post_id = create_res.json()["id"]

    comment_res = client.post(f"/api/v1/posts/{post_id}/comments", json={"content": "Great post!"}, headers=auth_headers)
    assert comment_res.status_code == 201
    comment_data = comment_res.json()
    comment_id = comment_data["id"]

    get_comm = client.get(f"/api/v1/posts/{post_id}/comments")
    assert get_comm.status_code == 200
    assert len(get_comm.json()) == 1

    del_comm = client.delete(f"/api/v1/comments/{comment_id}", headers=auth_headers)
    assert del_comm.status_code == 200


def test_bookmark_post(client, auth_headers):
    create_res = client.post("/api/v1/posts/", json={"caption": "Bookmark Post"}, headers=auth_headers)
    post_id = create_res.json()["id"]

    bm_res = client.post(f"/api/v1/posts/{post_id}/save", headers=auth_headers)
    assert bm_res.status_code == 200

    my_bm = client.get("/api/v1/users/me/saved-posts", headers=auth_headers)
    assert my_bm.status_code == 200
    assert len(my_bm.json()) == 1

    del_bm = client.delete(f"/api/v1/posts/{post_id}/save", headers=auth_headers)
    assert del_bm.status_code == 200
