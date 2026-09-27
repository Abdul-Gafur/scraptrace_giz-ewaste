"""Maps persisted rows onto the shared contract types.

These functions are the only place a database row becomes a wire object. They produce the
exact `RecoveryRecord`, `Evidence` and `RecoveryRecordEvent` shapes, and apply field-level
shaping for the caller's audience before anything leaves the service.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Any

from apps.api.app.db.models import (
    Evidence,
    Handoff,
    ProcessingRecord,
    RecoveryRecord,
    RecoveryRecordEvent,
    ReviewCase,
)
from apps.api.app.domain.time import format_timestamp
from apps.api.app.domain.vocabulary import CONTRACT_SCHEMA_VERSION


@dataclass(frozen=True)
class RecordAudience:
    """Field-level shaping for one caller.

    `personal_data`: consented capture coordinates are returned only to roles holding the
    contract permission `personal_data:view` (and to the owning collector).
    `reviewer_notes`: reviewer notes and the evidence a reviewer considered are Restricted and
    returned only to review roles; others still see the decision and any requested correction.
    """

    personal_data: bool
    reviewer_notes: bool


FULL_AUDIENCE = RecordAudience(personal_data=True, reviewer_notes=True)


def actor_reference(
    actor_id: uuid.UUID, programme_id: uuid.UUID | None = None, facility_id: uuid.UUID | None = None
) -> dict[str, str]:
    reference = {"actor_id": str(actor_id)}
    if programme_id is not None:
        reference["programme_id"] = str(programme_id)
    if facility_id is not None:
        reference["facility_id"] = str(facility_id)
    return reference


def weight(value: float, unit: str) -> dict[str, Any]:
    return {"value": value, "unit": unit}


def qr_payload(record_id: uuid.UUID, lookup_token: str) -> dict[str, str]:
    return {
        "contract_version": CONTRACT_SCHEMA_VERSION,
        "record_id": str(record_id),
        "lookup_token": lookup_token,
    }


def handoff_information(handoff: Handoff) -> dict[str, Any]:
    return {
        "recycler": actor_reference(
            handoff.recycler_id, handoff.recycler_programme_id, handoff.recycler_facility_id
        ),
        "receiving_location_id": str(handoff.receiving_location_id),
        "confirmed_category": handoff.confirmed_category,
        "confirmed_condition": handoff.confirmed_condition,
        "measured_weight": weight(handoff.measured_weight_value, handoff.measured_weight_unit),
        "final_price": {
            "amount": handoff.final_price_amount,
            "currency": handoff.final_price_currency,
        },
        "handed_off_at": format_timestamp(handoff.handed_off_at),
        "server_received_at": format_timestamp(handoff.server_received_at),
        "evidence_ids": list(handoff.evidence_ids),
    }


def processing_information(processing: ProcessingRecord) -> dict[str, Any]:
    if processing.processing_method is None or processing.result is None:
        raise ValueError("Only submitted processing has a contract representation.")
    if processing.processed_at is None:
        raise ValueError("Submitted processing requires a processing time.")
    return {
        "recycler": actor_reference(
            processing.recycler_id, processing.recycler_programme_id, processing.facility_id
        ),
        "method": processing.processing_method,
        "result": processing.result,
        "material_entries": [
            {"material": entry.material, "weight": weight(entry.weight_value, entry.weight_unit)}
            for entry in processing.material_entries
        ],
        "processed_at": format_timestamp(processing.processed_at),
        "evidence_ids": list(processing.evidence_ids),
    }


def review_information(case: ReviewCase | None, audience: RecordAudience) -> dict[str, Any]:
    if case is None:
        return {"review_state": "not_required", "flag_codes": [], "evidence_considered": []}
    review: dict[str, Any] = {
        "review_state": case.status,
        "flag_codes": list(case.flag_codes),
        "evidence_considered": [],
    }
    if case.assigned_reviewer_id is not None:
        review["assigned_reviewer"] = actor_reference(case.assigned_reviewer_id, case.programme_id)
    if case.decisions:
        latest = case.decisions[-1]
        review["assigned_reviewer"] = actor_reference(
            latest.reviewer_id, latest.reviewer_programme_id
        )
        review["decision"] = latest.decision
        review["reason_code"] = latest.reason_code
        review["decided_at"] = format_timestamp(latest.decision_timestamp)
        if latest.requested_correction:
            review["requested_correction"] = latest.requested_correction
        if audience.reviewer_notes:
            review["reviewer_note"] = latest.reviewer_note
            review["evidence_considered"] = list(latest.evidence_considered)[:100]
    return review


def recovery_record(
    record: RecoveryRecord, *, lookup_token: str, audience: RecordAudience
) -> dict[str, Any]:
    if record.original_image_evidence_id is None:
        raise ValueError("A recovery record always references its original photograph.")
    data: dict[str, Any] = {
        "contract_schema_version": CONTRACT_SCHEMA_VERSION,
        "record_id": str(record.id),
        "human_reference": record.human_reference,
        "qr_payload": qr_payload(record.id, lookup_token),
        "revision": record.revision,
        "record_kind": record.record_kind,
        "category": record.category,
    }
    if record.item_count is not None:
        data["item_count"] = record.item_count
    if record.approximate_weight_value is not None and record.approximate_weight_unit:
        data["approximate_weight"] = weight(
            record.approximate_weight_value, record.approximate_weight_unit
        )
    data["condition"] = record.condition
    data["original_image_evidence_id"] = str(record.original_image_evidence_id)
    data["collector"] = actor_reference(record.collector_id, record.programme_id)
    data["captured_at"] = format_timestamp(record.captured_at)
    if record.capture_location is not None and audience.personal_data:
        data["capture_location"] = record.capture_location
    data["approximate_area"] = record.approximate_area
    if record.vision_result is not None:
        data["vision_result"] = record.vision_result
    data["category_confirmation"] = record.category_confirmation
    for field in ("estimated_price", "safety_guide", "destination"):
        value = getattr(record, field)
        if value is not None:
            data[field] = value
    if record.handoff is not None:
        data["handoff"] = handoff_information(record.handoff)
    if record.processing is not None and record.processing.status == "submitted":
        data["processing"] = processing_information(record.processing)
    data["review"] = review_information(record.review_case, audience)
    data["business_state"] = record.business_state
    data["handoff_state"] = record.handoff_state
    data["processing_state"] = record.processing_state
    data["sync"] = {
        # A server representation is by definition synchronised; offline states belong to the
        # client's local copy.
        "sync_state": "synchronized",
        "device_instance_id": str(record.device_instance_id),
        "local_revision": record.revision,
        "server_revision": record.revision,
    }
    data["created_at"] = format_timestamp(record.created_at)
    data["updated_at"] = format_timestamp(record.updated_at)
    if record.integrity_digest:
        data["integrity_digest"] = record.integrity_digest
    if record.previous_integrity_digest:
        data["previous_integrity_digest"] = record.previous_integrity_digest
    return data


def evidence(item: Evidence, *, personal_data: bool) -> dict[str, Any]:
    storage_reference: dict[str, Any] = {
        "storage_provider": item.storage_provider,
        "object_key": item.object_key,
    }
    if item.object_version:
        storage_reference["object_version"] = item.object_version
    provenance: dict[str, Any] = {
        "capture_source": item.capture_source,
        "captured_by": actor_reference(
            item.captured_by_id, item.captured_by_programme_id, item.captured_by_facility_id
        ),
        "device_instance_id": str(item.device_instance_id),
        "captured_at": format_timestamp(item.captured_at),
        "server_received_at": format_timestamp(item.server_received_at),
    }
    if item.coordinates is not None and personal_data:
        provenance["coordinates"] = item.coordinates
    provenance["application_version"] = item.application_version
    provenance["connectivity"] = item.connectivity
    if item.ai_observation is not None:
        provenance["ai_observation"] = item.ai_observation
    if item.human_correction is not None:
        provenance["human_correction"] = item.human_correction
    return {
        "evidence_schema_version": CONTRACT_SCHEMA_VERSION,
        "evidence_id": str(item.id),
        "recovery_record_id": str(item.record_id),
        "evidence_type": item.evidence_type,
        "storage_reference": storage_reference,
        "mime_type": item.mime_type,
        "file_size_bytes": item.file_size_bytes,
        "content_digest": item.content_digest,
        "provenance": provenance,
        "validation_status": item.validation_status,
    }


def recovery_record_event(event: RecoveryRecordEvent) -> dict[str, Any]:
    data: dict[str, Any] = {
        "event_schema_version": event.event_schema_version,
        "event_id": str(event.id),
        "recovery_record_id": str(event.record_id),
        "event_type": event.event_type,
    }
    if event.actor_id is not None:
        data["actor"] = actor_reference(
            event.actor_id, event.actor_programme_id, event.actor_facility_id
        )
    data["actor_role"] = event.actor_role
    data["occurred_at"] = format_timestamp(event.occurred_at)
    data["previous_state"] = event.previous_state
    data["resulting_state"] = event.resulting_state
    if event.reason:
        data["reason"] = event.reason
    return data
