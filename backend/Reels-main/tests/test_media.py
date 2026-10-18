MP4_HEAD = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64
JPEG_HEAD = b"\xff\xd8\xff\xe0" + b"\x00" * 64


def test_upload_video_and_poster_then_fetch_it(client, auth_headers):
    res = client.post(
        "/api/v1/media",
        headers=auth_headers,
        files={"video": ("clip.mp4", MP4_HEAD, "video/mp4"), "poster": ("p.jpg", JPEG_HEAD, "image/jpeg")},
    )
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["mime_type"] == "video/mp4"
    assert data["file_size_bytes"] == len(MP4_HEAD)
    assert data["thumbnail_url"].endswith(".jpg")

    served = client.get(data["video_url"])
    assert served.status_code == 200
    assert served.content == MP4_HEAD


def test_upload_requires_login(client):
    res = client.post("/api/v1/media", files={"video": ("clip.mp4", MP4_HEAD, "video/mp4")})
    assert res.status_code == 401


def test_upload_rejects_a_non_video_whatever_its_name(client, auth_headers):
    res = client.post("/api/v1/media", headers=auth_headers, files={"video": ("clip.mp4", b"<html>not a video</html>", "video/mp4")})
    assert res.status_code == 415


def test_uploaded_video_can_be_published_as_a_reel(client, auth_headers):
    up = client.post("/api/v1/media", headers=auth_headers, files={"video": ("clip.webm", b"\x1a\x45\xdf\xa3" + b"\x00" * 32, "video/webm")})
    media = up.json()["data"]
    reel = client.post("/api/v1/reels", headers=auth_headers, json={
        "caption": "Breakout",
        "tags": ["NVDA"],
        "media": {"video_url": media["video_url"], "duration": 12.5, "mime_type": media["mime_type"]},
    })
    assert reel.status_code == 201
    assert reel.json()["data"]["media"]["video_url"] == media["video_url"]
    assert reel.json()["data"]["tags"] == "NVDA"
