# Dataset management

## Scope and status

This document defines the proposed operational controls for ML datasets. No dataset is stored in this repository. The `data/` directory may contain only authorised small samples and governance metadata under its [ownership rules](../../data/README.md).

## Storage

- Store restricted datasets in an approved access-controlled data store, not Git, ordinary object buckets, personal drives, notebooks, or developer devices by default.
- Separate raw/source, quarantined, curated, split, derived, and archived areas with immutable manifests.
- Use encryption, region, backup, deletion, integrity, malware/content handling, and audit controls appropriate to [data classification](data-classification.md).
- Object/storage technology and location remain to be decided.

## Access

Grant least-privilege, time-/purpose-bounded access by dataset and role. Data stewards approve access after rights, privacy training, purpose, environment, and export needs are checked. Review and revoke access on role change, project end, incident, or inactivity. Audit grants, reads/exports where proportionate, changes, and denials without exposing dataset content in logs.

## Versioning and checksums

Every released dataset version is immutable and identified by manifest version/checksum. Record file-level or shard checksums, count/size, schema, category-guide version, source versions, transformations, exclusions, duplicate groups, split assignment, and predecessor. A correction creates a new version; do not mutate a released dataset in place.

## Licence and permitted use

Record owner/licensor, licence text/version, allowed training/evaluation, modification, redistribution, publication, commercial use, geography, attribution, model/derived-data terms, expiry, and deletion/withdrawal duties. Access to a challenge dataset does not imply redistribution or future production rights. Legal/data-owner review is required before use.

## Metadata and datasheets

Maintain a dataset card/datasheet describing purpose, sources, collection context, population/coverage claims, category definitions/distribution, annotation process/quality, personal-data review, consent/rights, known biases/gaps, transformations, splits, intended/prohibited uses, evaluation limits, contacts/owners, and change history. Unknown information is marked unknown, not inferred.

## Splits and leakage

Create leakage-resistant train/validation/test manifests using grouping appropriate to capture sequences, duplicates, contributor/location/time, and derived images. Freeze test access and prohibit tuning against it. Exact and perceptual duplicate review precedes split. Split changes require version, rationale, impact, and evaluation comparability decision.

## Derived datasets

Derived outputs retain lineage, source restrictions, transformation code/config/version, environment, checksum, reviewer, and compatibility. Crops, embeddings, augmentations, redactions, translations, pseudo-labels, and corrected labels do not escape source licence/privacy obligations merely because transformed. Generated/pseudo-label data is explicitly marked and cannot replace human-reviewed ground truth without an approved protocol.

## Personal-data review

Before curation and each release, inspect images/metadata for people, faces, identifiers, documents, location/device metadata, account links, and other sensitive content using approved human/tool processes. Record the review result and action: exclude, minimise/redact, restrict, or use under an approved basis. Redaction quality must be verified and originals remain governed.

## Contributor restrictions

Contributors must not add scraped, confidential, production, personal, or third-party images/labels without documented authority. They must provide provenance, rights, consent/notice state, collection purpose, category guide, and conflict disclosure. User corrections enter quarantine/review, not a training folder. No data is exchanged through issues, chat, email, or pull requests unless explicitly approved for that channel/class.

## Reproducibility

A training/evaluation run references immutable data manifests/checksums, code revision, environment/dependencies, preprocessing, configuration, seed, hardware/runtime, and known nondeterminism. Another authorised reviewer should be able to reconstruct the data selection without copying unauthorised data into a new location.

## Archiving and withdrawal

Archive versions only when licence, consent, retention, security, and reproducibility needs permit. Archives remain encrypted, access-controlled, integrity-checked, discoverable, and subject to review/deletion. On rights, consent, privacy, or integrity withdrawal, quarantine affected records, stop new use, trace derived datasets/models, record decisions, and follow an approved deletion/retraining/model-withdrawal plan.

## Required decisions

Dataset custodian, storage region/provider, licence interpretation, access roles, approved environments, personal-data method, quality sampling, split grouping, archive/retention periods, incident handling, and effect of data withdrawal on released models require data, ML, legal/privacy, security, and programme approval.
