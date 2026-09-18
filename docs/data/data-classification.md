# Data classification

## Status and use

This is a proposed four-level classification scheme. Legal/privacy, programme, and security owners must approve it before operational data is collected. Classification follows the most sensitive combined field; aggregation or pseudonymisation does not automatically lower a class.

## Levels and handling

| Class | Definition | Proposed handling |
|---|---|---|
| Public | Approved for unrestricted disclosure | Owner approval before publication; integrity/version controls; no hidden personal or confidential metadata |
| Internal | Low-sensitivity project information not intended for public release | Authenticated team access where appropriate; standard integrity, backup, and sharing controls |
| Confidential | Disclosure could harm a person, programme, partner, or operations | Need-to-know role/programme access; encryption in transit/at rest when implemented; controlled export, logging, retention, and third-party transfer |
| Restricted | High-impact personal, credential, evidentiary, security, or financial data | Explicit authorised roles; strong separation/audit; minimum collection; protected storage; strict transfer/retention/deletion; no general analytics or logs |

## Proposed classification by data type

| Data type | Default class | Notes |
|---|---|---|
| Published product documentation and approved public safety cards | Public | Only approved versions; source/licence obligations remain |
| Public location-directory fields | Public | Type/status/freshness must be accurate; verification evidence may not be public |
| Aggregate public dashboard output | Public after approval | Must remove identity and pass disclosure/small-group review |
| Internal architecture, test plans, category definitions | Internal | Security-sensitive details may be Confidential |
| Model aggregate evaluation reports | Internal by default | Public release needs dataset/privacy/licence and claim review |
| User account/profile and contact details | Confidential | Authentication secrets/recovery factors are Restricted |
| Collector profile and programme membership | Confidential | Payment/mobile-money references, if future-authorised, are Restricted |
| Approximate collection location linked to a record/person | Confidential | Precise location or vulnerable-person implications may be Restricted |
| Raw image and handoff/processing evidence | Restricted | May contain people, identifiers, location metadata, or sensitive operational evidence |
| Recovery record and journey history | Confidential | Restricted fields remain field-level Restricted; access is programme/resource scoped |
| Category prediction and correction linked to a record | Confidential | Dataset candidate copy stays Restricted until governed review/minimisation |
| Safety-guide request/response linked to a user/record | Confidential | Approved source card alone may be Public; provider payload/logs are restricted by policy |
| Weight and final-price records | Confidential | Future financial instructions/details are Restricted |
| Review decisions and evidence | Restricted | Rationale can reveal fraud signals, identity, or sensitive evidence |
| Audit events | Restricted | Privileged/security history; never public operational telemetry |
| Operational logs/metrics | Internal by default | Any personal identifiers, precise location, content, or credentials are prohibited or Restricted and should be excluded |
| API keys, tokens, private keys, passwords | Restricted | Secrets-management rules apply; never committed or logged |
| Raw/curated training and evaluation datasets | Restricted by default | Rights, personal-data, licence, and redistribution review required before any reclassification |
| Model artefacts and prompt/policy files | Internal by default | Restricted when exposure enables abuse, leaks data, or bypasses safeguards |

## Handling dimensions

For each data type, the future data inventory must define owner, purpose, fields, source, classification, allowed roles, storage/region, encryption/key expectations, logging, export/sharing, provider transfer, retention/deletion, backup, data-subject handling, incident impact, and approved reclassification process.

## Local and test data

Restricted or Confidential production data must not be copied to local development, test fixtures, screenshots, demonstrations, issue trackers, or documentation. Use synthetic or explicitly licensed, non-personal examples with provenance. Local offline production data, if later permitted, retains its classification and requires device threat, encryption, expiry, logout, backup, and loss controls.

## Reclassification

Only the accountable data/privacy owner may lower classification after documented verification of redaction, aggregation, purpose, group-size/disclosure risk, licence, and downstream copies. Deletion or hashing alone may not remove identifiability. Classification increases apply immediately when new sensitivity is discovered.
