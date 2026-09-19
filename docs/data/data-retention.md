# Data retention

## Status and principles

The SRS sets non-production application baselines below; they are not statutory periods. No production data or retention mechanism exists. Field/pilot durations, exceptions, archival and rights processes still require legal/privacy and programme approval.

## SRS application baseline

| Data class | Retention baseline | End action |
|---|---|---|
| Abandoned local draft | 30 days since last edit, with warning | Delete from device |
| Submitted recovery/evidence record | Demonstration/review period; default 12 months in non-production | Authorised logged archive/delete |
| Rejected record | Same as submitted unless approved programme policy differs | Archive/delete while retaining minimum justified non-personal audit proof |
| LLM request/response | 90 days by default; no personal data | Delete content and retain only justified aggregate quality metrics |
| Training-consented correction | Only after human approval and inclusion in a documented dataset version | Withdraw where feasible and record dataset impact on consent revocation |
| Logs | 30–90 days according to log type; no secrets or raw images | Automatic deletion |

Retention must be purpose-specific, minimal, documented, enforceable across primary storage, offline devices, caches, backups, logs, providers, exports, and derived datasets. “Keep indefinitely” is not an acceptable default. Audit or verification needs do not automatically justify retaining every source object.

## Extended retention register

| Data class | Purpose and retention considerations | End-of-period action | Required approval |
|---|---|---|---|
| User profiles | Account operation, language, access and support; consider last activity, active records, disputes, security holds, and required identity separation | Delete, deidentify, or retain minimum locked reference under approved exception | Legal/privacy, security, programme |
| Images | Capture/handoff/processing evidence; high privacy/storage risk; distinguish operational evidence from separately approved training copy | Delete object and derivatives/caches/provider copies; retain only approved integrity/reference metadata if justified | Legal/privacy, programme verification, data owner |
| Location data | Discovery and approximate collection evidence; precision and linkage drive risk | Delete or aggregate to approved geography; remove device/provider caches and precise fields first | Privacy, product, programme |
| Recovery records | Evidence journey, user access, review, reporting, dispute; separate incomplete/rejected/approved programme needs | Delete/deidentify/lock according to programme/legal rules while preserving authorised history relationships | Programme, legal/privacy, audit |
| Audit records | Accountability, security investigation, evidence integrity; may require longer restricted retention than operational logs | Secure expiry or archive with access/integrity controls; no silent alteration | Security, legal, audit/programme |
| LLM requests/responses | Deliver/cache validated transformations and investigate safety issues; minimise or avoid content logging | Expire cached generation/provider copies; retain privacy-safe version/outcome metrics only if justified | Safety, privacy, security, provider owner |
| Corrected labels | Operational correction and possible training candidacy are separate purposes | Delete with operational record rules or transfer only an approved minimised copy into governed dataset | Data/ML, privacy, programme |
| Model-training data | Reproducibility/evaluation under licence, consent, and rights; consider withdrawal and derived artefacts | Archive with controlled access or securely delete/quarantine; assess derived models/manifests | Data steward, legal/privacy, ML owner |
| Deleted accounts | Honour deletion while managing active disputes, audit, fraud/security, and linked programme evidence lawfully | Remove direct profile/authentication data; use minimum restricted tombstone/pseudonymous reference only if approved | Legal/privacy, security, programme |

## Lifecycle requirements

Before a data type is collected, record purpose, start event, duration/event-based rule, owner, class, locations/copies, legal/programme basis, deletion method, exceptions/holds, notification, and verification test. Retention clocks may differ for drafts, submitted, rejected, completed, and approved records but must not be inferred without approval.

## Offline data and caches

Define device expiry, storage quotas, cache version/withdrawal, logout/account-switch clearing, failed-sync handling, device loss, operating-system backups, and user-visible controls. Deleting a server record does not automatically delete an offline copy; synchronised deletion/tombstone behaviour requires design and testing.

## Backups and third parties

Backup retention, restore behaviour, deletion propagation, encryption, access, and expiry must be documented. Where immediate removal from immutable backups is infeasible, restored data must reapply deletion before normal use under an approved policy. Contracts with LLM, map, storage, monitoring, and future providers must limit retention/use and support deletion evidence appropriate to the data class.

## Holds and exceptions

Legal, safety, security, dispute, or programme holds require authorised scope, reason, start, owner, review/expiry, access restriction, and audit event. A hold applies only to necessary data and does not permit new purposes such as model training.

## Deletion and deidentification verification

Deletion includes primary objects, indexes, thumbnails/derivatives, local caches, exports, queued jobs, provider copies, and derived datasets where required. Verify outcomes through auditable jobs/reports without logging the deleted content. Deidentification must be risk-assessed for linkage, rare locations/categories, and small groups; pseudonymisation remains personal data where re-linking is possible.

## Decisions required

Applicable law/data-controller roles, lawful bases/consent, user rights, age/vulnerable-person handling, period per data/state, location precision, audit exception, backup/provider deletion, model withdrawal effect, and programme evidence obligations all remain to be decided by competent owners.
