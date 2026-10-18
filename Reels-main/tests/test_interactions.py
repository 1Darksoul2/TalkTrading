from tests.test_reels import sample_reel_payload


def test_like_and_unlike_flow(client, auth_headers):
    # Create reel
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    # First like
    like_res1 = client.post(f"/api/v1/reels/{reel_id}/like", headers=auth_headers)
    assert like_res1.status_code == 200
    assert like_res1.json()["data"]["liked"] is True
    assert like_res1.json()["data"]["likes_count"] == 1

    # Second like toggles it off
    like_res2 = client.post(f"/api/v1/reels/{reel_id}/like", headers=auth_headers)
    assert like_res2.status_code == 200
    assert like_res2.json()["data"]["liked"] is False
    assert like_res2.json()["data"]["likes_count"] == 0


def test_bookmark_and_unbookmark_flow(client, auth_headers):
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    bm1 = client.post(f"/api/v1/reels/{reel_id}/bookmark", headers=auth_headers)
    assert bm1.status_code == 200
    assert bm1.json()["data"]["bookmarked"] is True
    assert bm1.json()["data"]["bookmarks_count"] == 1

    bm2 = client.post(f"/api/v1/reels/{reel_id}/bookmark", headers=auth_headers)
    assert bm2.status_code == 200
    assert bm2.json()["data"]["bookmarked"] is False
    assert bm2.json()["data"]["bookmarks_count"] == 0


def test_share_counter(client, auth_headers):
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    share_res = client.post(f"/api/v1/reels/{reel_id}/share", json={"platform": "whatsapp"})
    assert share_res.status_code == 200
    assert share_res.json()["data"]["shares_count"] == 1


def test_comments_and_replies_flow(client, auth_headers):
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    # Add parent comment
    c1_res = client.post(
        f"/api/v1/reels/{reel_id}/comments",
        json={"content": "Great video!"},
        headers=auth_headers
    )
    assert c1_res.status_code == 201
    parent_id = c1_res.json()["data"]["id"]

    # Add reply comment
    r1_res = client.post(
        f"/api/v1/reels/{reel_id}/comments",
        json={"content": "Totally agree with this!", "parent_id": parent_id},
        headers=auth_headers
    )
    assert r1_res.status_code == 201
    assert r1_res.json()["data"]["parent_id"] == parent_id

    # Verify comments list
    list_res = client.get(f"/api/v1/reels/{reel_id}/comments")
    assert list_res.status_code == 200
    comments = list_res.json()["data"]
    assert len(comments) == 1
    assert comments[0]["content"] == "Great video!"
    assert comments[0]["replies_count"] == 1
