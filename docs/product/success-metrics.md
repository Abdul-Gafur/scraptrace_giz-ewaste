# Success metrics

Metrics are grouped by what can be demonstrated now and what requires later evidence. No baseline, sample size, or numeric target is accepted in Phase 1 unless stated in the Concept Note; owners must propose them with an evaluation plan.

## Prototype demonstration success

- A user completes the required journey from in-app capture to processing evidence without a technical explanation.
- The demonstration covers all twelve steps in [Prototype scope](prototype-scope.md).
- A record created offline remains visible, later synchronises, and does not duplicate after retry.
- Low-confidence output is visible and correctable.
- Missing approved safety content or LLM connectivity produces a controlled fallback rather than invented advice.
- A listing's type and verification status are distinct.
- Verified dashboard totals exclude incomplete, flagged, rejected, and unsynchronised records.

Evidence: scripted demonstration results, state-transition checks, screenshots or recordings, and known-issue log. Target: all critical demonstration scenarios pass; detailed criteria remain **proposed** until test design.

## Model evaluation

- Per-category classification metrics and confusion patterns for all seven categories.
- Calibration or confidence-quality assessment, especially for low-confidence routing.
- Performance slices for documented conditions such as lighting, occlusion, damage, and capture device where the dataset supports them.
- Correction rate and reasons during controlled evaluation.
- Duplicate-image detection behaviour, reported separately from classification.

Dataset provenance, splits, sample sizes, metric choice, acceptance thresholds, and independent review are **to be decided**. No single accuracy number should represent unsupported field performance.

## User experience

- Task completion and time for image capture, correction, guidance access, location selection, and record creation.
- Comprehension of confidence, price-estimate limitations, safety warnings, record status, and location type.
- Accessibility results and task success on the agreed phone/browser matrix.
- Language-review findings for English, French, Arabic, and Portuguese.
- User-reported clarity, trust, and effort from collectors and household users.

Targets require usability testing with representative users and should not be inferred from internal demonstration.

## Verification process

- Percentage and reasons for records flagged, completed, approved, rejected, or awaiting information.
- Reviewer time and agreement on controlled cases.
- Detection results for seeded duplicate, mismatch, unusual-weight, and missing-evidence scenarios.
- Traceability from collection evidence to handover, measured weight, and processing outcome.
- Rate of idempotent retry and conflict scenarios resolved without duplicate canonical records.

These measures evaluate workflow operation, not proof that all fraud is detected or all processing is safe.

## Later pilot measurements

- Completed handoffs and verified measured weight by authorised category, time, and area.
- Time from collection record to receipt and completed processing evidence.
- Directory usefulness, travel burden, failed destination attempts, and areas with unmet search demand.
- Collector and recycler satisfaction, participation, retention, and operational burden.
- Safety-guidance comprehension and reported handling decisions.
- Model performance and correction patterns under real field conditions.
- Programme review workload, data completeness, duplicate indicators, and reconciliation gaps.
- If an authorised incentive exists: eligibility, payment instruction outcomes, failures, timeliness, and whether the model affects normal scrap income.

Pilot metrics require consent, privacy controls, definitions, baselines, and an approved evaluation design.

## Claims requiring field evidence

Until suitable field testing and independent review, ScrapTrace cannot claim that it:

- increases collector income or guarantees a price, buyer, bonus, or payment;
- reduces unsafe handling, exposure, dumping, burning, or environmental harm;
- increases collection or recycling volume;
- proves or guarantees safe recycling;
- detects all duplicate, inaccurate, or fraudulent records;
- provides accurate classification for all people, devices, locations, or e-waste;
- certifies a scrapyard, collection point, or recycler;
- produces regulator-accepted reports, EPR credits, or environmental results.
