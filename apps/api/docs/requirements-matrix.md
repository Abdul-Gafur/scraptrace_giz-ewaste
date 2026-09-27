# Requirement-to-endpoint matrix

Backend Phase 1 traceability from the [functional requirements](../../../docs/product/functional-requirements.md), [ADRs](../../../docs/decisions/README.md) and `packages/contracts` to the API. All routes are under `/v1` unless noted. "M" is the milestone that delivers the row.

| Requirement | Endpoint(s) | Contract | M |
|---|---|---|---|
| Persistence foundation; FR-REV-008 append-only history | Schema, migrations, triggers ([database](database.md)) | All persisted types | 1 |
| Deployment health | `GET /health/live`, `GET /health/ready` (model), `GET /health/database` | — | 1 |
| FR-ACC-001 demonstration sign-in for six roles | `POST /auth/sessions`, `GET /auth/me`, `DELETE /auth/sessions/current`, `GET /auth/demo-accounts` (dev only) | `UserRole`, `Permission`, `ActorReference` | 2 |
| FR-ACC-002 server-side role enforcement, 403 + security event | `require_permission`, `require_roles`, `Authorizer` on every protected route | `isPermissionAllowed` (parity-tested) | 2 |
| ADR-006 programme and facility scope | `GET /programmes/{programme_id}`, `GET /facilities/{facility_id}/receiving-locations` | `AuthorizationContext` | 2 |
| Vision appraisal behind authentication | `POST /vision/appraise` (existing; now authenticated by default) | `VisionAppraisalResponse` | 2 |
