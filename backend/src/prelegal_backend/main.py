"""FastAPI application serving the API and the statically exported frontend."""

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from prelegal_backend.api import router
from prelegal_backend.db import reset_database

REPO_ROOT = Path(__file__).resolve().parents[3]


def create_app(db_path: Path, static_dir: Path) -> FastAPI:
    """Build the app: reset the database on startup, serve /api and the frontend."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        reset_database(db_path)
        yield

    app = FastAPI(title="Prelegal", lifespan=lifespan)
    app.state.db_path = db_path
    app.include_router(router)
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="frontend")
    return app


def app_from_env() -> FastAPI:
    """App factory for uvicorn (--factory), configured from environment variables."""
    return create_app(
        db_path=Path(os.environ.get("PRELEGAL_DB_PATH", "prelegal.db")),
        static_dir=Path(os.environ.get("PRELEGAL_STATIC_DIR", REPO_ROOT / "frontend" / "out")),
    )
