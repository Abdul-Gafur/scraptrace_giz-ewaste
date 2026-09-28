"""Transport-only request and response models.

These describe HTTP shapes that `packages/contracts` does not define (authentication and
reference data). They never redefine a contract type; routes that carry contract objects use
the committed JSON Schemas directly. Each gap is listed in `docs/contract-gaps.md`.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")

RoleName = Literal[
    "collector",
    "recycler",
    "programme_reviewer",
    "programme_manager",
    "safety_content_administrator",
    "data_ml_reviewer",
]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ResponseMeta(Strict):
    correlation_id: str
    timestamp: str


class Envelope(Strict, Generic[T]):
    """`serviceSuccessSchema` from `packages/contracts/src/common/errors.ts`."""

    success: Literal[True]
    contract_version: Literal["1.0.0"]
    data: T
    meta: ResponseMeta


class SignInRequest(Strict):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=256)


class ActorReferenceModel(Strict):
    """The contract `ActorReference`. Absent scope fields are omitted from responses, so the
    object can be copied into contract requests unchanged."""

    actor_id: uuid.UUID
    programme_id: uuid.UUID | None = Field(default=None, json_schema_extra={"type": "string"})
    facility_id: uuid.UUID | None = Field(default=None, json_schema_extra={"type": "string"})


class CurrentUser(Strict):
    user_id: uuid.UUID
    username: str
    display_name: str
    role: RoleName
    permissions: list[str] = Field(description="Contract permissions held by the role.")
    programme_ids: list[uuid.UUID]
    facility_ids: list[uuid.UUID]
    receiving_location_ids: list[uuid.UUID] = Field(
        description="Receiving locations the user may record handoffs at (recyclers only)."
    )
    preferred_language: Literal["en", "fr", "ar", "pt"]
    actor_reference: ActorReferenceModel


class IssuedSession(Strict):
    access_token: str = Field(
        description=(
            "Bearer token for non-browser clients. Browsers should rely on the HttpOnly session "
            "cookie set on the same response and must not persist this value."
        )
    )
    token_type: Literal["Bearer"]
    expires_at: str
    user: CurrentUser


class DemoAccount(Strict):
    username: str
    display_name: str
    role: RoleName


class ProgrammeView(Strict):
    programme_id: uuid.UUID
    name: str
    currency: str
    country_code: str
    weight_discrepancy_threshold_percentage: float


class ReceivingLocationView(Strict):
    location_id: uuid.UUID
    facility_id: uuid.UUID
    name: str
    facility_type: Literal["scrapyard", "collection_centre", "recycler"]
    verification_status: Literal["unverified", "programme_verified", "expired", "suspended"]
    verification_date: date | None
    accepted_categories: list[str]
