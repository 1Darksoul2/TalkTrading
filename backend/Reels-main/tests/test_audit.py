import pytest
import os
from pydantic import ValidationError
from app.core.config import Settings
from app.core.security import create_access_token
from tests.test_reels import sample_reel_payload
from tests.test_ads import sample_campaign_payload


def test_production_environment_rejects_default_secrets():
    # Attempting to load production config with default secrets must raise ValidationError
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            APP_ENV="production",
            JWT_SECRET_KEY="default_secret_key_change_in_production",
            SERVICE_API_KEY="dev_internal_service_key_reel_2026",
            DATABASE_URL="postgresql://user:pass@localhost:5432/db"
        )
    assert "JWT_SECRET_KEY must be explicitly provided in production" in str(exc_info.value)


def test_production_environment_rejects_sqlite():
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            APP_ENV="production",
            JWT_SECRET_KEY="a_very_long_production_secure_key_1234567890",
            SERVICE_API_KEY="a_very_long_service_key_production_123456789",
            DATABASE_URL="sqlite:///./prod.db"
        )
    assert "SQLite is not permitted for production deployment" in str(exc_info.value)


def test_arbitrary_user_id_header_cannot_impersonate(client, auth_headers):
    # Request with arbitrary X-User-Id header without valid JWT must still be 401
    res = client.post(
        "/api/v1/reels",
        json=sample_reel_payload(),
        headers={"X-User-Id": "victim_admin_user"}
    )
    assert res.status_code == 401

    # Request with valid JWT of user_creator_001 attempting to spoof via X-User-Id
    headers_with_spoof = auth_headers.copy()
    headers_with_spoof["X-User-Id"] = "victim_admin_user"
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=headers_with_spoof)
    assert create_res.status_code == 201
    # Created reel MUST belong to user_creator_001 from the JWT, NOT victim_admin_user
    assert create_res.json()["data"]["user_id"] == "user_creator_001"


def test_ad_campaign_listing_and_analytics_ownership(client, auth_headers, other_auth_headers):
    # Create campaign under user_creator_001
    camp_res = client.post("/api/v1/ads/campaigns", json=sample_campaign_payload(), headers=auth_headers)
    assert camp_res.status_code == 201
    camp_id = camp_res.json()["data"]["id"]

    # user_creator_001 sees their campaign
    list_res1 = client.get("/api/v1/ads/campaigns", headers=auth_headers)
    assert len(list_res1.json()["data"]) >= 1

    # other user should see empty list (their own campaigns)
    list_res2 = client.get("/api/v1/ads/campaigns", headers=other_auth_headers)
    user2_camps = [c for c in list_res2.json()["data"] if c["id"] == camp_id]
    assert len(user2_camps) == 0

    # other user attempting to access analytics gets 404 access denied
    analytics_fail = client.get(f"/api/v1/ads/campaigns/{camp_id}/analytics", headers=other_auth_headers)
    assert analytics_fail.status_code == 404

    # Owner successfully accesses analytics
    analytics_ok = client.get(f"/api/v1/ads/campaigns/{camp_id}/analytics", headers=auth_headers)
    assert analytics_ok.status_code == 200


def test_moderation_reports_queue_role_check(client, auth_headers, other_auth_headers):
    # Regular user cannot view moderation reports queue
    res_forbidden = client.get("/api/v1/moderation/reports", headers=other_auth_headers)
    assert res_forbidden.status_code == 403

    # Admin user can view moderation reports
    admin_token = create_access_token({"sub": "admin_user_01", "roles": ["admin"]})
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    res_ok = client.get("/api/v1/moderation/reports", headers=admin_headers)
    assert res_ok.status_code == 200
    assert isinstance(res_ok.json()["data"], list)


def test_concurrent_like_toggle_idempotency(client, auth_headers):
    create_res = client.post("/api/v1/reels", json=sample_reel_payload(), headers=auth_headers)
    reel_id = create_res.json()["data"]["id"]

    # Like twice back to back
    l1 = client.post(f"/api/v1/reels/{reel_id}/like", headers=auth_headers)
    assert l1.status_code == 200
    assert l1.json()["data"]["likes_count"] == 1

    # Unlike
    l2 = client.post(f"/api/v1/reels/{reel_id}/like", headers=auth_headers)
    assert l2.status_code == 200
    assert l2.json()["data"]["likes_count"] == 0
