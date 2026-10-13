"""Each user's saved documents: the document values plus the chat that produced them."""

import json

from fastapi import APIRouter, HTTPException, Request, status
from pydantic import BaseModel

from prelegal_backend.auth import CurrentUser
from prelegal_backend.chat import ChatMessage, DocumentValues
from prelegal_backend.db import NOW, connect
from prelegal_backend.documents import DOCUMENTS, DocumentId

router = APIRouter(prefix="/api/documents")


class SavedValues(DocumentValues):
    """Document values with a document chosen; only those are saved."""

    documentId: DocumentId


class SavedDocument(BaseModel):
    values: SavedValues
    messages: list[ChatMessage]

    def columns(self) -> tuple[str, str, str]:
        """The document_id, values_json and messages_json columns."""
        messages = json.dumps([m.model_dump() for m in self.messages])
        return self.values.documentId, self.values.model_dump_json(), messages


class SavedDocumentSummary(BaseModel):
    id: int
    documentId: str
    name: str
    companies: list[str]
    updatedAt: str


class Created(BaseModel):
    id: int


def summary(row: tuple) -> SavedDocumentSummary:
    """A list entry from an (id, document_id, values_json, updated_at) row."""
    saved_id, catalog_id, values_json, updated_at = row
    parties = json.loads(values_json)["parties"]
    return SavedDocumentSummary(
        id=saved_id,
        documentId=catalog_id,
        name=DOCUMENTS[catalog_id]["name"],
        companies=[p["company"] for p in parties if p["company"]],
        updatedAt=updated_at,
    )


@router.get("")
def list_documents(request: Request, user: CurrentUser) -> list[SavedDocumentSummary]:
    """The user's documents, most recently updated first."""
    with connect(request.app.state.db_path) as conn:
        rows = conn.execute(
            "SELECT id, document_id, values_json, updated_at FROM documents WHERE user_id = ? "
            "ORDER BY updated_at DESC, id DESC",
            (user.id,),
        ).fetchall()
    return [summary(row) for row in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_document(body: SavedDocument, request: Request, user: CurrentUser) -> Created:
    """Save a new document for the user."""
    with connect(request.app.state.db_path) as conn:
        cursor = conn.execute(
            "INSERT INTO documents (user_id, document_id, values_json, messages_json) VALUES (?, ?, ?, ?)",
            (user.id, *body.columns()),
        )
    return Created(id=cursor.lastrowid)


@router.get("/{document_id}")
def get_document(document_id: int, request: Request, user: CurrentUser) -> SavedDocument:
    """One of the user's documents; 404 if it does not exist or belongs to someone else."""
    with connect(request.app.state.db_path) as conn:
        row = conn.execute(
            "SELECT values_json, messages_json FROM documents WHERE id = ? AND user_id = ?",
            (document_id, user.id),
        ).fetchone()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    return SavedDocument(values=json.loads(row[0]), messages=json.loads(row[1]))


@router.put("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def update_document(document_id: int, body: SavedDocument, request: Request, user: CurrentUser) -> None:
    """Replace one of the user's documents with its latest values and chat."""
    with connect(request.app.state.db_path) as conn:
        cursor = conn.execute(
            "UPDATE documents SET document_id = ?, values_json = ?, messages_json = ?, "
            f"updated_at = {NOW} WHERE id = ? AND user_id = ?",
            (*body.columns(), document_id, user.id),
        )
    if cursor.rowcount == 0:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
