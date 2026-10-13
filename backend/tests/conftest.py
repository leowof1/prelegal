import pytest
from fastapi.testclient import TestClient

from prelegal_backend.main import create_app


@pytest.fixture
def static_dir(tmp_path):
    """A minimal statically exported frontend: a login page and a document creator page."""
    site = tmp_path / "out"
    (site / "create").mkdir(parents=True)
    (site / "index.html").write_text("<h1>Login</h1>")
    (site / "create" / "index.html").write_text("<h1>Create</h1>")
    (site / "404.html").write_text("<h1>Not found</h1>")
    return site


@pytest.fixture
def db_path(tmp_path):
    return tmp_path / "prelegal.db"


@pytest.fixture
def client(db_path, static_dir):
    with TestClient(create_app(db_path=db_path, static_dir=static_dir)) as client:
        yield client


def sign_up(client, email="ada@acme.test", name="Ada Lovelace", password="correct horse"):
    """Register an account through the API; the client keeps its session cookie."""
    response = client.post("/api/auth/signup", json={"name": name, "email": email, "password": password})
    assert response.status_code == 201
    return response.json()


@pytest.fixture
def signed_in(client):
    """A client signed in as a freshly registered user."""
    sign_up(client)
    return client
