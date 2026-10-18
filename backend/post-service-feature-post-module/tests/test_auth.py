NEW_USER = {"username": "alex", "email": "alex@example.com", "password": "password123"}


def _register(client, **overrides):
    return client.post("/auth/register", json={**NEW_USER, **overrides})


def _login(client, email, password="password123"):
    return client.post("/auth/login", data={"username": email, "password": password})


def test_register_then_login_returns_token_and_profile(client):
    created = _register(client)
    assert created.status_code == 200
    assert created.json()["username"] == "alex"

    login = _login(client, "alex@example.com")
    assert login.status_code == 200
    body = login.json()
    assert body["access_token"]
    assert body["user"] == {
        "id": created.json()["id"],
        "username": "alex",
        "email": "alex@example.com",
    }


def test_duplicate_email_is_a_clear_409_not_a_500(client):
    assert _register(client).status_code == 200
    dup = _register(client, username="someone_else")
    assert dup.status_code == 409
    assert "email" in dup.json()["detail"].lower()


def test_duplicate_email_ignores_letter_case(client):
    assert _register(client).status_code == 200
    dup = _register(client, username="someone_else", email="ALEX@Example.com")
    assert dup.status_code == 409


def test_duplicate_username_is_a_clear_409(client):
    assert _register(client).status_code == 200
    dup = _register(client, email="other@example.com")
    assert dup.status_code == 409
    assert "username" in dup.json()["detail"].lower()


def test_login_email_is_case_insensitive(client):
    _register(client)
    assert _login(client, "Alex@Example.COM").status_code == 200
    assert _login(client, "  alex@example.com  ").status_code == 200


def test_wrong_password_and_unknown_user_share_one_generic_401(client):
    _register(client)
    wrong_pw = _login(client, "alex@example.com", "nope")
    unknown = _login(client, "ghost@example.com")
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json() == unknown.json()


def test_login_with_username_instead_of_email(client):
    assert _register(client).status_code == 200
    login = _login(client, "Alex")
    assert login.status_code == 200
    assert login.json()["user"]["email"] == "alex@example.com"


def test_wrong_password_is_rejected_for_username_login(client):
    assert _register(client).status_code == 200
    assert _login(client, "alex", "wrong-password").status_code == 401


def test_register_keeps_the_full_name_as_display_name(client):
    assert _register(client, display_name="Alex Mercer").status_code == 200
    token = _login(client, "alex@example.com").json()["access_token"]
    me = client.get("/api/v1/users/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["display_name"] == "Alex Mercer"


def _reset_token(caplog, client, email="alex@example.com"):
    with caplog.at_level("WARNING", logger="app.services.password_reset_service"):
        assert client.post("/auth/password-reset", json={"email": email}).status_code == 202
    links = [r.getMessage() for r in caplog.records if "reset-password?token=" in r.getMessage()]
    return links[-1].split("token=")[1] if links else None


def test_password_reset_changes_the_password_once(client, caplog):
    assert _register(client).status_code == 200
    token = _reset_token(caplog, client)
    assert token

    done = client.post("/auth/password-reset/confirm", json={"token": token, "new_password": "brand-new-pass"})
    assert done.status_code == 200
    assert _login(client, "alex@example.com", "brand-new-pass").status_code == 200
    assert _login(client, "alex@example.com").status_code == 401

    # The link works only once.
    again = client.post("/auth/password-reset/confirm", json={"token": token, "new_password": "another-pass-1"})
    assert again.status_code == 400


def test_password_reset_for_unknown_email_looks_the_same(client, caplog):
    assert _reset_token(caplog, client, "nobody@example.com") is None


def test_password_reset_rejects_a_made_up_token(client):
    res = client.post("/auth/password-reset/confirm", json={"token": "x" * 40, "new_password": "brand-new-pass"})
    assert res.status_code == 400
