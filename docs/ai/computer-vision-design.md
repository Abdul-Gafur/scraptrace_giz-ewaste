# Computer-vision design

## Status and objective

This document proposes how `services/vision` could support category suggestion. No dataset has been inspected in this repository, no task type is confirmed, and no model is implemented or trained.

## Supported hackathon categories

The Concept Note names seven groups:

1. refrigerators;
2. laptops and desktop computers;
3. televisions;
4. microwaves;
5. air conditioners;
6. compressors; and
7. mixed scrap.

Category definitions, inclusion/exclusion examples, hierarchy, ambiguous cases, and the treatment of multiple visible categories require a versioned label guide and subject-matter review.

## Classification versus object detection

The initial task should not be assumed to be object detection. Object detection requires suitable bounding-box or equivalent spatial annotations; the Concept Note confirms images and group labels only. Dataset inspection must determine annotation type, image composition, label quality, rights, and whether classification, multi-label classification, detection, or another formulation is supportable. This is a decision requiring an ADR or recorded model-design decision before training.

## Intended input

Proposed input is an authorised in-app image plus only the technical metadata required for preprocessing, audit, and routing. Identity, precise location, price, and programme outcome should not be model features unless a separately approved design proves necessity and fairness. Input validation should cover format, decodability, bounds, and safe processing without claiming image authenticity.

## Intended output

The inference contract should return:

- suggested category from the versioned supported set;
- bounded confidence or calibrated score with defined meaning;
- model and category-definition versions;
- inference/contract version and time;
- low-confidence or unsupported-input indication; and
- a controlled error when inference cannot safely complete.

The score is uncertainty information, not a probability guarantee unless calibration supports that interpretation.

## User correction and low confidence

The interface must show the suggestion and confidence in understandable language and permit confirmation or correction. Low confidence, out-of-scope input, or invalid input must route to manual selection or review rather than forced acceptance. Thresholds are versioned policy and remain **to be decided** through evaluation and review capacity.

The original output, version, and correction remain separate. A correction is a candidate label only after permission and qualified review; it never updates the deployed model immediately.

## Version tracking

Each release should have an immutable model version, artefact checksum, code revision, framework/runtime, preprocessing version, category-definition version, training dataset manifest, configuration, evaluation report, approver, release date, and rollback reference. Every inference retained in a recovery record should identify the deployed version.

## Edge versus server inference

| Concern | Server inference | Edge inference |
|---|---|---|
| Connectivity | Requires upload/connectivity | May operate offline after secure provisioning |
| Privacy | Transfers an authorised image | May reduce transfer but stores model/device artefacts |
| Update control | Central rollout/rollback | Version drift and device update handling required |
| Resources | Central compute | Device memory, latency, battery, browser/runtime constraints |
| Monitoring | Central observability | Deferred telemetry and limited diagnostics |

Neither mode is accepted. Edge use requires conversion-parity, integrity, device compatibility, size, latency, energy, privacy, update, and fallback validation. Server use requires upload privacy, cost, latency, availability, and retention controls. A hybrid must make the executing model/version visible.

## Offline behaviour

Offline capture and local record creation remain available as defined by [Offline-first design](../architecture/offline-first-design.md). Without an approved edge model, inference remains pending and the user may select a category manually. Cached previous predictions must not be applied to a new image. A local save is not server inference or verification.

## Proposed training workflow

1. Confirm dataset rights, purpose, annotation form, personal-data review, and category guide.
2. Create an immutable dataset manifest and leakage-resistant train/validation/test split.
3. Establish simple baselines before complex models.
4. Record code, configuration, preprocessing, seed, environment, hardware, and nondeterminism.
5. Train only on approved training data; never inspect the held-out test set to tune choices.
6. Evaluate error patterns, calibration, category slices, latency, size, and field limitations.
7. Obtain ML, data, privacy, and responsible-AI release review.
8. Register the immutable artefact and rollback target; deploy only through a later approved process.

## Evaluation and update workflow

Evaluation follows [Model evaluation](model-evaluation.md). A proposed update must compare against the current baseline on the same protected evaluation suite, document new data lineage, investigate regressions, retest thresholds and deployment targets, and receive release approval. The old version remains available for rollback subject to retention and security policy. Emergency withdrawal is permitted for safety, privacy, integrity, or severe performance concerns.

## Human review

Qualified data/model reviewers assess ambiguous labels, user corrections, duplicates, consent/rights, and release evidence. Programme reviewers separately assess recovery-record evidence. Model reviewers cannot certify recycler status or recycling outcomes through an image decision.

## Image-only limitations

A photograph cannot reliably determine:

- exact weight;
- hidden materials;
- internal damage;
- full working condition;
- exact scrap value; or
- whether processing actually occurred.

Images may also be affected by framing, lighting, occlusion, damage, multiple items, background clutter, device variation, reused photographs, and categories absent from the supported set. These limits must be visible in documentation and relevant user interfaces.
