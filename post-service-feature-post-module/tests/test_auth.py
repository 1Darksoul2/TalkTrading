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
