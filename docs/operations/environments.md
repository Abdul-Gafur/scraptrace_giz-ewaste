# Environments

## Status

The SRS requires three application-delivery contexts: local development, continuous integration, and the controlled demonstration environment. None is provisioned by this documentation phase. A production environment is outside the authorised hackathon scope.

## Environment matrix

| Environment | Purpose | Permitted data | Access and isolation | Status |
|---|---|---|---|---|
| Local development | Developer work, component tests, and offline experiments | Synthetic, explicitly licensed, or approved minimal samples; no production personal data or unrestricted challenge assets | Per-developer configuration and non-production credentials; secrets outside source | Not configured |
| Continuous integration | Repeatable static, unit, contract, build, security, and selected evaluation checks | Minimal synthetic fixtures and approved evaluation manifests only | Ephemeral jobs, least-privilege credentials, protected secrets, no public data exposure | Not configured |
| Demonstration | Integrated acceptance, rehearsal, judging, and SRS performance evidence | Seeded fictional, synthetic, challenge-provided under permitted terms, or expressly authorised data | Named team/reviewer access, role separation, private evidence, isolated provider accounts, teardown plan | Not provisioned |
| Production | Future field or programme operation | Real operational data only after separate authorisation | Requires legal, privacy, security, operational, and programme approval | Excluded from this phase |

The demonstration baseline includes approximately 1,000 seed recovery records, a 10,000-record synthetic performance dataset, up to six images per record, 8–20 audit events per record, and up to 200 seeded locations. These are test-volume requirements, not evidence of real collection or impact.

## Data movement

- Promote reviewed code, contracts, configuration definitions, models, prompts, policies, and safety-content versions; do not copy uncontrolled mutable data between environments.
- Every image, dataset, location, account, price reference, and evidence artefact needs provenance and permitted use.
- Demonstration identities, processing events, prices, and locations are labelled fictional or authorised as applicable.
- Exports require minimum scope, integrity checks, owner approval, and audit when sensitive.

## Configuration and secrets

Configuration is environment-specific and validated at startup. Secret values never enter Git, documentation, browser bundles, logs, screenshots, fixtures, or QR codes. Provider endpoints, public origins, retention values, feature controls, model/content versions, and operational thresholds have named owners. Demonstration credentials and data have expiry and teardown procedures.

## Acceptance in the demonstration environment

The exact release must complete the defined eight-stage acceptance journey, all Must requirements, all critical security/privacy/safety controls, four reviewed language bundles, and required performance/reliability checks. The judging-window availability objective is 99%; it is a time-bounded demonstration target, not a production SLA.

## Future production decision

Production requires separate decisions for hosting and region, controller/processor roles, identity proofing, domain and certificates, secrets and keys, monitoring and response, backup/recovery, retention/deletion, cost ownership, release authority, support, and decommissioning. Passing the demonstration gate does not authorise field deployment.
