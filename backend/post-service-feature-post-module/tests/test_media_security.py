import io
import pytest


def test_media_upload_extension_rejection(client, user1_headers):
    create_res = client.post("/api/v1/posts/", json={"caption": "Media post"}, headers=user1_headers)
    post_id = create_res.json()["id"]

    # Attempt to upload malicious script file extension
    file = ("script.exe", io.BytesIO(b"malicious executable"), "image/jpeg")
    res = client.post(f"/api/v1/posts/{post_id}/media", files={"file": file}, headers=user1_headers)
    assert res.status_code == 400
    assert "Unsupported file extension" in res.json()["detail"]


def test_media_upload_mime_rejection(client, user1_headers):
    create_res = client.post("/api/v1/posts/", json={"caption": "Media post"}, headers=user1_headers)
    post_id = create_res.json()["id"]

    # Attempt to upload un-allowed MIME type
    file = ("image.jpg", io.BytesIO(b"fake data"), "application/x-msdownload")
    res = client.post(f"/api/v1/posts/{post_id}/media", files={"file": file}, headers=user1_headers)
    assert res.status_code == 400
    assert "Unsupported MIME type" in res.json()["detail"]


def test_media_upload_magic_bytes_validation(client, user1_headers):
    create_res = client.post("/api/v1/posts/", json={"caption": "Media post"}, headers=user1_headers)
    post_id = create_res.json()["id"]

    # File with image/jpeg mime type but invalid text magic bytes
    file = ("image.jpg", io.BytesIO(b"NOT A REAL JPEG IMAGE HEADER"), "image/jpeg")
    res = client.post(f"/api/v1/posts/{post_id}/media", files={"file": file}, headers=user1_headers)
    assert res.status_code == 400
    assert "magic bytes" in res.json()["detail"]
