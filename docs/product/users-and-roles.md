# Users and roles

The [approved SRS](<ScrapTrace_Software_Requirements_Specification (2).docx>) defines six seeded application roles. Household users use the collector access path for the baseline. Scrapyard staff use the recycler role when authorised for intake. A person may hold more than one role only when policy permits; server-side permissions, programme/location scope and separation of duties still apply.

## Collector including household user

- **Goal:** Identify an item, understand safe next steps, find a receiving location and retain a record of delivery.
- **Main actions:** Select language; grant contextual permissions; capture/retake; confirm or correct category; view guidance, estimate and locations; create item/batch record; present QR; view own journey.
- **Visible information:** Own records, prediction/confidence, approved guide metadata, estimate inputs, participating-location profiles and permitted handoff outcome.
- **Restrictions:** Cannot confirm own handoff/processing, approve safety content or corrections, verify locations, view other users' records, or treat estimates as offers.
- **Verification responsibility:** Confirm user-supplied category, count/weight, condition and approximate area; separately opt in to any future training reuse.

## Recycler operator

- **Goal:** Independently receive an item or batch and record measured facts and processing evidence.
- **Main actions:** Scan QR or enter short code; compare permitted evidence; confirm category/condition; record weight/unit and final price/currency; upload handoff/scale evidence; record processing result; respond to information requests; view authorised receiving history.
- **Visible information:** Intake details and non-sensitive evidence for records received at assigned locations.
- **Restrictions:** Cannot see collector contact or precise collection coordinates without a separately authorised need, overwrite original assertions, decide a disputed review, or claim legal certification.
- **Verification responsibility:** Record receiver, receiving location, server/client times, measurement, final price and configured evidence accurately.

## Programme reviewer

- **Goal:** Resolve named flags and determine whether a record is usable under programme rules.
- **Main actions:** Review reasons, category history, estimates, measurements, evidence, locations, audit events and relevant versions; approve, request information or reject with reason.
- **Visible information:** Minimum evidence required for assigned programme cases.
- **Restrictions:** Cannot erase source evidence, treat a flag as proof of fraud, expose reviewer-only information, alter safety content or access unrelated records.
- **Verification responsibility:** Apply documented rules consistently and create a reasoned, attributable decision.

## Programme manager

- **Goal:** Maintain reference data and understand programme activity and approved outcomes.
- **Main actions:** Manage seeded location and price-reference data; approve location profiles for the programme badge; view assigned aggregate dashboard, filters, freshness, network-gap counts and traceable source records.
- **Visible information:** Programme-scoped aggregates and records with precise/private fields minimized.
- **Restrictions:** Cannot include non-approved states in verified totals, infer field impact without evidence, or confer universal legal/regulatory approval.
- **Verification responsibility:** Keep reference data current and ensure definitions, access scope, verification badges and any simulated incentive rule are authorised.

## Safety and content administrator

- **Goal:** Keep public safety guidance and translations controlled, current and traceable.
- **Main actions:** Create, version, review, approve, publish, retire and withdraw cards and language bundles; maintain sources and fixed emergency wording.
- **Visible information:** Content workflow, source, version, language, approval/review metadata and validation results.
- **Restrictions:** Cannot publish unreviewed facts, use the LLM as a source, grant programme verification or access unrelated personal records.
- **Verification responsibility:** Ensure only current `Approved` content is eligible for display/grounding and that released translations preserve meaning.

## Data and ML reviewer

- **Goal:** Assess corrections and curate only consented, authorised examples for a future versioned dataset.
- **Main actions:** Compare image, model scores, user label, recycler label, consent, provenance and duplication; approve/reject corrections; support dataset manifests and evaluation.
- **Visible information:** Minimum image/label/model/consent metadata needed for assigned review.
- **Restrictions:** Cannot train or deploy directly from user input, reuse data without permission, decide programme recovery approval or access unrelated identity data.
- **Verification responsibility:** Preserve original predictions and reviewer outcomes and approve only correctly labelled, permitted examples.

## Supporting operational administration

Infrastructure and identity administration is an operational responsibility, not one of the six seeded baseline roles in FR-ACC-001. If an administrator role is later exposed in the application, it requires a new access-control decision, least privilege, audited elevation and no automatic authority over safety content, labels, programme decisions or regulatory status.

## Visibility summary

| Capability | Collector | Recycler | Reviewer | Manager | Content admin | Data reviewer |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Own capture and records | Create/view | Intake subset | Assigned cases | Scoped oversight | No | Assigned correction subset |
| Handoff and processing | View outcome | Create | Review | Scoped view | No | Label comparison only |
| Programme decision | No | No | Decide | View/govern policy | No | No |
| Dashboard totals | Own journey only | Location history | Assigned scope | Programme scope | No | Model-quality views only |
| Safety-card publication | Read | Read | Read | Read | Approve/publish | Read when needed |
| Training-data admission | Consent only | Supporting label | No | No | No | Review/approve |

## Location-status rule

A directory entry can be a participating scrapyard, collection centre or recycler. Listing never means universal approval. Only a programme-reviewed profile may display the programme's verified-location badge, and the badge is not recycler certification or statutory approval.
