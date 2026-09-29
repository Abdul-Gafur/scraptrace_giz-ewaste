# Known limitations

Genuine limitations of Backend Phase 1 at the time of writing. Each one names what would remove it.

| Area | Limitation | To resolve |
|---|---|---|
| Identity | Local username/password provider with shared demo accounts. No account recovery, MFA, self-registration or role administration API. One role per account. | Identity ADR; external provider behind `AuthenticationService`; ADR-006 multi-role policy. |
| Sessions | Revocation works per user (session version), not per device. Tokens are not refreshable, so users sign in again after 30 minutes. | Session table or refresh tokens if the product needs per-device sign-out or longer sessions. |
| Rate limiting | In-process memory: limits are per API instance and reset on restart. | Shared store (for example Redis) before running more than one instance. |
| Evidence storage | Local filesystem only. The S3-compatible adapter is specified by the `EvidenceStorage` interface but not implemented. There is no malware scanning or quarantine workflow (`validation_status` is always `accepted`). | S3 adapter with server-side encryption and signed short-lived reads; scanning pipeline that sets `pending`/`quarantined`. |
| Evidence access | Recyclers can open a record's photographs only once the record is destined for or received at their facility. A record with no selected destination shows only the lookup preview before handoff. | Product decision on pre-acceptance comparison evidence. |
| QR tokens | Rotating `SCRAPTRACE_QR_TOKEN_SECRET` invalidates every issued QR. There is no key-versioning. | Add a key identifier to token rows for staged rotation. |
| Offline sync | `POST /v1/sync` (`SyncBatchRequest`) is not implemented. Idempotent creation, client-generated IDs, `If-Match` and replays make the individual endpoints safe for a future sync layer. | Implement the sync batch contract (out of Phase 1 scope). |
| Amendments | Post-submission and post-terminal amendments (FR-REC-006, ADR-003 follow-up) are not implemented; submitted records are immutable apart from lifecycle events. | Reviewed-amendment workflow and event. |
| Review assignment | Cases are unassigned until a reviewer decides; the first deciding reviewer is recorded as assignee. No assignment API. | Assignment endpoints if programmes need them. |
| Reporting | No reporting or export endpoints (`ReportingSummary`). Records reach `approved_and_completed` so a reporting layer can count them. | Reporting milestone. |
| Retention | Only idempotency outcomes have an expiry and purge command. Record, evidence and audit retention need the approved policies in `docs/data/data-retention.md`. | Retention jobs once policies are approved. |
| Scale | Queue flag filtering uses JSONB containment on PostgreSQL without a GIN index; list endpoints load the full record graph per page (bounded at 100). | Add indexes and projections when volumes justify them. |
| Dependencies | Pillow, Starlette/FastAPI, AnyIO, python-multipart, and the transitive HTTPX2 transport were upgraded. The post-upgrade environment audit reports only PyTorch among runtime packages, plus three development/build tools; see the advisory disposition below. | Review model runtime and checkpoint compatibility before changing PyTorch; maintain a production-only lock and audit in CI. |

## Dependency advisory disposition

The pre-remediation `pip-audit` reported 79 advisory entries across seven packages. FastAPI 0.115.12 had no direct finding, but constrained the installed vulnerable Starlette. The post-upgrade environment audit reports 22 entries across four packages: 10 PyTorch entries (including duplicate records) and 12 entries in `pip`, `pytest`, and `setuptools`, which are not application runtime dependencies. This is not a clean audit; the PyTorch risk decision remains open. After the upgrade, the PostgreSQL API suite passed 460/460, the standalone vision tests passed 14/14 including the real checkpoint, and the real HTTP browser suite passed its five scheduled desktop/mobile tests (three other-project cases were inapplicable).

| Package | Current version | Reported fixed version | Exposure and disposition |
|---|---:|---:|---|
| Pillow | 12.3.0 | Up to 12.3.0 across reported issues | Handles uploaded images. Upgraded and exercised by image, evidence, and vision tests; keep upload byte and dimension limits. |
| Starlette / FastAPI | 1.3.1 / 0.141.1 | Up to Starlette 1.3.1 across reported issues | Parses requests and uploads. Upgraded as a compatible pair; the app does not serve user files through `FileResponse` or use `StaticFiles`. |
| AnyIO | 4.14.2 | 4.14.2 | Used for inference and password work in threads. The reported TLS internationalised-domain and process-pool issues are not called through those paths, but the package was upgraded. |
| python-multipart | 0.0.31 | Up to 0.0.31 across reported issues | Parses authenticated image uploads. Upgraded; upload limits and decoded-image checks remain in place. |
| HTTPX2 / httpcore2 | 2.12.0 / 2.12.0 | HTTPX2 2.12.0, httpcore2 2.10.0 | Transitive dependencies of the model tooling. The running API does not make WebSocket or proxy requests with them; upgraded to cover future model-fetch workflows. |
| PyTorch | 2.7.1 | Reported fixes span 2.8.0–2.13.0; one entry lists no fix | The API loads only the local checksum-verified released checkpoint and runs inference. It does not accept user checkpoints or call the affected training/CTC/JIT APIs. A forced upgrade could break checkpoint or torchvision compatibility; model owner should validate a paired torch/torchvision release and rerun the real-checkpoint suite before changing it. |

The audit also includes development tooling in this environment. CI should audit a locked production dependency set separately from the developer environment and record advisory identifiers, exposure and remediation decisions for release review.
