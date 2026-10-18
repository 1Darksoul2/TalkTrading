import io
import pytest

VALID_JPEG_HEADER = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xfe\x00\x13Created with GIMP\xff\xc0"


def test_upload_and_delete_media(client, user1_headers, user2_headers):
    # 1. Create post
    post_res = client.post("/api/v1/posts/", json={"caption": "Post with media"}, headers=user1_headers)
    post_id = post_res.json()["id"]

    # 2. User 2 cannot upload media to User 1's post
    dummy_file = ("image.jpg", io.BytesIO(VALID_JPEG_HEADER), "image/jpeg")
    upload_err = client.post(
        f"/api/v1/posts/{post_id}/media",
        files={"file": dummy_file},
        data={"position": 0},
        headers=user2_headers,
    )
    assert upload_err.status_code == 403

    # 3. User 1 uploads valid media
    dummy_file_ok = ("image.jpg", io.BytesIO(VALID_JPEG_HEADER), "image/jpeg")
    upload_ok = client.post(
        f"/api/v1/posts/{post_id}/media",
        files={"file": dummy_file_ok},
        data={"position": 0},
        headers=user1_headers,
    )
    assert upload_ok.status_code == 201
    media_data = upload_ok.json()
    assert media_data["media_type"] == "image"
    assert "url" in media_data
    media_id = media_data["id"]

    # 4. Get post detail to verify media list
    post_detail = client.get(f"/api/v1/posts/{post_id}")
    assert post_detail.status_code == 200
    assert len(post_detail.json()["media_items"]) == 1

    # 5. Delete media item
    del_media = client.delete(f"/api/v1/media/{media_id}", headers=user1_headers)
    assert del_media.status_code == 200
