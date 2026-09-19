# Incident response

## Status and purpose

This is a proposed response process. No incident platform, on-call schedule, contact list, response target, or production service exists. Do not invent contacts: use the private project channel or project lead until owners are assigned, consistent with [SECURITY.md](../../SECURITY.md).

## Incident categories

- Service availability or severe performance degradation
- Security vulnerability, unauthorised access, abuse, or dependency compromise
- Secret/key exposure
- Personal-data or restricted-evidence exposure
- Data loss, corruption, duplicate effects, or audit-integrity failure
- Unsafe LLM output, grounding/validation failure, or prompt injection
- Incorrect, expired, compromised, or withdrawn safety content
- Computer-vision failure, harmful regression, version mismatch, or model abuse
- Verification fraud or systematic evidence manipulation
- Provider, deployment, configuration, migration, or offline-sync failure

One incident may have multiple categories and require different specialist owners.

## Severity levels

| Severity | Proposed criteria | Response target |
|---|---|---|
| SEV-1 Critical | Ongoing risk of serious user/safety harm, broad restricted-data exposure, active compromise, unrecoverable evidence loss, or critical service loss during authorised operation/demo | Immediate mobilisation; numeric target to be approved |
| SEV-2 High | Major journey unavailable, material security/privacy exposure contained but unresolved, unsafe AI/content path, or significant verification integrity impact | Urgent coordinated response; target to be approved |
| SEV-3 Moderate | Limited users/records affected, degraded fallback available, contained incorrect output, or non-critical operational failure | Prompt owner-led response; target to be approved |
| SEV-4 Low | Minor defect with no known safety, privacy, evidence, or material service impact | Normal prioritised workflow |

Severity can increase as evidence changes. When uncertain about safety, privacy, or active compromise, start higher and reassess.

## Roles

Assign an incident coordinator, technical responders, communications owner, recorder/timeline owner, and relevant security/privacy, safety-content, ML/data, programme, or legal decision makers. One person may cover multiple roles for the hackathon release only with explicit clarity. Named people and escalation paths are to be assigned.

## Response lifecycle

### 1. Reporting and initial triage

Open a restricted incident record; note reporter, UTC time, observed behaviour, affected environment/version, users/data/records, current status, and safe correlation IDs. Do not copy secrets, personal data, unsafe content, or full evidence unnecessarily. Assign severity, coordinator, next update time, and immediate safety/privacy concerns.

### 2. Containment

Prefer reversible actions: disable a feature/provider/model/content version, revoke credentials, restrict access/export, pause deployment/sync, quarantine data/artefacts, switch to approved fallback, or isolate an environment. Preserve user work and evidence where safe. Do not destroy forensic evidence or conceal status.

### 3. Investigation

Build a UTC timeline; identify source revision, deployment/config/contract/model/prompt/card/dataset versions, actors, records, providers, and affected copies. Form and test hypotheses using minimum authorised data. Distinguish root cause from trigger and contributing controls. Preserve chain of custody for restricted evidence.

### 4. Recovery

Remove/mitigate cause, validate integrity, rotate credentials, restore from verified sources, deploy approved fix/rollback, reconcile duplicate/offline operations, and run critical journey/security/privacy/AI checks. Monitor for recurrence. Recovery is not complete merely because the service responds.

### 5. Communication

Provide factual updates: what is known, affected scope, user action if any, containment/recovery, uncertainty, and next update. Do not speculate, blame, expose personal/security detail, or claim regulatory impact without authority. Legal/privacy, programme, safety, provider, organiser, and affected-user notifications require the relevant owner.

### 6. Resolution and post-incident review

Record resolution criteria and residual risk, then write a blameless review covering impact, detection, timeline, cause/contributors, response, what helped/hindered, and owned actions with priority/due date. Update threat model, tests, runbooks, controls, training, and documentation. Publish only an approved sanitised summary.

## Category-specific first actions

| Incident | Proposed immediate considerations |
|---|---|
| Secret exposure | Revoke/rotate at issuer immediately; assess use and downstream credentials; never paste secret into incident record |
| Personal-data exposure | Stop further disclosure; preserve access evidence; identify data/people/providers/copies; involve privacy/legal decision owner |
| Unsafe LLM output | Disable generation/version or route to approved source/fallback; preserve minimum versions/result safely; evaluate related categories/languages |
| Incorrect safety content | Withdraw affected card/version; stop retrieval/generation; activate approved fallback; assess caches/offline bundles and responses |
| Model failure | Disable/rollback version or require manual category selection; preserve evaluation/runtime evidence; assess records influenced by it |
| Verification fraud | Freeze affected verification/reporting/future incentive use; preserve original evidence; restrict implicated access; avoid assuming flags prove fraud |
| Service outage | Identify failed dependency/version, preserve queued local work, activate safe degradation, restore health and reconcile pending operations |

## Evidence preservation

Preserve only authorised relevant logs, audit events, immutable artefact/config/version references, timestamps, access history, checksums, and provider notices. Control access and record collection/copy/analysis. Do not alter source evidence, overcollect unrelated user data, or retain incident snapshots without a disposal rule.

## Readiness decisions

Assign incident contacts/authority, severity/response targets, secure coordination channel, notification/legal process, forensics access, status communication, after-hours ownership, provider escalation, evidence retention, and exercise cadence before a pilot or production launch.
