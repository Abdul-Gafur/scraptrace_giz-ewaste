# Environments

## Status and principles

All environments below are **proposed and not provisioned**. No hosting provider, region, domain, identity system, database, storage, secret store, or deployment method is selected. Environments must be isolated by configuration, credentials, data, access, and provider accounts; names alone do not provide isolation.

## Environment matrix

| Environment | Purpose | Expected data | Access expectations | Configuration and secrets | Deployment approval | Current status |
|---|---|---|---|---|---|---|
| Local development | Individual development, unit/component work, and safe offline experiments | Synthetic or explicitly licensed minimal samples only; no production personal data, real credentials, or unrestricted challenge images | Assigned contributor on managed/personal device under future developer policy | Checked-in non-secret defaults plus an approved local secret mechanism; low-privilege non-production provider accounts if needed | Contributor may run approved local changes; dependency/tool installation follows engineering approval | Proposed; not provisioned or configured |
| Shared development | Integrate branches/contracts and exercise service interactions before formal testing | Synthetic controlled data; approved restricted test data only when a governed environment exists | Authenticated project team; role separation where practical; no public access by default | Environment-specific validated configuration and dedicated secrets; never shared with local/staging/production | Component owner or delegated maintainer after review and basic checks | Proposed; not provisioned |
| Testing or staging | Production-like acceptance, security, accessibility, offline, migration, model/LLM, and demo rehearsal | Controlled fictional demo data and approved evaluation assets; never copied production data by default | Named team/reviewers and, when authorised, organisers; least privilege and audit appropriate to sensitivity | Separate accounts/credentials/configuration; production-like topology where useful without production authority | Release owner plus required product, security/privacy, AI/safety, and data approvals | Proposed; not provisioned |
| Production | Future field or programme operation after pilot/production authorisation | Real user/programme data only after legal, privacy, security, retention, and programme approval | Verified users and tightly controlled administrators; programme/resource-scoped permissions and audited privileged access | Managed secrets/keys, environment-specific provider accounts, change control, backup/recovery, monitoring, and documented configuration ownership | Formal production release authority and change process **to be decided** | Future only; not approved or provisioned |

## Data movement

- Do not copy production data downward into staging, shared development, or local environments.
- Promote code, contracts, configuration definitions, migrations, models, prompt/policy, and safety-content artefacts—not mutable environment data.
- Demo/evaluation data needs provenance, licence, classification, and approved destination.
- Exports between environments require owner approval, minimum scope, integrity checks, and audit where sensitive.
- A staging result does not prove production readiness or field impact.

## Configuration

Configuration schemas and safe defaults may be shared through `packages/configuration` after implementation approval. Values remain environment-specific and validated at startup. Feature flags, provider endpoints, public origins, retention, model/content versions, and operational thresholds require explicit owners. Secrets are never stored in shared configuration or source.

## Environment access lifecycle

Future procedures must cover request/approval, identity and MFA where appropriate, least privilege, expiry/review, role change, offboarding, service identities, emergency access, and access audit. Shared accounts are prohibited. Exact identity provider and review cadence remain to be decided.

## Readiness decisions

Before provisioning, accept hosting/region, cost owner, data/controller roles, network boundaries, domain/certificate ownership, environment data policy, secret/key design, backup/recovery, observability, deletion, provider accounts, deployment authority, and decommissioning process.
