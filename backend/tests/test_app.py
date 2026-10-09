def test_startup_creates_database(client, db_path):
    assert db_path.exists()


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_serves_login_page_at_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "Login" in response.text


def test_serves_nda_page(client):
    response = client.get("/nda/")
    assert response.status_code == 200
    assert "NDA" in response.text


def test_nda_without_trailing_slash_redirects(client):
    response = client.get("/nda", follow_redirects=False)
    assert response.status_code in (307, 308)
    assert response.headers["location"].endswith("/nda/")


def test_unknown_path_serves_404_page(client):
    response = client.get("/missing")
    assert response.status_code == 404
    assert "Not found" in response.text


def test_unknown_api_path_is_json_404(client):
    response = client.get("/api/missing")
    assert response.status_code == 404
