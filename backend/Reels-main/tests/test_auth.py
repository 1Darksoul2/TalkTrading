from datetime import timedelta
from app.core.security import create_access_token


def test_expired_jwt_rejected(client):
    # Create expired token
    expired_token = create_access_token(
        data={"sub": "user_expired"},
        expires_delta=timedelta(seconds=-10)
    )
    headers = {"Authorization": f"Bearer {expired_token}"}
    res = client.post("/api/v1/reels", json={}, headers=headers)
    assert res.status_code == 401
    assert "missing, expired, or invalid" in res.json()["message"]


def test_invalid_signature_rejected(client):
    headers = {"Authorization": "Bearer invalid.jwt.signature_here"}
    res = client.post("/api/v1/reels", json={}, headers=headers)
    assert res.status_code == 401


def test_service_to_service_auth_success(client, service_headers):
    # Action endpoint requires X-Service-API-Key
    res = client.post(
        "/api/v1/moderation/reels/non_existent/action",
        json={"action": "takedown", "new_reel_status": "restricted"},
        headers=service_headers
    )
    # Passed S2S auth, reaching 404 for missing reel
    assert res.status_code == 404


def test_service_to_service_auth_failure(client):
    res = client.post(
        "/api/v1/moderation/reels/non_existent/action",
        json={"action": "takedown", "new_reel_status": "restricted"},
        headers={"X-Service-API-Key": "wrong_key"}
    )
    assert res.status_code == 403
