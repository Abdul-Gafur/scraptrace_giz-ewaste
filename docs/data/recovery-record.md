# Recovery record

## Purpose and status

The recovery record is the proposed central evidence object that connects collection, handoff, measurement, processing evidence, and review without claiming that any single element proves recycling. It is not implemented and its final contract/state machine is to be decided.

## Proposed contents

| Element | Meaning and integrity rule |
|---|---|
| Record identifier | Stable canonical opaque identifier; local provisional ID is mapped after server acknowledgement |
| Item or batch | Exactly one governed subject type per record under the accepted granularity rules |
| Collector | Minimum authorised collector reference; not exposed on public dashboards |
| Capture time | Device/capture time with provenance and clock uncertainty where relevant; server receipt time kept separately |
| Approximate location | Purpose-limited location with precision/source/permission metadata; exact coordinates are not assumed necessary |
| Image evidence | Protected object reference, checksum, purpose, capture provenance, upload/validation status, and retention class |
| AI category and confidence | Immutable prediction plus model/category/contract version and inference outcome |
| User-confirmed category | Separate confirmation or correction with actor/time/reason; never overwrites prediction |
| Selected destination | Participating location reference, type, status/version, and selection time; listing does not imply recycler approval |
| QR code reference | Resolves to the authorised record without embedding unnecessary personal data; scanning creates no duplicate record |
| Handoff | Recycler/facility assertion, actor/time, discrepancies, and confirmation evidence |
| Measured weight | Value, unit, source/actor, time, and correction history; distinct from approximate user input |
| Final price | Recycler-entered commercial result with currency/time/source; separate from estimate and any future incentive |
| Processing evidence | Outcome assertion and protected supporting references with completeness/review state |
| Review status | Separate verification decision/reasons; incomplete or disputed evidence remains visible |
| History | Append-only/versioned material events with actor, time, reason, prior/new references and correlation |
| Model version | Exact version/checksum reference used for retained predictions |
| Safety-content version | Approved-card version/language/source and transformation policy/provider versions where used |

## Proposed lifecycle states

```text
draft
saved-offline
pending-sync
submitted
awaiting-handoff
received
processing
completed
under-review
rejected
```

These names are a working proposal, not an accepted state machine. Phase 1 also uses terms such as queued, syncing, synced, flagged, processed, and approved. Contract design must reconcile them before implementation rather than treating them as synonyms.

## Lifecycle meaning

| State | Proposed meaning |
|---|---|
| `draft` | Editable record exists but the user has not requested submission |
| `saved-offline` | Draft is durably saved only on the current device under validated platform limits |
| `pending-sync` | User requested submission; canonical server acknowledgement is pending |
| `submitted` | Server accepted a canonical record, not proof of handoff or processing |
| `awaiting-handoff` | Record is eligible to be presented to a participating destination |
| `received` | Authorised recycler/facility actor recorded receipt; discrepancies may remain |
| `processing` | Processing activity/evidence is expected or being recorded; not automatically verified |
| `completed` | Required lifecycle evidence is present under the applicable completeness rules |
| `under-review` | A reason-coded issue or required review is unresolved; prior lifecycle facts remain |
| `rejected` | An authorised review rejected the record for the defined programme purpose, with reason/history |

Transitions, terminal states, reopening, cancellation, partial batches, multiple handoffs, and offline recycler actions require programme and architecture approval.

## Verification as a separate dimension

To prevent overclaiming, proposed verification status should be distinct from lifecycle state, for example `not-reviewed`, `pending`, `approved`, or `rejected`. Exact values are to be decided. A record can be lifecycle-complete yet still pending or rejected by programme review. “Verified” means it met a specific authorised programme's defined checks; it is not universal proof, regulator acceptance, recycler certification, or an EPR credit.

## Critical distinctions

- **Locally saved:** Data exists on a device. The server may know nothing about it.
- **Submitted:** The server acknowledged a canonical record. Physical handoff is unproven.
- **Received:** An authorised receiving actor recorded handoff. Processing remains unproven.
- **Completed:** Required collection-to-processing fields/evidence are present under versioned rules.
- **Verified/approved:** An authorised review or ruleset accepted the record for a stated programme purpose.

The interface, API, reports, and audit history must never collapse these terms.

## Evidence and mutation rules

- Source assertions are attributed and append-only or versioned; later corrections do not erase originals.
- Predictions, estimates, measurements, and review decisions use separate fields/events.
- Every material transition records actor, time, reason, rules/contract version, and idempotent operation reference.
- Concurrency and offline conflicts do not use silent last-write-wins for evidence.
- Duplicate-image similarity or unusual weight creates a review signal, not an automatic fraud conclusion.
- Public/aggregate reporting excludes identity and separates incomplete, unsynchronised, under-review, rejected, and programme-approved totals.

## Identifier and integrity-code ambiguity

The Concept Note describes both a unique record number and a “special code” that changes after an edit. Proposed resolution is to keep the canonical record identifier stable and use separate version/integrity metadata that changes with material revisions. The QR should resolve to the stable authorised record. This interpretation requires an explicit contract/architecture decision before implementation.

## Versions and provenance

The record should reference category definition, model, safety card, prompt/policy/validator, price reference, location profile/status, completeness rule, and review-policy versions where each influenced the journey. Historical rendering uses the original references rather than silently applying current definitions.
