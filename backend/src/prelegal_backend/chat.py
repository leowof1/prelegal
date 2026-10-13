"""AI chat that picks a supported legal document and fills in its fields."""

from datetime import date
from typing import Literal

from litellm import completion
from pydantic import BaseModel, Field

from prelegal_backend.documents import DocumentId, catalog_prompt

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You help the user draft a Common Paper legal agreement through a friendly conversation.

These are the only documents you can draft, with their parties and term keys:
{catalog}

Rules:
- If no document is chosen yet (documentId is null), find out what the user needs and pick the matching document. \
Set documentId once the user has clearly chosen one, \
and in that same reply return its terms, filled with anything the user already said.
- If the user asks for a document that is not in the list, say plainly that you can't generate it, \
suggest the closest document from the list and explain why it is the closest. \
Keep documentId unchanged until the user agrees.
- If the user switches to another document, keep the parties, the effective date and any value the user gave \
that the new document also has (e.g. governing law).
- Refer to documents by name, never by id.
- Guide the user through the fields: ask about one or two related fields at a time. Keep replies short.
- The current values are given below. Treat them as defaults: offer to confirm or change them.
- Always return all values. "terms" must contain exactly one entry for each term key of the chosen document \
(empty list if none is chosen). Change only what the user has told you; keep everything else exactly as it is.
- Fill in every value the user states, in the same turn, even if you did not ask for it yet.
- Never invent values: a field stays an empty string until the user provides or confirms it. \
The hints are examples to offer the user, not values to fill in. Never write placeholders like [state].
- Dates are YYYY-MM-DD.
- When every field is filled, tell the user the document is ready to download as a PDF."""


class Party(BaseModel):
    name: str = Field(description="Full name of the person signing for this party, not the company")
    title: str = Field(description="Job title of the signer")
    company: str = Field(description="Legal name of the company or organization")
    noticeAddress: str = Field(description="Email or postal address for legal notices")


class Term(BaseModel):
    key: str = Field(description="Term key of the chosen document, e.g. governingLaw")
    value: str


class DocumentValues(BaseModel):
    """The document values, in the same camelCase shape as the frontend's DocumentValues."""

    documentId: DocumentId | None
    effectiveDate: str
    terms: list[Term]
    parties: tuple[Party, Party]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    values: DocumentValues


class ChatReply(BaseModel):
    reply: str
    values: DocumentValues


def system_prompt(values: DocumentValues) -> str:
    """The rules, the catalog and the current values."""
    return (
        f"{SYSTEM_PROMPT.format(catalog=catalog_prompt())}\n\n"
        f"Today is {date.today().isoformat()}.\nCurrent values:\n{values.model_dump_json()}"
    )


def chat(request: ChatRequest) -> ChatReply:
    """Run one chat turn: the model replies and returns the updated document values."""
    messages = [
        {"role": "system", "content": system_prompt(request.values)},
        *(m.model_dump() for m in request.messages),
    ]
    response = completion(
        model=MODEL,
        messages=messages,
        response_format=ChatReply,
        reasoning_effort="low",
        # LiteLLM checks reasoning support against a model map it downloads at import;
        # allow the parameter explicitly so a change to that map cannot break the call.
        allowed_openai_params=["reasoning_effort"],
        extra_body=EXTRA_BODY,
    )
    return ChatReply.model_validate_json(response.choices[0].message.content)
