# Access control

## Status and principles

This is a proposed role-permission model; no authentication or authorisation exists. Final identity, role assignment, programme scope, multi-role policy, approval separation, and emergency access require security, privacy, product, and programme approval.

- Authenticate identity before sensitive server operations; local unauthenticated guidance/drafts, if allowed, receive no server authority.
- Authorise every operation by role, programme, resource relationship, field sensitivity, record state, and action.
- Deny by default, minimise permissions, separate conflicting approvals, and audit material access/change.
- UI visibility is not authorisation. API, object, export, service, and administrative paths enforce the same policy.
- Avoid revealing whether an inaccessible record or object exists.

## Proposed role-permission matrix

`Own` means resources attributable to that user; `facility` and `programme` are explicit scopes, not global access.

| Capability | Collector | Household user | Scrapyard operator | Recycler | Programme reviewer | Programme manager | Data reviewer | System administrator |
|---|---|---|---|---|---|---|---|---|
| View approved safety content and public directory | Yes | Yes | Yes | Yes | Yes | Yes | As needed | As needed |
| Create local/own recovery record | Own | Own/optional | No by default | No | No | No | No | No |
| View recovery record | Own/minimised | Own/minimised | Intended facility deliveries only if authorised | Facility-assigned | Assigned programme cases | Programme-scoped | Minimum reviewed-data view only | Exceptional support access only |
| Correct category | Own before/through allowed stage | Own | No | Record discrepancy separately | Review correction | View/manage policy, not rewrite source | Approve/reject dataset candidate | No domain approval |
| Maintain location profile | No | No | Own profile proposal | Own facility proposal | Review if assigned | Programme approve/suspend | No | Technical administration only |
| Confirm handoff/weight/final price | No | No unless programme explicitly permits | Only if assigned handoff role | Facility-scoped | Review, not originate | View/programme policy | No | No |
| Add processing evidence | No | No | Only if assigned | Facility-scoped | Review | View | No | No |
| Decide recovery-record review | No | No | No self-approval | No self-approval/disputed record | Assigned approve/reject/request info | Policy/oversight; exceptional decision only if separated | No | No |
| View programme aggregates | Own summary only | Own only | Facility summary | Facility summary | Review scope | Programme scope | Approved research/evaluation only | Operational health, not business default |
| Review training candidate | Submit correction only | Submit correction only | Evidence input if authorised | Evidence input if authorised | No automatic training approval | Oversight only | Assigned approve/reject | No model-data approval |
| Manage users/roles | No | No | No | No | No | Programme assignment requests/limited policy | No | Technical role administration under approval |
| Export restricted data | No by default | No | No by default | No by default | Case-limited if approved | Programme-approved export | Approved minimised dataset only | Exceptional audited support/export path |

This matrix is directional. Exact field/operation permissions, role combinations, facility delegation, and household authentication remain to be decided.

## Authentication requirements

Future design must decide identity proofing proportionate to role, secure session/token lifecycle, phishing/account-recovery risk, supported devices, MFA for privileged/reviewer roles, revocation, failed-attempt controls, and offline session behaviour. Recycler/programme affiliation must be verified separately from login. Authentication success never establishes recycler approval or record ownership.

## Record ownership and field access

A collector may see their record and evidence status but not unrelated identities, reviewer security notes, or other programmes. A recycler sees only fields needed to receive/process assigned or presented records. Reviewers see minimum evidence for assigned decisions. Managers see programme-scoped aggregates/details. Field-level rules protect contact, precise location, images, review signals, audit/security data, and future financial references.

Object-storage access uses API-mediated or short-lived authorised operations bound to actor, object, purpose, and expiry. A QR code is a reference, not permission.

## Approval separation

Proposed separation prevents a collector from verifying their record, a recycler from resolving its own disputed evidence, a data submitter from solely approving a high-risk label, a safety author from solely publishing material content, and an administrator from making domain decisions merely through technical privilege. Small-team exceptions need explicit risk approval, compensating independent review, and audit.

## Audit events

Audit successful and denied sensitive actions where proportionate: login/recovery, role/affiliation change, record/evidence access/change, QR lookup, handoff/weight/processing, review outcome, restricted export, data/model/content approval, privileged support access, and policy/configuration change. Do not copy secret or full sensitive content into the audit event.

## Administrative access

Administrator access is named, least-privilege, separately authenticated, time-/task-limited where possible, and monitored. Use normal role pathways for routine work; no shared admin accounts. Emergency/break-glass access requires reason, approval where feasible, short expiry, alert, complete audit, and post-use review. Implementation and authority remain to be decided.

## Future identity-provider integration

Keep domain roles and programme/resource policy independent of provider-specific groups. Before choosing a provider, validate user/device context, language/accessibility, offline needs, account recovery, MFA, organisation/facility affiliation, data region/retention, availability, cost, export/exit, webhook/token validation, and administrator lifecycle. External identity attributes are untrusted until mapped and verified by owned policy.

## Access reviews

Proposed reviews cover inactive accounts, role/affiliation changes, privileged/admin access, reviewer queues, facility status, service credentials, exports, and orphaned ownership. Cadence, reviewers, evidence, and automatic expiry require approval before pilot use.
