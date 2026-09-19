# Functional requirements

All requirements have status **Proposed** because the repository contains no implementation. Priorities are `Must`, `Should`, or `Could` for the hackathon scope. Acceptance conditions define testable intent; detailed test cases are deferred.

## Collector and household experience

| Identifier | Requirement statement | Rationale | Acceptance condition | Priority | Status |
|---|---|---|---|---|---|
| FR-COL-001 | The system shall allow an authenticated or locally identified user to capture a new image inside the mobile-friendly experience. | In-app capture reduces reuse of old gallery images. | A supported phone browser can start capture, preview it, and save or discard it; provenance records it as in-app capture. | Must | Proposed |
| FR-COL-002 | The system shall collect category confirmation, item count, condition, and approximate location with permission. | These fields support guidance, estimates, discovery, and records. | The user can review each field; refusal of location permission offers manual area entry. | Must | Proposed |
| FR-COL-003 | The system shall present the current record status and history for records visible to the user. | Users need evidence and understandable progress. | A user can distinguish draft, pending sync, submitted, received, flagged, processed, approved, and rejected states that apply. | Must | Proposed |
| FR-HOU-001 | The system shall let a household user obtain approved guidance without creating a complete recovery record. | Safety guidance should not depend on programme participation. | A user can select or classify a supported category and view its approved card without completing delivery fields. | Must | Proposed |
| FR-HOU-002 | The system shall support English, French, Arabic, and Portuguese content within the hackathon scope. | The Concept Note requires multilingual access. | Users can switch language and required labels, safety warnings, location details, and statuses appear in the selected language; quality is reviewed. | Must | Proposed |

## Recycler experience

| Identifier | Requirement statement | Rationale | Acceptance condition | Priority | Status |
|---|---|---|---|---|---|
| FR-REC-001 | The system shall let an authorised recycler retrieve an item or batch by QR code or identifier. | The physical handover must connect to its digital record. | A valid code opens the permitted record; invalid or inaccessible codes return a clear error without leaking data. | Must | Proposed |
| FR-REC-002 | The system shall record measured weight, final buying price, facility, actor, and confirmation time. | Receipt evidence must be distinct from estimates. | Required fields are validated and appended without overwriting collector-entered values. | Must | Proposed |
| FR-REC-003 | The system shall capture a confirmation image showing the delivery and readable scale result. | Later review requires stronger handover evidence. | A recycler can attach evidence; absent required evidence keeps the record incomplete or flagged. | Must | Proposed |
| FR-REC-004 | The system shall record a processing outcome and supporting evidence. | Receipt alone does not prove processing. | The record cannot reach the defined completed state until required processing fields and evidence pass validation or review. | Must | Proposed |

## Programme management

| Identifier | Requirement statement | Rationale | Acceptance condition | Priority | Status |
|---|---|---|---|---|---|
| FR-PRG-001 | The system shall let authorised managers maintain programme-scoped participating-location profiles and status. | Location results require checked, current metadata. | A manager can record type, coordinates, contact, hours, accepted waste, status, evidence, and update date with an audit entry. | Must | Proposed |
| FR-PRG-002 | The system shall configure review rules and, if demonstrated, a clearly simulated incentive rate separately from scrap price. | Programme rules need explicit authority and separation. | Only authorised roles can change rules; changes are versioned; simulation is labelled non-payment and non-entitlement. | Could | Proposed |
| FR-PRG-003 | The system shall restrict programme data to authorised programme scope. | Operational access does not imply global access. | Cross-programme records and personal fields are denied unless a documented role explicitly permits them. | Must | Proposed |

## Computer vision

| Identifier | Requirement statement | Rationale | Acceptance condition | Priority | Status |
|---|---|---|---|---|---|
| FR-AI-001 | The vision capability shall suggest one of the seven Concept Note categories and provide a confidence value. | Category selection drives the collection journey while exposing uncertainty. | For a valid test image, the response contains category, bounded confidence, model version, and outcome or error. | Must | Proposed |
| FR-AI-002 | The system shall allow correction of a suggested category while preserving the original result. | Human correction improves the record without hiding model behaviour. | Original prediction, confidence, user correction, time, and actor are retained and reviewable. | Must | Proposed |
| FR-AI-003 | Corrections shall not update a deployed model automatically. | Unreviewed or malicious labels must not become training truth. | A correction enters a review queue; no training-data approval or model release occurs without separate authorised actions. | Must | Proposed |
| FR-AI-004 | The system shall communicate low confidence and support manual selection. | Users must not be forced to accept uncertain output. | Below a configurable reviewed threshold, the interface marks uncertainty and requires confirmation or manual category selection. | Must | Proposed |

## Safety assistant and LLM

| Identifier | Requirement statement | Rationale | Acceptance condition | Priority | Status |
|---|---|---|---|---|---|
| FR-SAF-001 | The system shall retrieve an approved safety card matching the confirmed category. | Safety claims must come from reviewed content. | The response includes card version, source, approval date, review date, and approved content or a controlled unavailable result. | Must | Proposed |
| FR-SAF-002 | The LLM shall explain, simplify, or translate only retrieved approved information. | Controlled grounding reduces unsafe invention. | Evaluation detects and rejects responses adding unsupported dismantling, hazard, disposal, or emergency instructions. | Must | Proposed |
| FR-SAF-003 | When approved information or the LLM is unavailable, the system shall use an approved fallback and not guess. | Safety access must fail safely. | Simulated missing content/provider states show a reviewed fallback and referral to an approved handler or trained technician. | Must | Proposed |
| FR-SAF-004 | Safety output shall answer what the item is, potential hazards, prohibited actions, safe immediate actions, and where to take it. | The Concept Note defines these five card functions. | Each supported category's approved card contains all five sections or a documented not-applicable rationale. | Must | Proposed |

