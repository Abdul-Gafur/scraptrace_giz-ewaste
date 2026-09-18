# Data and label governance

## Scope and status

This document governs proposed computer-vision datasets and labels. The repository contains no challenge dataset or personal images. Operational data is not training data by default.

## Dataset versioning and lineage

Each dataset version uses an immutable manifest with identifier, purpose, sources, custodians, rights/licence, consent or other approved basis, category-guide version, review status, file/record checksums, transformations, exclusions, split assignment, predecessor, creator, approver, and dates. Derived datasets link every output to inputs and transformation code/configuration.

## Label definitions

The seven category definitions require a controlled label guide containing inclusion, exclusion, ambiguity, multiple-item, mixed-scrap, unreadable/out-of-scope, and escalation rules. Examples require redistribution rights. A label-definition change creates a new version and triggers compatibility and evaluation review.

## Annotation quality

- Annotators receive the current guide and scoped training.
- Tools capture annotator, guide version, time, original/proposed label, uncertainty, and reason without unnecessary identity exposure.
- Sampled double review and adjudication are proposed for quality measurement; rates remain to be decided.
- Report agreement, error patterns, unresolved cases, and category balance rather than assuming reviewed labels are perfect.
- Reviewers must be able to abstain or mark out-of-scope.

## Train, validation, and test separation

Assign immutable splits after duplicate/group analysis and before training. Restrict held-out labels and access to prevent tuning. Related images, crops, capture sequences, and other leakage groups remain in one split. Corrections to test data require documented incident handling and a new comparable evaluation plan.

## Duplicate detection

Use proposed exact checksum, metadata, and perceptual-similarity review to identify exact/near duplicates. Automated similarity is a candidate signal, not a final truth or fraud finding. Record decision, reviewer, grouping, and split impact.

## Consent, rights, and personal-data review

Before dataset admission, document source authority, copyright/licence, permitted training/evaluation/distribution, geography/transfer restrictions, retention/deletion obligations, and consent/notice where required. Review images and metadata for people, identifiers, location, device information, documents, or other personal/sensitive content. Minimise, restrict, redact, exclude, or obtain appropriate authority before use. Legal/privacy owners must approve the basis; this document invents none.

## Corrected-label review

A user correction is kept separate from the original model output and operational record. Admission workflow should verify permission for training use, image linkage and integrity, category guide, evidence available to the reviewer, ambiguity, duplicate/split impact, and reviewer decision/reason. Programme-record approval does not itself approve training use.

## Reviewer qualifications and separation

Reviewers need documented knowledge of category definitions, annotation policy, privacy/consent, and conflicts of interest. Specialist input is required where an image cannot be labelled from visual evidence alone. The person creating a proposed correction should not be the sole approver for high-risk or disputed cases. Qualification and quorum rules remain to be decided.

## Approval before retraining

Only a frozen, approved dataset manifest may enter a training run. Data stewardship confirms rights, privacy review, lineage, quality, splits, and checksums; ML ownership confirms compatibility and evaluation design. No service may train directly from an operational correction queue.

## Licence and contributor restrictions

Contributors must not upload scraped, confidential, production, personal, or third-party images without documented authority. Dataset licences may restrict copying, modification, model training, redistribution, commercial use, or derived artefacts; restrictions travel with manifests and releases. Repository access does not imply data rights.

## Audit and withdrawal

Audit dataset creation, access approvals, label/adjudication changes, split changes, exports, training use, archival, and withdrawal. If rights, consent, privacy, or label integrity becomes invalid, quarantine affected data, identify derived datasets/models, stop unauthorised new use, and follow an approved impact/retraining/withdrawal process.

## Non-negotiable rule

Unreviewed user corrections, raw operational uploads, and unapproved derived labels must never feed training automatically or immediately.
