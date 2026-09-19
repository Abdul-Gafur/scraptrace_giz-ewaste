# Demonstration data

## Purpose and rules

This document defines the minimum controlled demonstration-data inventory; it adds no dataset or mock business records. Every eventual artefact must be clearly fictional or explicitly authorised, provenance-recorded, segregated from production, and approved for its purpose.

Do not invent real personal information, imply recycler certification, provide unverified safety advice, present sample prices as offers, or reuse operational data for training without separate governance.

## Minimum inventory

| Data type | Minimum controlled need | Provenance and labelling requirements | Prohibited use |
|---|---|---|---|
| Challenge images | Small authorised set covering the demonstrated category/correction/failure cases; wider model evaluation remains separate | Challenge source/licence/version, file checksum, permitted demo/model use, category-review status, personal-data review | Commit/share without rights; imply representativeness; use an old gallery file while claiming live capture unless replay is labelled |
| Seven category definitions | Versioned definitions for refrigerators; laptops/desktops; televisions; microwaves; air conditioners; compressors; mixed scrap | Data/subject reviewer, version, inclusion/exclusion/ambiguity and out-of-scope rules | Add unsupported categories or assume bounding boxes/detection |
| Approved safety-card structures | Schema-complete cards or presentation-safe placeholders whose actual safety wording is supplied and approved outside this phase | Card/source/version/language/approval/review metadata; every demo card marked approved only by assigned authority | Invent health/recycling facts; use draft/expired/withdrawn content; treat generated text as source |
| Sample scrapyard/recycler locations | Few fictional or explicitly authorised participating profiles sufficient for proximity/manual/cached cases | Prominent `FICTIONAL DEMO LOCATION` or authorised-test label, type, accepted categories, coordinates, freshness, contact placeholders that cannot reach real people | Present sample listing as officially approved; use real contact/location without authority |
| Sample price references | Small set of fictional/sample ranges covering the shown calculation | `SAMPLE—NOT AN OFFER`, currency/unit/category/condition, fictional source or authorised study reference, effective/update date | Guarantee price/income; derive exact weight/value from image; present as buyer commitment |
| Fictional user accounts | Kofi collector plus fictional recycler, reviewer and manager roles; household case if demonstrated | Obvious fictional display names, non-routable/safe placeholder contacts, role/programme scope and reset credentials stored outside source | Real identity/contact/payment details; shared production credentials |
| Fictional recovery records | Happy path, offline/sync, correction, handoff/processing and status-separated dashboard cases | Controlled manifest, stable IDs, creation script/process later, expected events/states/versions, explicit demonstration label | Represent fictional record as real collection/recycling or official report |
| Model outputs | Predetermined category/confidence/version results for demo images, including low-confidence/error fallback | Link to image checksum, model/evaluation version or explicitly `SIMULATED OUTPUT`, timestamp/mode | Invent live inference; use output as weight/value/processing proof |
| Review examples | Reason-coded fictional low-confidence, mismatch, duplicate-signal, unusual-weight or missing-evidence cases | Expected reviewer options/outcome, policy version and statement that a flag is not proof of fraud | Accuse a real person/business; use invented thresholds as accepted policy |
| Processing-evidence examples | Fictional protected references/artefacts sufficient to demonstrate incomplete/complete/review flows | `SIMULATED PROCESSING EVIDENCE`, non-personal image/document rights, checksum, purpose and expected status | Claim actual processing, certification, regulator acceptance or environmental impact |

## Acceptance-volume profile

The SRS defines approximately 5,000 supplied reference images subject to licence and review, 1,000 fictional seeded recovery records, at least 10,000 synthetic metadata records for performance testing, up to six evidence images per record, approximately 8–20 audit events per record, and up to 200 seeded locations. The seven-category/four-language baseline follows the explicit SRS `shall` requirements; see the [documented language inconsistency](../product/srs-traceability.md#srs-interpretation-notes). These volumes are test fixtures and capacity evidence, not mock claims of real programme activity.

## Data manifest

The later demonstration-data manifest should record artefact ID, description, source/owner, fictional/authorised status, licence/consent, classification, purpose, permitted environments, checksum, schema/category/content/model version, expected result, personal-data review, expiry/deletion, approver, and known limitation. Store restricted artefacts outside Git under [Dataset management](../data/dataset-management.md).

## Separation from production

- Use dedicated fictional programme/tenant identifiers and provider accounts.
- Never import or clone future production data into the demo.
- Mark UI, exports, QR records, screenshots and recordings as demonstration where confusion is possible.
- Prevent demo accounts/data from accessing production or triggering real provider effects.
- Delete/reset according to an approved demo retention rule; preserve only authorised submission evidence.

## Safe fictional values

Fictional identities must be obviously non-real in context and contacts must use non-routable/reserved values once formats are selected. Fictional coordinates must not inadvertently identify a real recycler or private residence. Sample amounts/ranges are defined only after programme/product review and are not included in this documentation.

## Approval gate

Before rehearsal, data, privacy, safety-content, ML, programme, licence, and delivery owners review the manifest as applicable. The demo is blocked by missing rights/provenance, real personal data, unapproved safety text, misleading location/price status, active credentials, or records that could be mistaken for real outcomes.
