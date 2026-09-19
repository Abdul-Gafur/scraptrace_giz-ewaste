# Functional requirements

This catalogue mirrors the functional requirements in the [approved SRS v1.1](<ScrapTrace_Software_Requirements_Specification (2).docx>), sections 5.1–5.10. The SRS is authoritative if wording differs. `Must` requirements form the hackathon acceptance baseline; a `Should` item may be deferred only through a recorded product decision that preserves the end-to-end acceptance scenario; a `Could` item must not displace core quality work. The stakeholder need behind each group is traced in [SRS traceability](srs-traceability.md#stakeholder-need-traceability). The status of every listed requirement is **required but not implemented** until linked implementation and test evidence proves otherwise.

## Access, role, consent and language

| ID | Requirement | Priority | Verification | Acceptance criterion |
|---|---|---|---|---|
| FR-ACC-001 | Provide demonstration sign-in for collector, recycler, reviewer, manager, content-administrator and data-reviewer roles. | Must | System test | Each seeded role reaches only its permitted landing page and API resources. |
| FR-ACC-002 | Enforce role permissions server-side for every protected request; hiding interface controls is insufficient. | Must | Security test | A forbidden cross-role request returns `403`, creates a security event and discloses no protected data. |
| FR-ACC-003 | Explain camera, location, image, record and optional training-data uses before collection. | Must | UI test | A first-time user can read each purpose and continue with non-essential consent declined. |
| FR-ACC-004 | Request camera and location permissions only when the related feature is used. | Must | UI test | Opening the home page alone triggers no permission request. |
| FR-ACC-005 | Offer English, French, Arabic and Portuguese. | Must | UI test | The selector changes baseline journey labels and messages in each supported language. |
| FR-ACC-006 | Version, cache and use reviewed interface translations without an LLM. | Must | Offline test | After one successful load, translated baseline interface text remains available offline. |
| FR-ACC-007 | Fall back to English when a translation key is missing and log the missing key without showing raw tokens. | Must | Unit/UI test | A missing test key displays readable English and creates a diagnostic event. |
| FR-ACC-008 | Allow sign-out and clearing of locally cached personal records. | Should | UI test | After confirmation, local account data is cleared and protected pages require sign-in. |

## Image capture, category prediction and correction

| ID | Requirement | Priority | Verification | Acceptance criterion |
|---|---|---|---|---|
| FR-VIS-001 | Support in-application camera capture and clearly label any demonstration fallback using a test image. | Must | UI test | On the target phone, a user can capture, preview, retake and accept an image. |
| FR-VIS-002 | Validate image type and size and compress accepted images before upload while retaining evaluation detail. | Must | Unit/system test | Invalid types are rejected and a valid oversized image is reduced to the configured limit. |
| FR-VIS-003 | Return scores for all seven categories, the highest-scoring category and model version. | Must | API test | A valid request returns a schema-valid result with seven scores and a version. |
| FR-VIS-004 | Show category and confidence in plain language without presenting the output as certain. | Must | UI test | High, medium and low-confidence states invite confirmation. |
| FR-VIS-005 | Require confirmation or selection of another supported category before continuation. | Must | UI test | A record cannot be submitted without a confirmed category. |
| FR-VIS-006 | Preserve original prediction, selected category, user, time and optional reason for a correction. | Must | Data test | Original and corrected values coexist; prediction data is not overwritten. |
| FR-VIS-007 | On low confidence or prediction failure, show all supported categories for manual selection and offer retake. | Must | UI test | Low-confidence and timeout cases can create a manually labelled draft. |
| FR-VIS-008 | Never retrain or deploy a model automatically from user corrections. | Must | Code/configuration review | No correction path changes the active model or training dataset automatically. |
| FR-VIS-009 | Provide an authorised correction-review queue for future dataset preparation. | Should | System test | A reviewer can compare image, model output, user label and recycler label and save a decision. |

## Approved safety guidance and LLM explanation

| ID | Requirement | Priority | Verification | Acceptance criterion |
|---|---|---|---|---|
| FR-SAF-001 | Maintain a versioned safety card for each category covering identity, hazards, prohibited actions, safe immediate action and destination. | Must | Content test | Seven approved English cards contain all five fields, sources, approver, approval date and review date. |
| FR-SAF-002 | Display or ground the LLM only with cards that are current and `Approved`. | Must | API test | Draft, retired and expired cards are excluded. |
| FR-SAF-003 | Send the LLM only approved card facts, requested language, tone/reading level and the no-new-facts/no-dismantling rule. | Must | Integration review | Captured requests include no identity, coordinates, images or facts outside the card. |
| FR-SAF-004 | Use the LLM only to explain, simplify or translate approved content, not answer open-ended safety questions. | Must | Adversarial test | Injection and unrelated questions receive the approved fallback or referral. |
| FR-SAF-005 | Validate LLM output against a structured schema and prohibited-action rules before display. | Must | Integration test | Malformed or prohibited dismantling output is blocked. |
| FR-SAF-006 | On LLM failure or invalid output, display the approved static card in the selected language when available. | Must | Failure test | With the LLM disabled, approved guidance appears with a visible fallback label. |
| FR-SAF-007 | If no approved card exists, make no LLM call and refer the user to a verified receiving location or trained technician. | Must | System test | Missing-card tests produce no provider call and show the approved referral. |
| FR-SAF-008 | Show category, sources, card version, approval date and review date with every guide. | Must | UI test | Metadata is visible or available through an accessible control. |
| FR-SAF-009 | Provide reviewed safety content in English, French, Arabic and Portuguese; LLM translation may supplement but never replace offline reviewed text. | Must | Content/offline test | Reviewed bundles are available offline for all seven categories and supported languages. |
| FR-SAF-010 | Label LLM wording as AI-assisted and retain source-card, provider/model and policy metadata. | Must | UI/data test | Stored response metadata links the explanation to its approved source. |
| FR-SAF-011 | Optional text-to-speech reads only displayed approved or validated text and remains separate from the LLM. | Could | UI test | Disabling it has no guide impact; enabling it reads visible text only. |
| FR-SAF-012 | Use fixed reviewed emergency wording for heat, smoke, fire, swelling or leakage. | Must | Content test | Emergency wording exactly matches the approved version and is never freely generated. |

## Indicative price estimation

| ID | Requirement | Priority | Verification | Acceptance criterion |
|---|---|---|---|---|
| FR-PRI-001 | Estimate from confirmed category, item count, selected condition and active dated reference data. | Must | Unit test | Known fixtures reproduce approved minimum and maximum values. |
| FR-PRI-002 | Require positive approximate weight and unit for mixed scrap and explain that photographs cannot measure weight reliably. | Must | UI test | Calculation remains disabled until both are supplied. |
| FR-PRI-003 | Allow known approximate weight for item categories and record whether it was supplied. | Should | Unit/UI test | Weighted and unweighted paths preserve input provenance. |
| FR-PRI-004 | Show minimum, maximum, currency, basis, condition, source, update date and a non-offer disclaimer. | Must | UI test | Every estimate contains all fields and the disclaimer. |
| FR-PRI-005 | When current reference data is absent, show unavailable and never invent a price. | Must | Failure test | Missing or stale data returns no numeric value. |
| FR-PRI-006 | Keep recycler final price and measured weight separate from the original estimate. | Must | Data test | Completed records retain both estimate and final price. |
| FR-PRI-007 | Separate any example incentive from scrap price and label it simulated unless an authorised live programme exists. | Must | UI test | The calculation shows its sample rule, status and separate subtotal. |

## Nearby receiving locations

| ID | Requirement | Priority | Verification | Acceptance criterion |
|---|---|---|---|---|
| FR-LOC-001 | Store name, type, coordinates, accepted categories, hours, contact details and verification state/date for each location. | Must | Data test | Incomplete seed profiles cannot be published. |
| FR-LOC-002 | With permission, rank published compatible locations by straight-line distance. | Must | Unit/system test | Known coordinate fixtures return correctly ordered compatible results. |
| FR-LOC-003 | When geolocation is denied, allow approximate manual area selection without blocking the journey. | Must | UI test | Denial reveals a manual path and suitable results. |
| FR-LOC-004 | Distinguish scrapyards, collection centres and recyclers; show a verified badge only after manager approval. | Must | UI/API test | Unverified profiles never show the badge. |
| FR-LOC-005 | Provide list and map views, calling and external directions while online. | Must | UI test | Actions use stored contact details and coordinates. |
| FR-LOC-006 | Keep the latest reviewed compact directory offline with its update date. | Must | Offline test | Compatible cached entries display offline and are labelled cached. |
| FR-LOC-007 | On no match, show an approved safe-holding message and programme contact rather than unsafe disposal advice. | Must | Failure test | A no-match fixture shows the fallback and no unrelated location. |
| FR-LOC-008 | Aggregate anonymous no-result searches by coarse area and category. | Should | Report test | Results contain counts without identity or precise coordinates. |

## Offline capture and synchronization

| ID | Requirement | Priority | Verification | Acceptance criterion |
|---|---|---|---|---|
| FR-OFF-001 | Save a validated draft locally before attempting network submission. | Must | Offline test | Network loss after capture preserves accepted metadata and form values. |
| FR-OFF-002 | Give each local mutation a client ID, idempotency key, creation time, local version and sync state. | Must | Data test | Local inspection shows every field. |
| FR-OFF-003 | Display `Offline`, `Pending synchronization`, `Synchronizing`, `Synchronized` and `Action required` in plain language. | Must | UI test | Injected connection and conflict states show the correct label. |
| FR-OFF-004 | Retry after reconnection with bounded exponential backoff for transient failures. | Must | Integration test | A temporary failure later succeeds and creates at most one server record. |
| FR-OFF-005 | Treat repeated idempotency keys as one logical mutation and return the existing result. | Must | API test | Three identical submissions create one state change. |
| FR-OFF-006 | On local/server version conflict, preserve the local copy, stop automatic overwrite and require authorised action. | Must | Conflict test | Both values remain recoverable and the UI shows `Action required`. |
| FR-OFF-007 | Warn when storage is nearly unavailable and never claim a draft was saved after storage failure. | Must | Failure test | Quota failure gives an error and a reduction/retry option. |
| FR-OFF-008 | Scope sensitive caches to the signed-in user and clear them on explicit sign-out/clear. | Must | Security test | A second seeded user cannot see the first user's records. |

## Recovery record and QR code

| ID | Requirement | Priority | Verification | Acceptance criterion |
|---|---|---|---|---|
| FR-REC-001 | Create individual-item or batch records; mixed scrap defaults to batch. | Must | UI test | Both types are available with the correct required fields. |
| FR-REC-002 | Store ID, owner, evidence reference, confirmed category, applicable count/weight, condition, capture time, approximate area, estimate and selected destination. | Must | API/data test | Valid records contain applicable fields and incomplete input returns field errors. |
| FR-REC-003 | Generate a QR containing only an opaque lookup token or URL without personal or location data. | Must | Security test | Decoding reveals only the approved token/URL format. |
| FR-REC-004 | Show QR, human-readable short code and current status and allow reopening. | Must | UI test | A collector can present the record after closing and reopening the app. |
| FR-REC-005 | Enforce the lifecycle server-side and audit every accepted state transition. | Must | API test | Invalid transitions fail; valid events include actor, time and prior/new state. |
| FR-REC-006 | Version permitted changes after submission without silently replacing originals. | Must | Data test | Prior value and change actor remain visible. |
| FR-REC-007 | Store an image digest and flag exact reuse across active records. | Must | System test | Reusing a fixture image creates a flag rather than automatic approval. |

## Recycler handoff, weight and final price

| ID | Requirement | Priority | Verification | Acceptance criterion |
|---|---|---|---|---|
| FR-HND-001 | Retrieve intake information by QR scan or short code. | Must | UI/security test | Valid codes open intake; invalid codes reveal no owner data. |
| FR-HND-002 | Show expected category, item/batch type and only non-sensitive comparison evidence. | Must | UI test | Recycler can compare delivery without collector contact or precise coordinates. |
| FR-HND-003 | Independently confirm category/condition and record positive weight/unit and non-negative final price/currency. | Must | UI/API test | Submission enforces each validation. |
| FR-HND-004 | Require a handoff photo and readable scale evidence, subject to privacy guidance or an authorised exception. | Must | System test | Handoff cannot complete without configured evidence or exception reason. |
| FR-HND-005 | Record receiving location, recycler, server time and client capture time. | Must | Data test | Completed handoff contains every provenance field. |
| FR-HND-006 | Convert material category disagreement, unusual weight or duplicate evidence into review flags, not silent approval or blocking. | Must | Rule test | Each fixture creates the documented code and explanation. |
| FR-HND-007 | Display estimate and recycler final price as separate journey values. | Must | UI test | Both are distinctly labelled. |

## Processing evidence and human review

| ID | Requirement | Priority | Verification | Acceptance criterion |
|---|---|---|---|---|
| FR-REV-001 | Record a controlled processing result, date, notes and supporting evidence. | Must | UI/API test | Result, date and configured evidence are required. |
| FR-REV-002 | Evaluate evidence completeness, exact duplicate image, category disagreement, weight threshold and state rules and create named flags. | Must | Rule test | Each rule fixture yields expected code, severity and explanation. |
| FR-REV-003 | Put flagged records `Under review` and exclude them from approved totals and simulated-incentive eligibility. | Must | System test | A flagged fixture contributes to neither. |
| FR-REV-004 | Show reviewers flag reasons, category history, estimate, weight, evidence, locations, audit history and relevant model/reference versions. | Must | UI test | Every item is reachable from one review view. |
| FR-REV-005 | Require a reason when a reviewer approves, requests information or rejects. | Must | UI/API test | Valid decisions record reviewer and time; reasonless decisions fail. |
| FR-REV-006 | Return requested-information work to the responsible collector or recycler without exposing reviewer-only data. | Should | System test | The user sees only the request and allowed fields. |
| FR-REV-007 | Mark only a complete unflagged or reviewer-approved record `Approved and completed`. | Must | State test | Incomplete or undecided records cannot reach that state. |
| FR-REV-008 | Keep creation, sync, prediction, correction, handoff, evidence, flag and decision audit history append-only for ordinary roles. | Must | Security/data test | Ordinary users cannot change/delete audit rows and required actions create events. |
| FR-REV-009 | Explain that flags require judgement and are not proof of fraud. | Must | UI test | Every flag panel shows the approved statement. |

## Journey, dashboard and demonstration reporting

| ID | Requirement | Priority | Verification | Acceptance criterion |
|---|---|---|---|---|
| FR-DSH-001 | Show capture, category, safety-card version, estimate, destination, handoff, weight, final price, processing and review status in time order. | Must | UI test | A seeded complete record shows every applicable event and timestamp. |
| FR-DSH-002 | Limit collectors to own records, recyclers to authorised receiving locations, and reviewers/managers to assigned scope. | Must | Security test | Cross-owner and cross-location access is denied. |
| FR-DSH-003 | Filter and total by date, category, coarse area, receiving location and status. | Must | Report test | Totals reconcile with seeded records. |
| FR-DSH-004 | Include only `Approved and completed` records in verified-weight totals and show the unit. | Must | Report test | Flagged, rejected and draft records are excluded. |
| FR-DSH-005 | Show freshness and active filters and never present incomplete records as verified recycling. | Must | UI test | Freshness, filters and status definitions are visible. |
| FR-DSH-006 | Demonstrate a labelled simulated safe-delivery bonus using sample rate and verified weight. | Should | Demo test | Inputs, formula, result and `simulation—no payment sent` appear. |
| FR-DSH-007 | Export authorised aggregate or record CSV without private image URLs, phone numbers or precise coordinates. | Could | Security/report test | Export fields match the approved role-specific schema. |

## Business rules

| ID | Rule |
|---|---|
| BR-001 | The taxonomy contains exactly the seven top-level challenge-dataset categories. |
| BR-002 | The confirmed category drives guidance and estimation; original prediction remains recorded. |
| BR-003 | Only a current approved safety card may be displayed or supplied to the LLM. |
| BR-004 | The LLM may explain or translate approved facts only and must not invent facts or dismantling instructions. |
| BR-005 | Mixed-scrap estimation requires approximate weight; all estimates remain indicative until recycler confirmation. |
| BR-006 | Only manager-reviewed location profiles display a verified badge. |
| BR-007 | One idempotency key represents one logical mutation; one record ID identifies one item or declared batch. |
| BR-008 | `Approved and completed` requires handoff and processing evidence with no unresolved flag. |
| BR-009 | A flag requires review and is not proof of wrongdoing. |
| BR-010 | Only `Approved and completed` records contribute to verified weight or simulated incentive eligibility. |
| BR-011 | ScrapTrace does not send money, issue official EPR credits or certify legal compliance. |
| BR-012 | Training reuse requires separate consent, human label approval and a versioned dataset release. |
