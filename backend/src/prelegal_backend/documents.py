"""The supported legal documents, loaded from the repository's documents.json."""

import json
from pathlib import Path
from typing import Literal

DOCUMENTS_FILE = Path(__file__).resolve().parents[3] / "documents.json"

DOCUMENTS: dict[str, dict] = {doc["id"]: doc for doc in json.loads(DOCUMENTS_FILE.read_text())}

DocumentId = Literal[tuple(DOCUMENTS)]


def describe(doc: dict) -> str:
    """A document's id, name, description, party roles and term keys, for the system prompt."""
    terms = "\n".join(f"  - {t['key']} ({t['label']}): {t['hint']}" for t in doc["terms"])
    return (
        f"{doc['id']}: {doc['name']}. {doc['description']}\n"
        f"  Parties, in order: {' and '.join(doc['roles'])}. Terms:\n{terms}"
    )


def catalog_prompt() -> str:
    """All supported documents, described for the system prompt."""
    return "\n\n".join(describe(doc) for doc in DOCUMENTS.values())
