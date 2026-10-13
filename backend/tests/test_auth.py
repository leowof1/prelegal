from prelegal_backend.auth import SESSION_COOKIE, hash_password, verify_password
from prelegal_backend.db import connect
from tests.conftest import sign_up

CREDENTIALS = {"email": "ada@acme.test", "password": "correct horse"}


def test_password_hash_round_trips_and_is_salted():
    stored = hash_password("correct horse")
    assert verify_password("correct horse", stored)
    assert not verify_password("wrong horse", stored)
    assert hash_password("correct horse") != stored


def test_signup_returns_user_and_signs_in(client):
    user = sign_up(client, email=" Ada@Acme.TEST ")
    assert user == {"id": 1, "name": "Ada Lovelace", "email": "ada@acme.test"}
    assert client.get("/api/auth/me").json() == user


def test_signup_sets_httponly_lax_cookie(client):
    response = client.post("/api/auth/signup", json={"name": "Ada", **CREDENTIALS})
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE}=")
    assert "HttpOnly" in cookie and "SameSite=lax" in cookie


def test_signup_stores_a_hash_not_the_password(client, db_path):
    sign_up(client)
    with connect(db_path) as conn:
        [stored] = conn.execute("SELECT password_hash FROM users").fetchone()
    assert "correct horse" not in stored
    assert verify_password("correct horse", stored)


def test_signup_rejects_duplicate_email(client):
    sign_up(client)
    response = client.post("/api/auth/signup", json={"name": "Other", **{**CREDENTIALS, "email": "ADA@acme.test"}})
    assert response.status_code == 409
    assert response.json()["detail"] == "An account with this email already exists"


def test_signup_validates_input(client):
    for body in (
        {"name": "Ada", "email": "ada@acme.test", "password": "short"},
        {"name": "Ada", "email": "not-an-email", "password": "correct horse"},
        {"name": " ", "email": "ada@acme.test", "password": "correct horse"},
    ):
        assert client.post("/api/auth/signup", json=body).status_code == 422


def test_signin_with_correct_password(client):
    user = sign_up(client)
    client.post("/api/auth/signout")
    response = client.post("/api/auth/signin", json=CREDENTIALS)
    assert response.status_code == 200
    assert response.json() == user
    assert client.get("/api/auth/me").status_code == 200


def test_signin_rejects_wrong_password_and_unknown_email(client):
    sign_up(client)
    client.post("/api/auth/signout")
    for body in ({**CREDENTIALS, "password": "wrong horse"}, {**CREDENTIALS, "email": "bob@acme.test"}):
        response = client.post("/api/auth/signin", json=body)
        assert response.status_code == 401
        assert response.json()["detail"] == "Incorrect email or password"
    assert client.get("/api/auth/me").json() is None


def test_me_is_null_when_signed_out(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json() is None


def test_signout_ends_the_session(client):
    sign_up(client)
    token = client.cookies[SESSION_COOKIE]
    assert client.post("/api/auth/signout").status_code == 204
    assert client.get("/api/auth/me").json() is None
    client.cookies.set(SESSION_COOKIE, token)
    assert client.get("/api/auth/me").json() is None
