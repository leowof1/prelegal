import json
from typing import get_args

from prelegal_backend.documents import DOCUMENTS, DOCUMENTS_FILE, DocumentId, catalog_prompt

REPO_ROOT = DOCUMENTS_FILE.parent
CATALOG_FILES = {t["filename"] for t in json.loads((REPO_ROOT / "catalog.json").read_text())["templates"]}


def test_every_catalog_template_is_a_document():
    files = {f"templates/{doc['file']}" for doc in DOCUMENTS.values()}
    # The NDA cover page is generated, so its template is the only one not listed.
    assert CATALOG_FILES - files == {"templates/Mutual-NDA-coverpage.md"}
    assert files <= CATALOG_FILES


def test_documents_are_well_formed():
    for doc in DOCUMENTS.values():
        assert (REPO_ROOT / "templates" / doc["file"]).is_file()
        assert len(doc["roles"]) == 2
        assert 3 <= len(doc["terms"]) <= 6
        keys = [t["key"] for t in doc["terms"]]
        assert len(keys) == len(set(keys))
        assert all(t["label"] and t["hint"] for t in doc["terms"])


def test_document_id_lists_every_document():
    assert set(get_args(DocumentId)) == set(DOCUMENTS)


def test_catalog_prompt_describes_every_document_and_its_fields():
    prompt = catalog_prompt()
    assert all(f"{doc_id}: {doc['name']}." in prompt for doc_id, doc in DOCUMENTS.items())
    assert "Parties, in order: Provider and Customer. Terms:\n  - pilotPeriod (Pilot Period):" in prompt
