"""AI chat that fills in the Mutual NDA fields."""

from datetime import date
from typing import Literal

from litellm import completion
from pydantic import BaseModel, Field

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}

SYSTEM_PROMPT = """You help the user draft a Common Paper Mutual Non-Disclosure Agreement through a friendly conversation.

The fields are: purpose, effective date, MNDA term (expires after a number of years, or continues until terminated), \
term of confidentiality (a number of years, or perpetual), governing law (a state), jurisdiction (courts location), \
modifications to the standard terms, and for each of the two parties: name of the signer, title, company and notice address.

Rules:
- Ask about one or two related fields at a time. Keep replies short.
- The current values are given below. Treat them as defaults: offer to confirm or change them.
- Always return all fields in "values". Change only what the user has told you; keep everything else exactly as it is.
- Never invent party details. Leave a field empty until the user provides it.
- Dates are YYYY-MM-DD. Years are whole numbers from 1 to 100.
- When every field is filled, tell the user the NDA is ready to download as a PDF.
- If asked for another kind of document, say only the Mutual NDA is available for now."""


class Party(BaseModel):
    name: str = Field(description="Full name of the person signing for this party, not the company")
    title: str = Field(description="Job title of the signer")
    company: str = Field(description="Legal name of the company or organization")
    noticeAddress: str = Field(description="Email or postal address for legal notices")


class MndaTerm(BaseModel):
    kind: Literal["expires", "untilTerminated"]
    years: int | None


class ConfidentialityTerm(BaseModel):
    kind: Literal["years", "perpetual"]
    years: int | None


class NdaFields(BaseModel):
    """The NDA form values, in the same camelCase shape as the frontend's NdaValues."""

    purpose: str
    effectiveDate: str
    mndaTerm: MndaTerm
    confidentialityTerm: ConfidentialityTerm
    governingLaw: str
    jurisdiction: str
    modifications: str
    parties: tuple[Party, Party]


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    values: NdaFields


class ChatReply(BaseModel):
    reply: str
    values: NdaFields


def chat(request: ChatRequest) -> ChatReply:
    """Run one chat turn: the model replies and returns the updated NDA fields."""
    context = f"Today is {date.today().isoformat()}.\nCurrent values:\n{request.values.model_dump_json()}"
    messages = [
        {"role": "system", "content": f"{SYSTEM_PROMPT}\n\n{context}"},
        *(m.model_dump() for m in request.messages),
    ]
    response = completion(
        model=MODEL,
        messages=messages,
        response_format=ChatReply,
        reasoning_effort="low",
        extra_body=EXTRA_BODY,
    )
    return ChatReply.model_validate_json(response.choices[0].message.content)
