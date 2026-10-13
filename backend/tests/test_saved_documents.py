from tests.conftest import sign_up
from tests.test_chat import EMPTY_PARTY, MESSAGES, VALUES

ACME = {**EMPTY_PARTY, "company": "Acme Inc."}
DOCUMENT = {"values": {**VALUES, "parties": [ACME, EMPTY_PARTY]}, "messages": MESSAGES}


def create(client, body=DOCUMENT):
    response = client.post("/api/documents", json=body)
    assert response.status_code == 201
    return response.json()["id"]


def test_documents_require_sign_in(client):
    assert client.get("/api/documents").status_code == 401
    assert client.post("/api/documents", json=DOCUMENT).status_code == 401
    assert client.get("/api/documents/1").status_code == 401
    assert client.put("/api/documents/1", json=DOCUMENT).status_code == 401


def test_new_user_has_no_documents(signed_in):
    assert signed_in.get("/api/documents").json() == []


def test_create_then_get_returns_values_and_messages(signed_in):
    document_id = create(signed_in)
    assert signed_in.get(f"/api/documents/{document_id}").json() == DOCUMENT


def test_list_summarizes_documents(signed_in):
    document_id = create(signed_in)
    [entry] = signed_in.get("/api/documents").json()
    assert entry["id"] == document_id
    assert entry["documentId"] == "pilot-agreement"
    assert entry["name"] == "Pilot Agreement"
    assert entry["companies"] == ["Acme Inc."]
    assert entry["updatedAt"].endswith("Z")


def test_update_replaces_document_and_moves_it_to_the_top(signed_in):
    first = create(signed_in)
    second = create(signed_in)
    updated = {
        "values": {**VALUES, "documentId": "mutual-nda", "terms": []},
        "messages": [*MESSAGES, {"role": "assistant", "content": "Switched to an NDA."}],
    }
    assert signed_in.put(f"/api/documents/{first}", json=updated).status_code == 204
    assert signed_in.get(f"/api/documents/{first}").json() == updated
    assert [d["id"] for d in signed_in.get("/api/documents").json()] == [first, second]


def test_document_must_have_a_supported_document_chosen(signed_in):
    for document_id in (None, "employment-contract"):
        body = {**DOCUMENT, "values": {**VALUES, "documentId": document_id}}
        assert signed_in.post("/api/documents", json=body).status_code == 422


def test_missing_document_is_404(signed_in):
    assert signed_in.get("/api/documents/99").status_code == 404
    assert signed_in.put("/api/documents/99", json=DOCUMENT).status_code == 404


def test_users_cannot_see_or_change_each_others_documents(signed_in):
    document_id = create(signed_in)
    signed_in.post("/api/auth/signout")
    sign_up(signed_in, email="bob@acme.test", name="Bob")
    assert signed_in.get("/api/documents").json() == []
    assert signed_in.get(f"/api/documents/{document_id}").status_code == 404
    assert signed_in.put(f"/api/documents/{document_id}", json=DOCUMENT).status_code == 404
