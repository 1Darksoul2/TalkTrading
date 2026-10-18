def sample_reel_payload():
    return {
        "caption": "Incredible sunset timelapse! #sunset #photography",
        "tags": ["sunset", "nature", "timelapse"],
        "visibility": "public",
        "allow_comments": True,
        "allow_duet": True,
        "allow_sharing": True,
        "media": {
            "video_url": "https://storage.example.com/videos/sunset.mp4",
            "thumbnail_url": "https://storage.example.com/thumbnails/sunset.jpg",
            "duration": 28.5,
            "width": 1080,
            "height": 1920,
            "aspect_ratio": "9:16",
            "mime_type": "video/mp4"
        },
        "audio": {
            "title": "Chill Sunset Beats",
            "artist": "LoFi Producer",
            "audio_url": "https://storage.example.com/audio/chill_sunset.mp3",
            "duration": 30.0,
            "is_original": False
        }
    }


def test_create_reel_authorized(client, auth_headers):
    payload = sample_reel_payload()
    response = client.post("/api/v1/reels", json=payload, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["success"] is True
    reel = data["data"]
    assert reel["user_id"] == "user_creator_001"
    assert reel["caption"] == payload["caption"]
    assert reel["media"]["video_url"] == payload["media"]["video_url"]
    assert reel["audio"]["title"] == "Chill Sunset Beats"


def test_create_reel_unauthorized(client):
    payload = sample_reel_payload()
    response = client.post("/api/v1/reels", json=payload)
    assert response.status_code == 401


def test_get_reel_by_id(client, auth_headers):
    # Create reel first
    payload = sample_reel_payload()
    create_res = client.post("/api/v1/reels", json=payload, headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    # Public fetch
    get_res = client.get(f"/api/v1/reels/{reel_id}")
    assert get_res.status_code == 200
    assert get_res.json()["data"]["id"] == reel_id


def test_update_reel_owner(client, auth_headers):
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    update_payload = {"caption": "Updated Sunset caption with new vibe!"}
    update_res = client.put(f"/api/v1/reels/{reel_id}", json=update_payload, headers=auth_headers)
    assert update_res.status_code == 200
    assert update_res.json()["data"]["caption"] == update_payload["caption"]


def test_update_reel_non_owner_forbidden(client, auth_headers, other_auth_headers):
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    update_payload = {"caption": "Hacker change"}
    update_res = client.put(f"/api/v1/reels/{reel_id}", json=update_payload, headers=other_auth_headers)
    assert update_res.status_code == 403


def test_delete_reel_owner(client, auth_headers):
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    del_res = client.delete(f"/api/v1/reels/{reel_id}", headers=auth_headers)
    assert del_res.status_code == 200

    # Ensure deleted reel returns 404
    get_res = client.get(f"/api/v1/reels/{reel_id}")
    assert get_res.status_code == 404


def test_view_counter_increment(client, auth_headers):
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    client.post(f"/api/v1/reels/{reel_id}/view")
    client.post(f"/api/v1/reels/{reel_id}/view")

    get_res = client.get(f"/api/v1/reels/{reel_id}")
    assert get_res.json()["data"]["views_count"] == 2


def test_feed_pagination(client, auth_headers):
    # Create multiple reels
    for i in range(5):
        payload = sample_reel_payload()
        payload["caption"] = f"Reel number {i}"
        client.post("/api/v1/reels", json=payload, headers=auth_headers)

    # Fetch page 1 with page_size=3
    feed_res = client.get("/api/v1/feed?page=1&page_size=3&include_ads=false")
    assert feed_res.status_code == 200
    items = feed_res.json()["data"]
    assert len(items) == 3
    assert items[0]["type"] == "organic"
