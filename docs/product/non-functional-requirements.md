# Non-functional requirements

This catalogue mirrors sections 6.1–6.9 of the [approved SRS v1.1](<ScrapTrace_Software_Requirements_Specification (2).docx>). Targets apply to the documented hackathon environment and test conditions, not to a production service. Every requirement is **required but not implemented or verified** until linked evidence proves otherwise; its rationale is the quality or risk named by its section and the stakeholder need traced in [SRS traceability](srs-traceability.md#stakeholder-need-traceability).

## Performance

| ID | Requirement | Verification | Acceptance criterion |
|---|---|---|---|
| NFR-PERF-001 | Save local drafts within 2 seconds for 95% of attempts on the target phone. | Instrumented test | At least 95 of 100 saves pass and none loses accepted data. |
| NFR-PERF-002 | Return category prediction within 5 seconds for 95% of valid compressed images on the documented demonstration network/host. | Load test | At least 95 of 100 sequential requests pass. |
| NFR-PERF-003 | Return non-AI API reads/writes within 2 seconds at p95 under 20 concurrent demonstration users. | Load test | p95 is at most 2 seconds and error rate is below 1%. |
| NFR-PERF-004 | Load seeded dashboard summaries within 5 seconds and paginate record lists. | System test | First useful render is within 5 seconds and no list query is unbounded. |
| NFR-PERF-005 | Target at most 2 MB per compressed client evidence image; server maximum is configurable. | Upload test | Supported oversized images are compressed or rejected with the limit shown. |

## Reliability and availability

| ID | Requirement | Verification | Acceptance criterion |
|---|---|---|---|
| NFR-REL-001 | A validated local draft survives browser close/reopen and temporary network loss. | Recovery test | Ten interruption scenarios recover all committed fields. |
| NFR-REL-002 | Synchronization is idempotent and creates at most one server record per client mutation. | Integration test | Repeated and reordered retries preserve one logical result. |
| NFR-REL-003 | AI, map or LLM failure degrades only the dependent function and never corrupts the recovery record. | Fault-injection test | Each outage has bounded error/fallback and records remain usable. |
| NFR-REL-004 | The demonstration deployment exposes health and privacy-safe service-error metrics. | Operations test | Health reports component state; logs include correlation IDs and no raw secrets. |
| NFR-REL-005 | No production SLA is claimed; target 99% availability during the agreed judging window, excluding organiser network failure. | Monitoring review | A judging-window report documents uptime and exclusions. |

## Safety

| ID | Requirement | Verification | Acceptance criterion |
|---|---|---|---|
| NFR-SAFE-001 | Qualified review precedes safety-content publication; content carries source, version, approval and review metadata. | Content audit | All seven category cards and every released language bundle pass the checklist. |
| NFR-SAFE-002 | Never give home dismantling, burning, chemical extraction, refrigerant-release or battery-puncture instructions. | Adversarial test | Every prohibited prompt refuses or falls back. |
| NFR-SAFE-003 | Fixed reviewed emergency wording remains available offline. | Offline/content test | Every configured emergency trigger shows approved text without an external call. |
| NFR-SAFE-004 | Distinguish identification, advice, estimate and verified outcome so uncertainty remains visible. | UX review | Each result uses approved labels and disclaimers. |
| NFR-SAFE-005 | Fail safely when AI or content controls fail; no guidance is better than invented hazardous guidance. | Fault test | Blocked/failed content produces referral and a diagnostic event. |

## Security

| ID | Requirement | Verification | Acceptance criterion |
|---|---|---|---|
| NFR-SEC-001 | Use HTTPS for public traffic and keep secrets in server-side environment/secret-management controls, never source or browser code. | Configuration scan | TLS meets baseline and no unresolved high secret-scan finding remains. |
| NFR-SEC-002 | Use secure, same-site, HTTP-only cookies or an equivalently reviewed token mechanism; sessions expire and can be revoked. | Security test | Cookie flags pass and revoked/expired sessions fail. |
| NFR-SEC-003 | Enforce object- and role-level authorisation for every protected resource. | Access-control test | No request in the role/object matrix succeeds without authority. |
| NFR-SEC-004 | Validate uploads, generate object keys server-side, scan malware where supported and use private storage with short-lived access. | Upload test | Invalid/polyglot files, enumeration and permanent public access fail. |
| NFR-SEC-005 | Use parameterized queries or safe ORM access and protect cookie-authenticated mutations against CSRF. | SAST/DAST | No high-severity injection or CSRF finding remains. |
| NFR-SEC-006 | Log security actions with actor, action, time, target and correlation ID without secrets or raw user-bearing safety prompts. | Log review | Test actions are traceable and prohibited fields are absent. |
| NFR-SEC-007 | Scan dependencies and containers; remediate or time-bound-accept critical/high findings before release. | CI scan | No unreviewed critical/high finding remains. |
| NFR-SEC-008 | Treat LLM input/retrieved content as untrusted and resist injection through instructions plus output validation. | Adversarial test | Tests cannot reveal secrets, change role, add facts or bypass prohibited-action filters. |

## Privacy

| ID | Requirement | Verification | Acceptance criterion |
|---|---|---|---|
| NFR-PRV-001 | Collect only journey-required data and document each field's purpose, visibility and retention class. | Data inventory | Every table/API field maps to the approved dictionary. |
| NFR-PRV-002 | Exclude precise coordinates, identity and private evidence from public or aggregate dashboards. | Privacy test | Responses contain only approved coarse-area and aggregate fields. |
| NFR-PRV-003 | Send the LLM no name, phone, account ID, precise coordinate or image. | Integration inspection | Captured provider requests contain none. |
| NFR-PRV-004 | Require separate opt-in and human approval before future training use of images or corrections. | Consent test | Declined or absent consent prevents dataset export. |
| NFR-PRV-005 | Explain what is collected, why, visibility, optionality and pilot correction/deletion requests before submission. | Content review | The plain-language notice covers every item. |
| NFR-PRV-006 | Complete a privacy-impact review before field pilot or production deployment. | Governance gate | A signed review and action log exists before pilot collection. |

## Maintainability and supportability

| ID | Requirement | Verification | Acceptance criterion |
|---|---|---|---|
| NFR-MNT-001 | Separate web, API, ML, contracts, infrastructure and documentation in an owned monorepo. | Repository review | Structure matches architecture and contains no circular package dependency. |
| NFR-MNT-002 | Publish OpenAPI and version shared schemas. | Contract test | Checked schema matches running endpoints and client types. |
| NFR-MNT-003 | Use reversible reviewed migrations and deterministic seed data containing no real personal data. | CI test | Fresh setup and upgrade/downgrade pass. |
| NFR-MNT-004 | Automate unit, integration and end-to-end coverage for critical online, offline, role and failure paths. | Coverage review | Every Must acceptance flow has passing evidence. |
| NFR-MNT-005 | Correlate logs, metrics and traces without secrets, raw personal data or full image URLs. | Observability review | A sample request is traceable across services without prohibited data. |
| NFR-MNT-006 | Isolate simulated incentive, optional TTS and external providers behind flags/configuration. | Configuration test | Disabling optional features leaves the Must journey functional. |

## Internationalization, localization and accessibility

| ID | Requirement | Verification | Acceptance criterion |
|---|---|---|---|
| NFR-I18N-001 | Use UTF-8 and externalize every translatable baseline string. | Code review | Localization-key scan covers the end-to-end journey. |
| NFR-I18N-002 | Support English, French, Arabic and Portuguese with human-reviewed UI and safety translations. | Localization test | Each supported language completes the journey without an untranslated critical string. |
| NFR-I18N-003 | Render dates, time, numbers, currency and units by locale while preserving unambiguous canonical values. | Unit/UI test | Fixtures render and round-trip without value change. |
| NFR-I18N-004 | Persist selected language offline; use English as explicit fallback. | Offline test | Language survives restart and network loss. |
| NFR-A11Y-001 | Target WCAG 2.1 AA for core pages, including keyboard use, visible focus, labels, image alternatives and contrast. | Automated/manual audit | No critical automated finding; keyboard and screen-reader smoke tests pass. |
| NFR-A11Y-002 | Use plain language, short actions and icons with text; never use colour alone for state. | UX/content review | Every status has text/icon labelling and passes the readability checklist. |
| NFR-A11Y-003 | Make primary mobile touch targets at least 44 × 44 CSS pixels. | UI measurement | Target-device inspection confirms every primary action. |

## Computer-vision and LLM quality

| ID | Requirement | Verification | Acceptance criterion |
|---|---|---|---|
| NFR-AI-001 | Split the vision dataset so identical or near-duplicate images cannot cross train/test boundaries. | Data audit | Manifest and duplicate report confirm separation. |
| NFR-AI-002 | Report dataset version, class counts, split method, per-class precision/recall/F1, confusion matrix, threshold and limitations in the model card. | Document review | Every field exists for the release candidate. |
| NFR-AI-003 | Meet the approved macro-F1 threshold; until approval, candidate target is macro-F1 ≥ 0.70 with no class recall below 0.50 on the held-out challenge test split. | Model evaluation | Signed report passes or release is blocked/visibly limited. |
| NFR-AI-004 | Route configurable low confidence to manual confirmation and document the threshold from validation. | Model/UI test | Below-threshold cases never auto-advance. |
| NFR-AI-005 | Keep corrections in human review until versioned retraining and regression approval; retain prior model versions. | Pipeline review | No direct train/deploy path exists from user input. |
| NFR-LLM-001 | Evaluate all seven categories and all released languages, plus missing-card, provider-failure and injection cases. | Evaluation run | 100% of prohibited-safety cases refuse/fallback and every displayed fact traces to a card. |
| NFR-LLM-002 | Observe provider/model, prompt template, card version, validation result and latency without user identity. | Telemetry test | Non-personal metadata can reproduce/audit a test response. |
| NFR-LLM-003 | Regression-evaluate any external model or prompt-template change before demonstration deployment. | Release gate | Release evidence links a passing grounded-response report. |

## Compliance and regulatory boundaries

| ID | Requirement | Verification | Acceptance criterion |
|---|---|---|---|
| NFR-CMP-001 | Describe alignment with Ghana Act 917 without claiming regulatory approval, issuing EPR credits or calling records statutory certificates. | Content/legal review | User-facing and exported text uses the approved non-certification statement. |
| NFR-CMP-002 | Design personal-data handling toward Ghana Data Protection Act, 2012 (Act 843), subject to legal review before field use. | Privacy/legal review | Data inventory, purpose analysis, rights process and processor list are reviewed. |
| NFR-CMP-003 | Record and follow dataset, map, model, font and source-code licences/terms. | Licence scan | No incompatible use remains unresolved. |
| NFR-CMP-004 | Target WCAG 2.1 AA for the core journey. | Accessibility audit | Release report records automated/manual results and accepted exceptions. |

## Test conditions and interpretation

Performance tests use the agreed demonstration phone, a current desktop browser, a seeded 10,000-record metadata set and a documented network. External-provider outage time is reported separately. The 99% judging-window target is not a production SLA. The model threshold is a candidate release gate until product owners approve a threshold from baseline results.
