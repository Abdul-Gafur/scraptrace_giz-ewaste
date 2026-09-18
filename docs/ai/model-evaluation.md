# Model evaluation

## Status and objective

This is a proposed evaluation framework. No dataset or model has been evaluated. Metrics and acceptance thresholds must be selected after dataset inspection, risk analysis, baseline experiments, and reviewer-capacity assessment.

## Dataset separation

- Create immutable train, validation, and held-out test manifests before tuning.
- Group related captures, near duplicates, source events, contributors, or locations where needed so correlated images do not cross splits.
- Use training data to fit parameters, validation data to choose models/thresholds, and the test set only for release evaluation.
- Maintain a separate, governed field/challenge set for documented real-scrapyard conditions where rights permit.
- Record exclusions, missing metadata, category distribution, personal-data review, rights, and checksums.

## Leakage prevention

Detect exact and perceptual duplicates before splitting; investigate filenames, capture sequences, derived crops, augmentation ancestry, contributor/location/time correlations, and prior benchmark reuse. Preprocessing statistics must be fit on training data only. Reviewers must not tune against held-out failures without creating a new versioned evaluation protocol/set.

## Measures

| Measure | Proposed use and caveat |
|---|---|
| Overall accuracy | Broad baseline only; may hide category imbalance |
| Precision | How often predictions for a category are correct under the evaluated set |
| Recall | How often examples of a category are found under the evaluated set |
| F1 score | Balance of precision and recall; report averaging method |
| Confusion matrix | Identify systematic category confusion and review needs |
| Per-category performance | Mandatory; include sample count and uncertainty intervals where feasible |
| Confidence calibration | Compare score to observed correctness using accepted calibration measures/plots |
| Low-confidence rate | Estimate manual-selection/review burden at a versioned threshold |
| Inference latency | Distribution on named server/device targets, including preprocessing |
| Model size | Stored/downloaded and runtime memory footprint as relevant |
| Edge compatibility | Conversion parity, supported operators, latency, memory, energy, and integrity/update fit |
| Real-condition slices | Performance under documented lighting, clutter, occlusion, damage, multiple items, and device conditions when data supports the slice |
| Failure analysis | Qualitative review of errors, out-of-scope input, harmful downstream risk, and missing data |

Metric definitions, averaging, confidence intervals, and sample sufficiency must be recorded. Do not compare scores computed from different splits or category definitions as if directly equivalent.

## Baseline comparison

Establish a simple, reproducible baseline before selecting a complex model. Every candidate is compared on the same manifests, preprocessing contract, metrics, device/runtime conditions, and statistical reporting. Improvements in aggregate score do not justify category, calibration, latency, size, privacy, or accessibility regressions without explicit risk approval.

## Acceptance thresholds

Thresholds for release, low-confidence routing, category floors, calibration, latency, size, and edge performance are **to be decided through testing**. Selection must consider user comprehension, consequences of misclassification, fallback quality, human-review capacity, category imbalance, target devices, connectivity, and prototype versus pilot scope. Thresholds are versioned policy, not embedded unexplained constants.

## Real scrapyard conditions

Evaluation should represent the documented Ghanaian scrapyard context without claiming national representativeness. Record source locations and capture conditions only where lawful and necessary. Evaluate field shifts and unsupported inputs; do not infer fairness or generalisation from the challenge set alone. Representative field testing requires consent, rights, privacy review, and programme approval.

## Release approval

A release package should include model/data/category/preprocessing versions and checksums, reproducible configuration/environment, complete results, calibration/threshold decision, failure examples with safe access, privacy/bias analysis, runtime/device results, known limitations, rollback target, and sign-off from ML, data, responsible-AI, privacy/security, and product owners as applicable.

No model is released because one metric improved. A release is blocked by uninvestigated leakage, invalid rights, missing category results, unsafe uncertainty handling, unreviewed severe regressions, or absence of rollback/version traceability.

## Regression evaluation

Every new model, dataset, category definition, preprocessing change, runtime conversion, or threshold policy reruns the protected evaluation suite and compares with the deployed baseline. Track category and slice regressions, calibration, low-confidence volume, latency, size, and conversion parity. New field failures may enter a separately governed regression set only when rights and test-integrity rules allow it.

## Post-release monitoring

Proposed monitoring includes version distribution, inference failures, confidence/low-confidence distributions, user corrections after review, category mix, drift indicators, latency, fallback use, and complaints. Monitoring must avoid collecting unnecessary images or personal/location data. Observed correction is not ground truth until reviewed. Alert rules and withdrawal criteria require approval before operation.
