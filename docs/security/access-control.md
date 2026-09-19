# Access control

## Status and principles

The final [SRS](../product/ScrapTrace_Software_Requirements_Specification%20%282%29.docx) defines the application roles and access outcomes. No authentication or authorisation is implemented yet. Enforcement must be server-side, deny by default, apply role and object scope, and record security-relevant denials without exposing inaccessible data.

The application seeds six roles: **collector, recycler, reviewer, manager, content administrator, and data reviewer**. A household user follows the collector experience; a scrapyard operator uses the recycler role only after programme affiliation is established. System administration is an operational privilege, not a seventh baseline business role.

## Access matrix

| Capability | Collector | Recycler | Reviewer | Manager | Content administrator | Data reviewer |
|---|---|---|---|---|---|---|
| View current approved safety guidance and participating locations | Yes | Yes | Yes | Yes | Yes | As needed |
| Create and update own draft record | Own records | No | No | No | No | No |
| View submitted recovery record | Own records | Presented or assigned records | Assigned review scope | Programme scope | No | Minimised candidate-data view |
| Correct suggested category | Own record before submission | Record discrepancy only | Resolve through review | View | No | Review candidate label |
| Confirm handoff, measured weight, and final price | No | Presented or assigned record | Review only | View | No | No |
| Add processing evidence | No | Assigned record | Review only | View | No | No |
| Approve or reject flagged recovery record | No | No self-approval | Assigned records | Oversight; no routine rewrite | No | No |
| View dashboard and exports | Own status only | Facility scope | Review scope | Programme scope | Content status only | Approved evaluation scope |
| Draft, review, publish, supersede, or withdraw safety cards | No | No | No | Oversight | Authorised content scope with separation of duties | No |
| Admit corrections to a governed dataset | Submit only | Evidence only | No | Oversight | No | Authorised review scope |

Exact field permissions and permissible role combinations require implementation design and security review. A QR code identifies a record; it does not grant access.

## Authentication and sessions

- Authentication is required for server-side record, handoff, review, dashboard, content-administration, and data-review actions.
- Sessions use secure, HTTP-only, same-site cookies or an equivalently reviewed mechanism; credentials and tokens must not be stored in browser-accessible persistent storage.
- Sign-in, sign-out, expiry, revocation, failed attempts, account recovery, and role change must be handled safely.
- Privileged roles require stronger account controls and short, auditable administrative access where appropriate.
- Offline drafts have no server authority until an authenticated, authorised synchronization succeeds.

## Object and programme scope

Every request is authorised against the actor, action, record or object, programme/facility relationship, lifecycle state, and requested fields. Object-storage access is mediated by the API or a short-lived scoped operation. Collectors cannot see other collectors' records; recyclers cannot browse unrelated records; reviewers and managers remain within assigned programme scope.

Recycler affiliation, a directory listing, and a location's participation or verification badge are separate facts. Login never proves that a recycler is approved, certified, or authorised for every category.

## Separation of duties

A collector cannot verify their own record. A recycler cannot approve its own disputed evidence. A data submitter cannot solely admit a disputed label. Material safety content needs authorised review before publication. Technical administration does not confer programme, safety-content, or model-data decision authority.

## Audit and denial behaviour

Audit successful and denied sensitive actions, including sign-in, role or affiliation changes, record/evidence access, QR lookup, handoff, review, restricted export, content publication, dataset admission, and privileged support. A forbidden operation returns the defined unauthorised/forbidden response and creates a privacy-safe security event; it must not reveal whether an inaccessible object exists.

## Administrative operations

Named technical administrators may operate infrastructure under least privilege, approval, time limits, monitoring, and post-use review. Shared administrator accounts are prohibited. Administrative access is outside the six seeded business roles and cannot make domain decisions merely through technical privilege.
