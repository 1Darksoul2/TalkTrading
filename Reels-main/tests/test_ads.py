from datetime import datetime, timedelta, timezone
from tests.test_reels import sample_reel_payload


def sample_campaign_payload():
    now = datetime.now(timezone.utc)
    return {
        "name": "Summer Shoe Sale 2026",
        "start_date": (now - timedelta(days=1)).isoformat(),
        "end_date": (now + timedelta(days=30)).isoformat(),
        "budget": 500.0,
        "max_impressions": 1000,
        "creatives": [
            {
                "title": "Ultra Speed Running Shoes",
                "description": "50% off this weekend only!",
                "video_url": "https://storage.example.com/ads/shoes.mp4",
                "thumbnail_url": "https://storage.example.com/ads/shoes.jpg",
                "cta_text": "Shop Now",
                "cta_url": "https://shoestore.example.com/sale",
                "sponsor_name": "SpeedSneakers Inc."
            }
        ]
    }


def test_create_ad_campaign(client, auth_headers):
    payload = sample_campaign_payload()
    res = client.post("/api/v1/ads/campaigns", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()["data"]
    assert data["name"] == payload["name"]
    assert len(data["creatives"]) == 1
    assert data["creatives"][0]["sponsor_name"] == "SpeedSneakers Inc."


def test_ad_blended_into_feed(client, auth_headers):
    # 1. Create campaign with creative
    client.post("/api/v1/ads/campaigns", json=sample_campaign_payload(), headers=auth_headers)

    # 2. Create at least 4 reels (settings.AD_FREQUENCY_INTERVAL = 4)
    for i in range(5):
        reel_data = sample_reel_payload()
        reel_data["caption"] = f"Ad test organic reel {i}"
        client.post("/api/v1/reels", json=reel_data, headers=auth_headers)

    # 3. Request feed
    res = client.get("/api/v1/feed?page=1&page_size=10&include_ads=true")
    assert res.status_code == 200
    items = res.json()["data"]
    
    # Check that at least one ad item exists
    ad_items = [it for it in items if it["type"] == "ad"]
    assert len(ad_items) >= 1
    assert ad_items[0]["ad"]["sponsor_name"] == "SpeedSneakers Inc."


def test_impression_and_click_tracking_analytics(client, auth_headers):
    camp_res = client.post("/api/v1/ads/campaigns", json=sample_campaign_payload(), headers=auth_headers)
    camp_data = camp_res.json()["data"]
    campaign_id = camp_data["id"]
    creative_id = camp_data["creatives"][0]["id"]

    # Record 2 impressions
    imp_res1 = client.post("/api/v1/ads/track/impression", json={"creative_id": creative_id})
    assert imp_res1.status_code == 200
    imp_res2 = client.post("/api/v1/ads/track/impression", json={"creative_id": creative_id})
    assert imp_res2.status_code == 200

    # Record 1 click
    click_res = client.post("/api/v1/ads/track/click", json={"creative_id": creative_id})
    assert click_res.status_code == 200

    # Verify analytics: 2 impressions, 1 click -> CTR = 50.0%
    analytics_res = client.get(f"/api/v1/ads/campaigns/{campaign_id}/analytics", headers=auth_headers)
    assert analytics_res.status_code == 200
    stats = analytics_res.json()["data"]
    assert stats["total_impressions"] == 2
    assert stats["total_clicks"] == 1
    assert stats["ctr_percentage"] == 50.0
