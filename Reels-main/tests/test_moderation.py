from tests.test_reels import sample_reel_payload
from app.core.rate_limit import rate_limiter


def test_report_reel_flow(client, auth_headers):
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    report_payload = {
        "reason": "spam",
        "description": "Repetitive promotional content violating terms."
    }
    report_res = client.post(
        f"/api/v1/moderation/reels/{reel_id}/report",
        json=report_payload,
        headers=auth_headers
    )
    assert report_res.status_code == 201
    assert report_res.json()["data"]["status"] == "pending"


def test_s2s_moderation_action(client, auth_headers, service_headers):
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    # Admin/S2S marks reel as restricted
    action_res = client.post(
        f"/api/v1/moderation/reels/{reel_id}/action",
        json={"action": "restrict_reel", "reason": "Age restriction", "new_reel_status": "restricted"},
        headers=service_headers
    )
    assert action_res.status_code == 200
    assert action_res.json()["data"]["status"] == "restricted"


def test_rate_limiting_enforcement(client):
    # Temporarily set rate limiter threshold to 3 requests
    orig_limit = rate_limiter.limit
    rate_limiter.limit = 3
    rate_limiter.requests.clear()

    try:
        # First 3 succeed
        for _ in range(3):
            res = client.get("/api/v1/health")
            assert res.status_code == 200

        # 4th request triggers 429
        blocked = client.get("/api/v1/health")
        assert blocked.status_code == 429
        assert "Rate limit exceeded" in blocked.json()["message"]
    finally:
        rate_limiter.limit = orig_limit
        rate_limiter.requests.clear()
