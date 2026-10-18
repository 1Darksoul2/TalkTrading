import pytest


def test_create_post_success(client, user1_headers):
    payload = {
        "caption": "Exploring #FastAPI and #Python microservices with @john_doe!",
        "visibility": "public"
    }
    response = client.post("/api/v1/posts/", json=payload, headers=user1_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["caption"] == payload["caption"]
    assert data["author_id"] == 101
    assert data["visibility"] == "public"
    assert data["status"] == "active"
    assert "id" in data


def test_create_post_unauthorized(client):
    payload = {"caption": "No token post"}
    response = client.post("/api/v1/posts/", json=payload)
    assert response.status_code == 401


def test_get_post_by_id_success(client, user1_headers):
    create_res = client.post("/api/v1/posts/", json={"caption": "Test post for detail"}, headers=user1_headers)
    post_id = create_res.json()["id"]

    response = client.get(f"/api/v1/posts/{post_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == post_id
    assert "engagement" in data
    assert data["engagement"]["like_count"] == 0


def test_get_post_by_id_not_found(client):
    response = client.get("/api/v1/posts/99999")
    assert response.status_code == 404


def test_update_post_success(client, user1_headers):
    create_res = client.post("/api/v1/posts/", json={"caption": "Original Caption"}, headers=user1_headers)
    post_id = create_res.json()["id"]

    update_res = client.put(f"/api/v1/posts/{post_id}", json={"caption": "Updated #NewCaption"}, headers=user1_headers)
    assert update_res.status_code == 200
    assert update_res.json()["caption"] == "Updated #NewCaption"


def test_update_post_forbidden(client, user1_headers, user2_headers):
    create_res = client.post("/api/v1/posts/", json={"caption": "User 101 Post"}, headers=user1_headers)
    post_id = create_res.json()["id"]

    update_res = client.put(f"/api/v1/posts/{post_id}", json={"caption": "Hacked"}, headers=user2_headers)
    assert update_res.status_code == 403


def test_delete_post_success(client, user1_headers):
    create_res = client.post("/api/v1/posts/", json={"caption": "To Be Deleted"}, headers=user1_headers)
    post_id = create_res.json()["id"]

    del_res = client.delete(f"/api/v1/posts/{post_id}", headers=user1_headers)
    assert del_res.status_code == 200
    assert del_res.json()["message"] == "Post deleted successfully"

    get_res = client.get(f"/api/v1/posts/{post_id}")
    assert get_res.status_code == 404
