"""ORM models. Importing this package registers every table on `Base.metadata`."""

from apps.api.app.db.models.identity import (
    FacilityLocation,
    Programme,
    RecyclerFacility,
    User,
    UserRoleAssignment,
)
from apps.api.app.db.models.operations import AuditEvent, IdempotencyRecord
from apps.api.app.db.models.records import (
    Evidence,
    QrLookupToken,
    RecoveryRecord,
    RecoveryRecordEvent,
)
from apps.api.app.db.models.workflow import (
    Handoff,
    ProcessingRecord,
    RecoveredMaterialEntry,
    ReviewCase,
    ReviewDecision,
)

# Tables whose rows are history: the initial migration installs triggers that reject UPDATE
# and/or DELETE so audit and evidence history can never be silently rewritten or cascaded away.
APPEND_ONLY_TABLES = ("audit_events", "recovery_record_events", "review_decisions", "handoffs")
UNDELETABLE_TABLES = ("evidence", "recovery_records")

__all__ = [
    "APPEND_ONLY_TABLES",
    "UNDELETABLE_TABLES",
    "AuditEvent",
    "Evidence",
    "FacilityLocation",
    "Handoff",
    "IdempotencyRecord",
    "ProcessingRecord",
    "Programme",
    "QrLookupToken",
    "RecoveredMaterialEntry",
    "RecoveryRecord",
    "RecoveryRecordEvent",
    "RecyclerFacility",
    "ReviewCase",
    "ReviewDecision",
    "User",
    "UserRoleAssignment",
]
