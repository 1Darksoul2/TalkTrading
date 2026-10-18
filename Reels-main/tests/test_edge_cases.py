import pytest
from tests.test_reels import sample_reel_payload


def test_validation_error_invalid_duration(client, auth_headers):
    payload = sample_reel_payload()
    payload["media"]["duration"] = -5.0  # Invalid negative duration
    res = client.post("/api/v1/reels", json=payload, headers=auth_headers)
    assert res.status_code == 422
    assert res.json()["success"] is False
    assert "Validation error" in res.json()["message"]


def test_private_reel_access_control(client, auth_headers, other_auth_headers):
    # Creator publishes private reel
    payload = sample_reel_payload()
    payload["visibility"] = "private"
    create_res = client.post("/api/v1/reels", json=payload, headers=auth_headers)
    assert create_res.status_code == 201
    reel_id = create_res.json()["data"]["id"]

    # Creator can view it
    owner_get = client.get(f"/api/v1/reels/{reel_id}", headers=auth_headers)
    assert owner_get.status_code == 200

    # Other user gets 403 Forbidden
    other_get = client.get(f"/api/v1/reels/{reel_id}", headers=other_auth_headers)
    assert other_get.status_code == 403
    assert "private" in other_get.json()["message"]

    # Anonymous user gets 403 Forbidden
    anon_get = client.get(f"/api/v1/reels/{reel_id}")
    assert anon_get.status_code == 403


def test_comments_disabled_reel(client, auth_headers, other_auth_headers):
    payload = sample_reel_payload()
    payload["allow_comments"] = False
    create_res = client.post("/api/v1/reels", json=payload, headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    # Attempt to post a comment
    comment_res = client.post(
        f"/api/v1/reels/{reel_id}/comments",
        json={"content": "Should fail because comments are off"},
        headers=other_auth_headers
    )
    assert comment_res.status_code == 403
    assert "Comments are disabled" in comment_res.json()["message"]


def test_reply_to_nonexistent_parent_comment(client, auth_headers):
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    reply_res = client.post(
        f"/api/v1/reels/{reel_id}/comments",
        json={"content": "Ghost reply", "parent_id": "non_existent_comment_id"},
        headers=auth_headers
    )
    assert reply_res.status_code == 404
    assert "Parent comment not found" in reply_res.json()["message"]


def test_delete_comment_permissions(client, auth_headers, other_auth_headers):
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    # Other user adds comment
    comment_res = client.post(
        f"/api/v1/reels/{reel_id}/comments",
        json={"content": "Viewer comment"},
        headers=other_auth_headers
    )
    comment_id = comment_res.json()["data"]["id"]

    # Reel owner can delete comments on their reel
    del_res = client.delete(f"/api/v1/reels/comments/{comment_id}", headers=auth_headers)
    assert del_res.status_code == 200
