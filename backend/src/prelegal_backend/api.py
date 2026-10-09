"""JSON API routes, mounted under /api."""

from fastapi import APIRouter, Request

from prelegal_backend.chat import ChatReply, ChatRequest, chat
from prelegal_backend.db import connect

router = APIRouter(prefix="/api")


@router.get("/health")
def health(request: Request) -> dict[str, str]:
    """Report that the API is up and the database is reachable."""
    with connect(request.app.state.db_path) as conn:
        conn.execute("SELECT COUNT(*) FROM users").fetchone()
    return {"status": "ok"}


@router.post("/chat")
def post_chat(request: ChatRequest) -> ChatReply:
    """Return the assistant's reply and the updated NDA fields."""
    return chat(request)
