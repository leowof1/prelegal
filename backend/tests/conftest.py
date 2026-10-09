import pytest
from fastapi.testclient import TestClient

from prelegal_backend.main import create_app


@pytest.fixture
def static_dir(tmp_path):
    """A minimal statically exported frontend: a login page and an NDA page."""
    site = tmp_path / "out"
    (site / "nda").mkdir(parents=True)
    (site / "index.html").write_text("<h1>Login</h1>")
    (site / "nda" / "index.html").write_text("<h1>NDA</h1>")
    (site / "404.html").write_text("<h1>Not found</h1>")
    return site


@pytest.fixture
def db_path(tmp_path):
    return tmp_path / "prelegal.db"


@pytest.fixture
def client(db_path, static_dir):
    with TestClient(create_app(db_path=db_path, static_dir=static_dir)) as client:
        yield client