## Price estimation

| Identifier | Requirement statement | Rationale | Acceptance condition | Priority | Status |
|---|---|---|---|---|---|
| FR-PRI-EST-001 | The system shall display a price range, not an exact offer, using category, count, condition, and a dated sample local reference list. | A photograph cannot establish exact weight, material, or condition. | The output shows lower/upper estimate, currency, inputs, source date, and a non-binding label. | Must | Proposed |
| FR-PRI-EST-002 | Mixed-scrap estimation shall require user-entered approximate weight; known weight may refine other estimates. | Image-only weight estimation is unreliable. | Mixed-scrap estimation is unavailable until approximate weight is entered; the value is marked user supplied. | Must | Proposed |
| FR-PRI-EST-003 | The final buying price shall be entered after physical inspection and remain separate from any estimate or incentive. | Commercial outcome and programme reward are different facts. | Record history displays estimated range, final buying price, and any simulated incentive as distinct labelled values. | Must | Proposed |

## Nearby-location search

| Identifier | Requirement statement | Rationale | Acceptance condition | Priority | Status |
|---|---|---|---|---|---|
| FR-LOC-001 | With permission, the system shall rank participating locations by proximity and accepted waste type. | Users need actionable destinations. | Results use current or cached coordinates, filter incompatible locations, and disclose data freshness. | Must | Proposed |
| FR-LOC-002 | Results shall show location type, verification status, hours, contact details, accepted waste, and directions availability. | A listing must not imply recycler approval. | Each result distinguishes scrapyard, collection centre, and recycler and never derives approval from proximity or listing alone. | Must | Proposed |
| FR-LOC-003 | Users shall be able to search manually when location access is unavailable. | Location permission and GPS cannot be assumed. | A place or area input returns directory matches without requiring device location. | Should | Proposed |

## Offline storage and synchronisation

| Identifier | Requirement statement | Rationale | Acceptance condition | Priority | Status |
|---|---|---|---|---|---|
| FR-OFF-001 | The client shall save a draft or queued recovery record locally without internet. | Capture sites may have weak connectivity. | In an offline test, required inputs and image persist across app restart and show local-only or pending status. | Must | Proposed |
| FR-OFF-002 | The client shall synchronise queued operations after reconnection using idempotency keys and retry-safe requests. | Retries must not create duplicate records. | Replaying the same operation produces one canonical effect and returns the same mapping or outcome. | Must | Proposed |
| FR-OFF-003 | The client shall expose sync status, last attempt, and actionable errors. | Users need to know whether evidence reached the server. | Pending, syncing, synced, conflict, and failed states are visually distinguishable and accessible. | Must | Proposed |
| FR-OFF-004 | Cached approved safety cards, previously generated guides, and a recently saved directory shall remain available offline with freshness metadata. | Core guidance and access information should degrade safely. | Offline tests show available cached content and date; absent content produces a controlled message rather than invented data. | Must | Proposed |

## Records and QR codes

| Identifier | Requirement statement | Rationale | Acceptance condition | Priority | Status |
|---|---|---|---|---|---|
| FR-VER-001 | The system shall create uniquely identified item records for large items and batch records for small parts or mixed scrap. | Record granularity must match the physical handover. | Users can choose an allowed type; required fields and displayed identifier reflect item or batch semantics. | Must | Proposed |
| FR-VER-002 | The system shall generate a QR code that references the record without exposing unnecessary personal data. | Scanning should retrieve, not duplicate, the record. | The QR resolves through authorised access and its payload contains no directly readable personal details. | Must | Proposed |
| FR-VER-003 | The system shall retain an append-only history of material status and evidence changes. | Verification depends on traceability. | Authorised users can see who changed what and when; original evidence remains distinguishable. | Must | Proposed |

## Review and verification

| Identifier | Requirement statement | Rationale | Acceptance condition | Priority | Status |
|---|---|---|---|---|---|
| FR-VER-004 | The system shall flag low confidence, category mismatch, suspected repeated image, unusual weight, and missing required evidence. | These conditions weaken record trust. | Controlled test records trigger their corresponding reason codes without being automatically approved. | Must | Proposed |
| FR-VER-005 | An authorised reviewer shall be able to approve, reject, or request more information with a recorded reason. | Human judgement is required for exceptions. | Each decision requires a reason, actor, time, and immutable history entry. | Must | Proposed |
| FR-VER-006 | Only records meeting defined completeness and review rules shall enter verified programme totals or simulated bonus calculations. | Incomplete evidence must not support official-looking claims. | Reporting queries exclude pending, incomplete, rejected, and unsynchronised records from verified totals. | Must | Proposed |

## Reporting and dashboard

| Identifier | Requirement statement | Rationale | Acceptance condition | Priority | Status |
|---|---|---|---|---|---|
| FR-PRG-004 | The dashboard shall show programme-scoped categories, collection locations, measured verified weight, processing status, and record status. | Managers need an understandable end-to-end view. | Filters return internally consistent aggregates with definitions and freshness displayed. | Must | Proposed |
| FR-PRG-005 | The system shall display a complete permitted journey from capture through processing. | The demonstration must connect evidence across stages. | An authorised user can view ordered events, actors, evidence state, and unresolved flags for a record. | Must | Proposed |
| FR-PRG-006 | The dashboard shall separate verified, pending, flagged, rejected, and unsynchronised results. | Status ambiguity can overstate programme outcomes. | Counts and weights are grouped by defined state; verified totals do not include other states. | Must | Proposed |
| FR-PRG-007 | The system may aggregate location searches without exposing searcher identity. | Search patterns may indicate access gaps. | If enabled, aggregates omit direct identifiers and suppress or protect small groups according to a policy **to be decided**. | Could | Proposed |
